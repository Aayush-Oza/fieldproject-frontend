// frontend/js/volunteer/scanner.js
// Requires: api.js, auth.js, volunteer-hamburger.js, jsQR (CDN)
//
// GET /volunteer/assignments              → load assigned events
// POST /volunteer/checkin                 → { qr_token, event_id }
// GET /volunteer/checkin/:event_id/log   → recent checkins

document.addEventListener('DOMContentLoaded', init);

let selectedEventId = null;
let stream = null;
let scanLoop = null;
let recentCheckins = [];
let isProcessing = false; // prevent double scans

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
async function init() {
  const user = getUser();
  if (!user) { window.location.href = '../login.html'; return; }
  if (user.role !== 'volunteer') {
    window.location.href = user.role === 'admin'
      ? '../admin/dashboard.html'
      : '../participant/dashboard.html';
    return;
  }

  document.getElementById('startBtn')?.addEventListener('click', startCamera);
  document.getElementById('stopBtn')?.addEventListener('click', stopCamera);
  document.getElementById('manualSubmitBtn')?.addEventListener('click', manualCheckin);
  document.getElementById('manualToken')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') manualCheckin();
  });
  document.getElementById('eventSelect')?.addEventListener('change', onEventChange);

  await loadAssignments();

  // Auto-select if ?event_id= in URL
  const urlEventId = new URLSearchParams(location.search).get('event_id');
  if (urlEventId) {
    const sel = document.getElementById('eventSelect');
    if (sel) { sel.value = urlEventId; onEventChange(); }
  }
}

/* ══════════════════════════════════════════
   LOAD ASSIGNMENTS
══════════════════════════════════════════ */
async function loadAssignments() {
  const sel = document.getElementById('eventSelect');
  try {
    const res = await Api.get('/volunteer/assignments');
    if (!res.ok || !res.body?.success) throw new Error();

    const assignments = res.body.data || [];
    if (!assignments.length) {
      sel.innerHTML = '<option value="">No assigned events</option>';
      return;
    }

    // Fetch event details
    const events = await Promise.all(
      assignments.map(a =>
        Api.get(`/volunteer/assignments/${a.event_id}/event`)
          .then(r => r.body?.success ? {
            id: a.event_id,
            title: r.body.data.title,
            start_time: r.body.data.start_time,
            end_time: r.body.data.end_time,
            is_completed: r.body.data.is_completed  // ← ADDED
          } : { id: a.event_id, title: `Event #${a.event_id}`, is_completed: false })
          .catch(() => ({ id: a.event_id, title: `Event #${a.event_id}`, is_completed: false }))
      )
    );

    // ← FILTER OUT COMPLETED EVENTS
    const activeEvents = events.filter(e => !e.is_completed);

    if (!activeEvents.length) {
      sel.innerHTML = '<option value="">No active assigned events</option>';
      return;
    }

    sel.innerHTML = '<option value="">- choose your assigned event -</option>' +
      activeEvents.map(e => `<option value="${e.id}" data-start="${e.start_time||''}" data-end="${e.end_time||''}">${esc(e.title)}</option>`).join('');

  } catch {
    sel.innerHTML = '<option value="">Failed to load events</option>';
  }
}

/* ══════════════════════════════════════════
   EVENT CHANGE
══════════════════════════════════════════ */
function onEventChange() {
  const sel = document.getElementById('eventSelect');
  const opt = sel.options[sel.selectedIndex];
  selectedEventId = sel.value ? Number(sel.value) : null;

  const scannerCard = document.getElementById('scannerCard');
  const recentCard  = document.getElementById('recentCard');
  const banner      = document.getElementById('checkinWindowBanner');

  if (!selectedEventId) {
    stopCamera();
    if (scannerCard) scannerCard.style.display = 'none';
    if (recentCard)  recentCard.style.display  = 'none';
    if (banner)      banner.classList.add('hidden');
    clearResult();
    return;
  }

  if (scannerCard) scannerCard.style.display = '';
  if (recentCard)  recentCard.style.display  = '';

  const rawStart = opt.dataset.start;
  const rawEnd   = opt.dataset.end;

  const toIST = (timeStr, offsetMin = 0) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const totalMins = h * 60 + m + offsetMin;
    const finalH = Math.floor(((totalMins % 1440) + 1440) % 1440 / 60);
    const finalM = ((totalMins % 60) + 60) % 60;
    const d = new Date();
    d.setHours(finalH, finalM, 0, 0);
    return d;
  };

  const windowOpen  = toIST(rawStart, -60);
  const windowClose = toIST(rawEnd, 0);
  const now         = new Date();

  let locked = false, lockMsg = '';
  if (windowOpen && windowClose) {
    if (now < windowOpen)  { locked = true; lockMsg = `🔒 Check-in opens at ${windowOpen.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`; }
    if (now > windowClose) { locked = true; lockMsg = '🔒 Event has ended - check-in closed'; }
  }

  if (banner) {
    banner.classList.remove('hidden');
    banner.innerHTML = locked
      ? `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:0.75rem 1rem;color:#991b1b;font-size:0.875rem;margin-bottom:1rem">${lockMsg}</div>`
      : `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:0.75rem 1rem;color:#166534;font-size:0.875rem;margin-bottom:1rem">✅ Check-in window: ${windowOpen.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} – ${windowClose.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</div>`;
  }

  const manualToken = document.getElementById('manualToken');
  const manualBtn   = document.getElementById('manualSubmitBtn');
  const startBtn    = document.getElementById('startBtn');
  if (manualToken) manualToken.disabled = locked;
  if (manualBtn)   manualBtn.disabled   = locked;
  if (startBtn)    startBtn.disabled    = locked;

  loadRecentLog();
  clearResult();
}

/* ══════════════════════════════════════════
   CAMERA
══════════════════════════════════════════ */
async function startCamera() {
  if (!selectedEventId) { showToast('Select an event first.', true); return; }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('scannerVideo');
    video.srcObject = stream;
    await video.play();

    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;

    isProcessing = false;
    scanLoop = requestAnimationFrame(scanFrame);
  } catch (err) {
    showToast('Camera access denied or unavailable.', true);
    console.error('[Scanner] Camera:', err);
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (scanLoop) { cancelAnimationFrame(scanLoop); scanLoop = null; }

  const video = document.getElementById('scannerVideo');
  if (video) video.srcObject = null;

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;

  isProcessing = false;
}

function scanFrame() {
  const video = document.getElementById('scannerVideo');
  if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
    scanLoop = requestAnimationFrame(scanFrame);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = typeof jsQR !== 'undefined'
    ? jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
    : null;

  // ← CAMERA KEEPS RUNNING, no stopCamera() here
  if (code?.data && !isProcessing) {
    isProcessing = true; // prevent scanning same QR multiple times
    processToken(code.data);
    return;
  }

  scanLoop = requestAnimationFrame(scanFrame);
}

/* ══════════════════════════════════════════
   CHECKIN
══════════════════════════════════════════ */
async function manualCheckin() {
  const token = document.getElementById('manualToken')?.value.trim();
  if (!token) { showToast('Enter a QR token.', true); return; }
  if (!selectedEventId) { showToast('Select an event first.', true); return; }
  await processToken(token);
  const inp = document.getElementById('manualToken');
  if (inp) inp.value = '';
}

async function processToken(token) {
  showResult('loading');

  try {
    const res = await Api.post('/volunteer/checkin', {
      qr_token: token,
      event_id: selectedEventId,
    });

    if (res.body?.success) {
      showResult('success', res.body.message || 'Checked in!');
      showToast('✅ Participant checked in!');
      await loadRecentLog();
    } else {
      showResult('error', res.body?.message || 'Check-in failed');
      showToast(res.body?.message || 'Check-in failed.', true);
    }
  } catch (err) {
    showResult('error', 'Network error. Try again.');
    showToast('Network error.', true);
  } finally {
    // ← RESUME CAMERA after 2 seconds regardless of success/error
    setTimeout(() => {
      isProcessing = false;
      if (stream) scanLoop = requestAnimationFrame(scanFrame);
    }, 2000);
  }
}

/* ══════════════════════════════════════════
   RECENT LOG
══════════════════════════════════════════ */
async function loadRecentLog() {
  if (!selectedEventId) return;
  try {
    const res = await Api.get(`/volunteer/checkin/${selectedEventId}/log`);
    if (!res.ok || !res.body?.success) return;

    recentCheckins = res.body.data || [];
    const countEl = document.getElementById('checkinCount');
    if (countEl) countEl.textContent = `${recentCheckins.length} check-in${recentCheckins.length !== 1 ? 's' : ''}`;

    const tbody = document.getElementById('recentBody');
    if (!tbody) return;

    if (!recentCheckins.length) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;padding:1.5rem;color:var(--slate)">No check-ins yet.</td></tr>';
      return;
    }

    tbody.innerHTML = recentCheckins.slice(0, 20).map(c => `
      <tr>
        <td style="font-size:0.82rem">${fmtDateTime(c.checked_in_at)}</td>
        <td style="font-size:0.82rem;color:var(--slate)">${esc(c.participant_name || '#' + c.registration_id)}</td>
      </tr>`).join('');
  } catch (err) {
    console.error('[Scanner] Log:', err);
  }
}

/* ══════════════════════════════════════════
   RESULT PANEL
══════════════════════════════════════════ */
function showResult(type, msg) {
  const el = document.getElementById('checkinResult');
  if (!el) return;
  el.classList.remove('hidden');

  if (type === 'loading') {
    el.innerHTML = '<div class="loading-state" style="padding:1.5rem"><div class="spinner"></div></div>';
    return;
  }

  const isSuccess = type === 'success';
  el.innerHTML = `
    <div class="card" style="text-align:center;padding:1.5rem;border-top:3px solid ${isSuccess ? 'var(--green)' : 'var(--red)'}">
      <div style="font-size:2.5rem;margin-bottom:0.5rem">${isSuccess ? '✅' : '❌'}</div>
      <div style="font-weight:700;color:${isSuccess ? 'var(--green)' : 'var(--red)'};margin-bottom:0.25rem">
        ${isSuccess ? 'Checked In!' : 'Failed'}
      </div>
      <div style="font-size:0.875rem;color:var(--slate)">${esc(msg)}</div>
    </div>`;

  setTimeout(clearResult, 4000);
}

function clearResult() {
  const el = document.getElementById('checkinResult');
  if (el) { el.innerHTML = ''; el.classList.add('hidden'); }
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); }
  catch { return null; }
}

function fmtDateTime(iso) {
  if (!iso) return '-';
  if (typeof iso === 'string' && iso.includes('IST')) return iso;
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return iso; }
}

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('toast-hide'), 3200);
  setTimeout(() => { toast.className = 'toast hidden'; }, 3700);
}
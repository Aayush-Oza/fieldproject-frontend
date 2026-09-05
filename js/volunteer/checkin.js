// frontend/js/volunteer/checkin.js
// Requires: api.js, auth.js, volunteer-hamburger.js
//
// GET /volunteer/assignments              → load assigned events
// GET /volunteer/assignments/:id/event   → event capacity
// GET /volunteer/checkin/:event_id/log   → checkin records

document.addEventListener('DOMContentLoaded', init);

let selectedEventId = null;
let eventCapacity   = 0;

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

  document.getElementById('eventSelect')?.addEventListener('change', onEventChange);
  document.getElementById('refreshBtn')?.addEventListener('click', loadLog);

  await loadAssignments();

  // Auto-select if ?event_id= in URL
  const urlEventId = new URLSearchParams(location.search).get('event_id');
  if (urlEventId) {
    const sel = document.getElementById('eventSelect');
    if (sel) { sel.value = urlEventId; onEventChange(); }
  }
}

/* ══════════════════════════════════════════
   LOAD ASSIGNMENTS INTO SELECT
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

    const events = await Promise.all(
      assignments.map(a =>
        Api.get(`/volunteer/assignments/${a.event_id}/event`)
          .then(r => r.body?.success ? { id: a.event_id, title: r.body.data.title, capacity: r.body.data.capacity } : { id: a.event_id, title: `Event #${a.event_id}`, capacity: 0 })
          .catch(() => ({ id: a.event_id, title: `Event #${a.event_id}`, capacity: 0 }))
      )
    );

    sel.innerHTML = '<option value="">- choose an event -</option>' +
      events.map(e => `<option value="${e.id}" data-capacity="${e.capacity}">${esc(e.title)}</option>`).join('');

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
  eventCapacity   = opt ? Number(opt.dataset.capacity || 0) : 0;

  if (selectedEventId) {
    loadLog();
  } else {
    setTbody('<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--slate)">Select an event to view check-ins.</td></tr>');
    resetStats();
  }
}

/* ══════════════════════════════════════════
   LOAD LOG
══════════════════════════════════════════ */
async function loadLog() {
  if (!selectedEventId) return;
  setTbody('<tr><td colspan="3"><div class="loading-state"><div class="spinner"></div></div></td></tr>');

  try {
    const res = await Api.get(`/volunteer/checkin/${selectedEventId}/log`);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');

    const checkins = res.body.data || [];
    renderStats(checkins.length);
    renderTable(checkins);

  } catch (err) {
    setTbody(`<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--slate)">${esc(err.message)}</td></tr>`);
    showToast('Could not load check-in log.', true);
  }
}

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
function renderStats(count) {
  const fill = eventCapacity > 0 ? Math.min(100, Math.round(count / eventCapacity * 100)) : 0;
  document.getElementById('statCheckins').textContent = count;
  document.getElementById('statCapacity').textContent = eventCapacity || '-';
  document.getElementById('statFill').textContent     = eventCapacity ? `${fill}%` : '-';
}

function resetStats() {
  ['statCheckins','statCapacity','statFill'].forEach(id => {
    document.getElementById(id).textContent = '-';
  });
}

function renderTable(checkins) {
  if (!checkins.length) {
    setTbody('<tr><td colspan="3" style="text-align:center;padding:2rem;color:var(--slate)">No check-ins recorded yet.</td></tr>');
    return;
  }

  setTbody(checkins.map((c, i) => `
    <tr>
      <td style="color:var(--slate);font-size:0.82rem">${i + 1}</td>
      <td style="font-size:0.82rem">#${c.registration_id}</td>
      <td style="font-size:0.82rem">${fmtDateTime(c.checked_in_at)}</td>
    </tr>`).join(''));
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function setTbody(html) {
  const el = document.getElementById('logBody');
  if (el) el.innerHTML = html;
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); }
  catch { return null; }
}

function fmtDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch { return iso; }
}

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
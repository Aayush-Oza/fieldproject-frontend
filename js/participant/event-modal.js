// frontend/js/participant/event-modal.js
// Shared modal logic for events page and dashboard
// Requires: api.js — EventModal.open(eventId, eventsArray, registeredIds, goToQR, onRegisterSuccess)

const EventModal = (() => {

  let modalEventId = null;
  let _eventsArray = [];
  let _registeredIds = new Set();
  let _onRegisterSuccess = null;

  function fmtDate(d) { return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(t) {
    const [h, m] = t.split(':');
    const d = new Date(); d.setHours(+h, +m);
    return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  }
  function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function showToast(msg, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  function open(eventId, eventsArray, registeredIds, goToQR = false, onRegisterSuccess = null) {
    _eventsArray = eventsArray;
    _registeredIds = registeredIds;
    _onRegisterSuccess = onRegisterSuccess;
    modalEventId = eventId;

    const ev = _eventsArray.find(e => e.id === eventId);
    if (!ev) return;

    // ── Banner ──
    const bannerImg = document.getElementById('modalBannerImg');
    const bannerGrad = document.getElementById('modalBannerGradient');
    if (ev.banner_url) {
      bannerImg.src = ev.banner_url;
      bannerImg.style.display = 'block';
      bannerGrad.style.position = 'absolute';
      bannerGrad.style.bottom = '0';
      bannerGrad.style.background = 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)';
    } else {
      bannerImg.style.display = 'none';
      bannerGrad.style.position = '';
      bannerGrad.style.background = 'linear-gradient(135deg,rgba(59,111,232,0.9),rgba(99,51,200,0.85))';
    }

    document.getElementById('modalBannerTitle').textContent = ev.title;

    // badges in banner
    const badges = [];
    if (ev.event_type) badges.push(`<span style="background:rgba(255,255,255,0.2);color:#fff;font-size:0.7rem;padding:0.2rem 0.5rem;border-radius:99px;font-weight:600;">${esc(ev.event_type)}</span>`);
    if (ev.mode) badges.push(`<span style="background:rgba(255,255,255,0.2);color:#fff;font-size:0.7rem;padding:0.2rem 0.5rem;border-radius:99px;font-weight:600;">${esc(ev.mode)}</span>`);
    if (ev.is_paid) badges.push(`<span style="background:rgba(251,191,36,0.3);color:#fbbf24;font-size:0.7rem;padding:0.2rem 0.5rem;border-radius:99px;font-weight:600;">₹${ev.entry_fee ?? 'Paid'}</span>`);
    else badges.push(`<span style="background:rgba(34,197,94,0.3);color:#4ade80;font-size:0.7rem;padding:0.2rem 0.5rem;border-radius:99px;font-weight:600;">Free</span>`);
    if (ev.has_certificate) badges.push(`<span style="background:rgba(99,51,200,0.3);color:#c4b5fd;font-size:0.7rem;padding:0.2rem 0.5rem;border-radius:99px;font-weight:600;">🎓 Certificate</span>`);
    document.getElementById('modalBannerBadges').innerHTML = badges.join('');

    // ── Meta rows ──
    const metaRows = [];
    metaRows.push(`<div style="font-size:0.85rem;display:flex;gap:0.5rem;align-items:center;"><span>🗓</span><span>${fmtDate(ev.event_date)} · ${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}</span></div>`);
    metaRows.push(`<div style="font-size:0.85rem;display:flex;gap:0.5rem;align-items:center;"><span>📍</span><span>${esc(ev.venue)}</span></div>`);
    if (ev.speaker_name) metaRows.push(`<div style="font-size:0.85rem;display:flex;gap:0.5rem;align-items:center;"><span>🎤</span><span>${esc(ev.speaker_name)}</span></div>`);
    if (ev.organizer_dept) metaRows.push(`<div style="font-size:0.85rem;display:flex;gap:0.5rem;align-items:center;"><span>🏛</span><span>${esc(ev.organizer_dept)}</span></div>`);
    if (ev.registration_deadline) metaRows.push(`<div style="font-size:0.85rem;display:flex;gap:0.5rem;align-items:center;color:var(--slate);"><span>⏰</span><span>Register by ${fmtDate(ev.registration_deadline)}</span></div>`);
    document.getElementById('modalMeta').innerHTML = metaRows.join('');

    // ── Description ──
    const descEl = document.getElementById('modalDescription');
    descEl.textContent = ev.description || '';
    descEl.style.display = ev.description ? '' : 'none';

    // ── Tags ──
    const extraEl = document.getElementById('modalExtraInfo');
    if (ev.tags) {
      extraEl.innerHTML = ev.tags.split(',').map(t => `<span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:99px;padding:0.2rem 0.65rem;font-size:0.75rem;color:var(--slate);">${esc(t.trim())}</span>`).join('');
    } else {
      extraEl.innerHTML = '';
    }

    // ── Register button state ──
    const regBtn = document.getElementById('modalRegisterBtn');
    const regClosedMsg = document.getElementById('modalRegClosedMsg');
    const isRegistered = _registeredIds.has(eventId);
    const full = (ev.registration_count ?? 0) >= ev.capacity;

    if (isRegistered) {
      regBtn.classList.add('hidden');
      regClosedMsg.classList.add('hidden');
    } else if (!ev.registration_open || full) {
      regBtn.classList.add('hidden');
      regClosedMsg.classList.remove('hidden');
      regClosedMsg.textContent = full ? 'This event is full.' : 'Registration is closed.';
    } else {
      regBtn.classList.remove('hidden');
      regBtn.disabled = false;
      regBtn.textContent = 'Register';
      regClosedMsg.classList.add('hidden');
    }

    // show modal
    document.getElementById('eventModal').classList.remove('hidden');

    if (goToQR) {
      _showQRState(eventId);
    } else {
      _showDetailsState();
    }
  }

  function _showDetailsState() {
    document.getElementById('modalStateDetails').classList.remove('hidden');
    document.getElementById('modalStateQR').classList.add('hidden');
  }

  async function _showQRState(eventId) {
    document.getElementById('modalStateDetails').classList.add('hidden');
    document.getElementById('modalStateQR').classList.remove('hidden');

    const wrap = document.getElementById('modalQRWrap');
    wrap.innerHTML = '<div class="spinner"></div>';

    try {
      const res = await Api.get(`/participant/events/${eventId}/qr`);
      if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
      const url = res.body.data.qr_url;
      wrap.innerHTML = `<img src="${url}" alt="QR Code" style="width:200px;height:200px;border-radius:var(--radius);" />`;
      const dl = document.getElementById('modalQRDownload');
      dl.href = url;
      dl.download = `qr_event_${eventId}.png`;
    } catch (err) {
      wrap.innerHTML = `<p style="color:var(--slate);font-size:0.85rem;">Could not load QR. ${esc(err.message)}</p>`;
    }
  }

  function close() {
    document.getElementById('eventModal').classList.add('hidden');
    modalEventId = null;
  }

  // ── Wire up modal buttons once DOM ready ──
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modalRegisterBtn')?.addEventListener('click', async () => {
      if (!modalEventId) return;
      const btn = document.getElementById('modalRegisterBtn');
      btn.disabled = true;
      btn.textContent = 'Registering…';

      const { ok, body } = await Api.post(`/participant/events/${modalEventId}/register`);
      if (ok) {
        showToast('Registered successfully!');
        if (_onRegisterSuccess) await _onRegisterSuccess();
        _showQRState(modalEventId);
      } else {
        showToast(body?.message || 'Registration failed.', 'error');
        btn.disabled = false;
        btn.textContent = 'Register';
      }
    });

    document.getElementById('eventModalClose')?.addEventListener('click', close);
    document.getElementById('eventModal')?.addEventListener('click', function (e) {
      if (e.target === this) close();
    });
  });

  return { open, close };

})();
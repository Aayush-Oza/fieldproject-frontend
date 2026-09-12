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
      bannerGrad.style.height = 'auto';
      bannerGrad.style.background = 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)';
    } else {
      bannerImg.style.display = 'none';
      bannerGrad.style.position = '';
      bannerGrad.style.height = '100%';
      bannerGrad.style.background = 'linear-gradient(135deg, #4F46E5 0%, #6C63FF 100%)';
    }

    // Title in banner
    document.getElementById('modalBannerTitle').textContent = ev.title;

    // Badges row in banner
    const badges = [];
    if (ev.event_type) badges.push(`<span class="modal-badge modal-badge-white">${esc(ev.event_type)}</span>`);
    if (ev.mode) badges.push(`<span class="modal-badge modal-badge-white">${esc(ev.mode)}</span>`);
    if (ev.is_paid) badges.push(`<span class="modal-badge modal-badge-amber">₹${ev.entry_fee ?? 'Paid'}</span>`);
    else badges.push(`<span class="modal-badge modal-badge-green">Free</span>`);
    if (ev.has_certificate) badges.push(`<span class="modal-badge modal-badge-purple">🎓 Certificate</span>`);
    document.getElementById('modalBannerBadges').innerHTML = badges.join('');

    // ── Details section ──
    const detailRows = [];

    // Date & time
    detailRows.push(`
      <div class="modal-detail-row">
        <span class="modal-detail-icon">🗓</span>
        <div>
          <div class="modal-detail-label">Date & Time</div>
          <div class="modal-detail-value">${fmtDate(ev.event_date)} · ${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}</div>
        </div>
      </div>`);

    // Venue
    detailRows.push(`
      <div class="modal-detail-row">
        <span class="modal-detail-icon">📍</span>
        <div>
          <div class="modal-detail-label">Venue</div>
          <div class="modal-detail-value">${esc(ev.venue)}</div>
        </div>
      </div>`);

    // Capacity
    const regCount = ev.registration_count ?? 0;
    const pct = Math.min(100, Math.round((regCount / ev.capacity) * 100));
    detailRows.push(`
      <div class="modal-detail-row">
        <span class="modal-detail-icon">👥</span>
        <div style="flex:1;">
          <div class="modal-detail-label">Capacity</div>
          <div class="modal-detail-value" style="margin-bottom:0.35rem;">${regCount} / ${ev.capacity} registered</div>
          <div style="height:5px;background:#E2E8F0;border-radius:100px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${pct>=100?'#DC2626':pct>=80?'#D97706':'#4F46E5'};border-radius:100px;"></div>
          </div>
        </div>
      </div>`);

    // Speaker
    if (ev.speaker_name) detailRows.push(`
      <div class="modal-detail-row">
        <span class="modal-detail-icon">🎤</span>
        <div>
          <div class="modal-detail-label">Speaker</div>
          <div class="modal-detail-value">${esc(ev.speaker_name)}</div>
        </div>
      </div>`);

    // Organizer
    if (ev.organizer_dept) detailRows.push(`
      <div class="modal-detail-row">
        <span class="modal-detail-icon">🏛</span>
        <div>
          <div class="modal-detail-label">Organizer</div>
          <div class="modal-detail-value">${esc(ev.organizer_dept)}</div>
        </div>
      </div>`);

    // Registration deadline
    if (ev.registration_deadline) detailRows.push(`
      <div class="modal-detail-row">
        <span class="modal-detail-icon">⏰</span>
        <div>
          <div class="modal-detail-label">Registration Deadline</div>
          <div class="modal-detail-value">${fmtDate(ev.registration_deadline)}</div>
        </div>
      </div>`);

    document.getElementById('modalMeta').innerHTML = detailRows.join('');

    // ── Description ──
    const descEl = document.getElementById('modalDescription');
    if (ev.description) {
      descEl.textContent = ev.description;
      descEl.style.display = '';
    } else {
      descEl.style.display = 'none';
    }

    // ── Tags ──
    const extraEl = document.getElementById('modalExtraInfo');
    if (ev.tags) {
      extraEl.innerHTML = `
        <div style="margin-bottom:0.35rem;font-size:0.75rem;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Tags</div>
        <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
          ${ev.tags.split(',').map(t => `<span class="badge badge-slate">${esc(t.trim())}</span>`).join('')}
        </div>`;
      extraEl.style.display = '';
    } else {
      extraEl.innerHTML = '';
      extraEl.style.display = 'none';
    }

    // ── Register button state ──
    const regBtn = document.getElementById('modalRegisterBtn');
    const regClosedMsg = document.getElementById('modalRegClosedMsg');
    const isRegistered = _registeredIds.has(eventId);
    const full = regCount >= ev.capacity;

    if (isRegistered) {
      regBtn.classList.add('hidden');
      regClosedMsg.classList.add('hidden');
    } else if (!ev.registration_open || full) {
      regBtn.classList.add('hidden');
      regClosedMsg.classList.remove('hidden');
      regClosedMsg.textContent = full ? '⚠️ This event is full.' : '🔒 Registration is closed.';
    } else {
      regBtn.classList.remove('hidden');
      regBtn.disabled = false;
      regBtn.textContent = ev.is_paid ? `Register · ₹${ev.entry_fee}` : 'Register for Free';
      regClosedMsg.classList.add('hidden');
    }

    // Show modal
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
      wrap.innerHTML = `
        <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:1rem;display:inline-block;">
          <img src="${url}" alt="QR Code" style="width:180px;height:180px;display:block;" />
        </div>`;
      const dl = document.getElementById('modalQRDownload');
      dl.href = url;
      dl.download = `qr_event_${eventId}.png`;
    } catch (err) {
      wrap.innerHTML = `<p style="color:#64748B;font-size:0.85rem;">Could not load QR. ${esc(err.message)}</p>`;
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
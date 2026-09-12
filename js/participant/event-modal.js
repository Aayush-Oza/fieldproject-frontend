// frontend/js/participant/event-modal.js

const EventModal = (() => {

  let modalEventId = null;
  let _eventsArray = [];
  let _registeredIds = new Set();
  let _onRegisterSuccess = null;

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtTime(t) {
    const [h, m] = t.split(':');
    const d = new Date(); d.setHours(+h, +m);
    return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  }
  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    // ── Banner image ──
    const bannerImg = document.getElementById('modalBannerImg');
    const bannerWrap = document.getElementById('modalBannerWrap');

    // Always reset first
    bannerImg.style.display = 'none';
    bannerImg.src = '';
    bannerWrap.classList.remove('has-image');

    if (ev.banner_url) {
      bannerImg.onload = () => {
        bannerImg.style.display = 'block';
        bannerWrap.classList.add('has-image');
      };
      bannerImg.onerror = () => {
        bannerImg.style.display = 'none';
        bannerWrap.classList.remove('has-image');
      };
      bannerImg.src = ev.banner_url;
    }

    // Title only in banner — NO badges here
    document.getElementById('modalBannerTitle').textContent = ev.title;
    document.getElementById('modalBannerBadges').innerHTML = ''; // always empty

    // ── Detail rows ──
    const rows = [];

    // Date & Time
    rows.push(`
      <div class="em-row">
        <span class="em-row-icon">🗓</span>
        <div>
          <div class="em-row-label">Date &amp; Time</div>
          <div class="em-row-value">${fmtDate(ev.event_date)} · ${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}</div>
        </div>
      </div>`);

    // Venue
    rows.push(`
      <div class="em-row">
        <span class="em-row-icon">📍</span>
        <div>
          <div class="em-row-label">Venue</div>
          <div class="em-row-value">${esc(ev.venue)}</div>
        </div>
      </div>`);

    // Fee / Type
    const feeLabel = ev.is_paid ? `₹${ev.entry_fee ?? 'Paid'}` : 'Free';
    const feeBadge = ev.is_paid
      ? `<span class="em-info-badge em-info-amber">${feeLabel}</span>`
      : `<span class="em-info-badge em-info-green">${feeLabel}</span>`;
    rows.push(`
      <div class="em-row">
        <span class="em-row-icon">🎟</span>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          ${feeBadge}
          ${ev.event_type ? `<span class="em-info-badge em-info-slate">${esc(ev.event_type)}</span>` : ''}
          ${ev.mode ? `<span class="em-info-badge em-info-slate">${esc(ev.mode)}</span>` : ''}
          ${ev.has_certificate ? `<span class="em-info-badge em-info-purple">🎓 Certificate</span>` : ''}
        </div>
      </div>`);

    // Capacity
    const regCount = ev.registration_count ?? 0;
    const pct = Math.min(100, Math.round((regCount / ev.capacity) * 100));
    const barColor = pct >= 100 ? '#DC2626' : pct >= 80 ? '#D97706' : '#4F46E5';
    rows.push(`
      <div class="em-row">
        <span class="em-row-icon">👥</span>
        <div style="flex:1;">
          <div class="em-row-label">Capacity</div>
          <div class="em-row-value" style="margin-bottom:0.4rem;">${regCount} / ${ev.capacity} registered</div>
          <div style="height:5px;background:#E2E8F0;border-radius:100px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:100px;transition:width 0.4s;"></div>
          </div>
        </div>
      </div>`);

    // Speaker
    if (ev.speaker_name) rows.push(`
      <div class="em-row">
        <span class="em-row-icon">🎤</span>
        <div>
          <div class="em-row-label">Speaker</div>
          <div class="em-row-value">${esc(ev.speaker_name)}</div>
        </div>
      </div>`);

    // Organizer
    if (ev.organizer_dept) rows.push(`
      <div class="em-row">
        <span class="em-row-icon">🏛</span>
        <div>
          <div class="em-row-label">Organizer</div>
          <div class="em-row-value">${esc(ev.organizer_dept)}</div>
        </div>
      </div>`);

    // Registration deadline
    if (ev.registration_deadline) rows.push(`
      <div class="em-row">
        <span class="em-row-icon">⏰</span>
        <div>
          <div class="em-row-label">Registration Deadline</div>
          <div class="em-row-value">${fmtDate(ev.registration_deadline)}</div>
        </div>
      </div>`);

    document.getElementById('modalMeta').innerHTML = rows.join('');

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
        <div class="em-tags-label">Tags</div>
        <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
          ${ev.tags.split(',').map(t => `<span class="badge badge-slate">${esc(t.trim())}</span>`).join('')}
        </div>`;
      extraEl.style.display = '';
    } else {
      extraEl.innerHTML = '';
      extraEl.style.display = 'none';
    }

    // ── Register button ──
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
    document.body.style.overflow = 'hidden';

    if (goToQR) _showQRState(eventId);
    else _showDetailsState();
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
        <div class="em-qr-box">
          <img src="${url}" alt="QR Code" style="width:180px;height:180px;display:block;" />
        </div>`;
      const dl = document.getElementById('modalQRDownload');
      dl.href = url;
      dl.download = `qr_event_${eventId}.png`;
    } catch (err) {
      wrap.innerHTML = `<p style="color:var(--slate);font-size:0.85rem;">Could not load QR. ${esc(err.message)}</p>`;
    }
  }

  function close() {
    document.getElementById('eventModal').classList.add('hidden');
    document.body.style.overflow = '';
    modalEventId = null;
  }

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
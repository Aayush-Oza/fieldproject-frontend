// frontend/js/participant/dashboard.js
if (!Auth.isLoggedIn()) window.location.href = '../login';

const NAV_LINKS = [
  { href: 'dashboard', label: 'Dashboard' },
  { href: 'events', label: 'Events' },
  { href: 'my-registrations', label: 'My Registrations' },
  { href: 'my-certificates', label: 'Certificates' },
];

Auth.initNav({ links: NAV_LINKS, active: 'Dashboard' });

const user = Auth.getUser();
document.getElementById('greetingName').textContent = user?.name?.split(' ')[0] || 'there';

// ── Toast ──
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ── Helpers ──
function fmtDay(d) { return new Date(d).getDate(); }
function fmtMon(d) { return new Date(d).toLocaleString('en', { month: 'short' }).toUpperCase(); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtTime(t) {
  const [h, m] = t.split(':');
  const d = new Date(); d.setHours(+h, +m);
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}
function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// store for EventModal access
let _dashEvents = [];
let _dashRegIds = new Set();

// ── Render upcoming ──
function renderUpcoming(regs) {
  const el = document.getElementById('upcomingList');
  const upcoming = regs
    .filter(r => r.status === 'registered' && r.event && !r.event.is_completed)
    .sort((a, b) => new Date(a.event.event_date) - new Date(b.event.event_date))
    .slice(0, 4);

  if (!upcoming.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p class="empty-state-title">No upcoming events</p>
        <p class="empty-state-desc">Browse and register for events below.</p>
      </div>`;
    return;
  }

  el.innerHTML = upcoming.map(r => `
    <div class="dash-event-item">
      <div class="dash-event-date">
        <span class="dash-event-date-day">${fmtDay(r.event.event_date)}</span>
        <span class="dash-event-date-mon">${fmtMon(r.event.event_date)}</span>
      </div>
      <div class="dash-event-info">
        <div class="dash-event-title">${esc(r.event.title)}</div>
        <div class="dash-event-meta">${esc(r.event.venue)} · ${fmtTime(r.event.start_time)}</div>
      </div>
      <button class="dash-event-qr" data-id="${r.event.id}">QR</button>
    </div>
  `).join('');

  el.querySelectorAll('.dash-event-qr').forEach(btn => {
    btn.addEventListener('click', () => EventModal.open(Number(btn.dataset.id), _dashEvents, _dashRegIds, true, loadAll));
  });
}

// ── Render certs ──
function renderCerts(certs) {
  const el = document.getElementById('certList');
  if (!certs.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎓</div>
        <p class="empty-state-title">No certificates yet</p>
        <p class="empty-state-desc">Attend events to earn certificates.</p>
      </div>`;
    return;
  }
  el.innerHTML = certs.slice(0, 4).map(c => `
    <div class="dash-cert-item">
      <span class="dash-cert-icon">🎓</span>
      <div class="dash-cert-info">
        <div class="dash-cert-title">${esc(c.event_title || 'Event')}</div>
        <div class="dash-cert-date">Issued ${fmtDate(c.issued_at)}</div>
      </div>
    </div>
  `).join('');
}

// ── Render events ──
function renderEvents(events, myRegs) {
  const el = document.getElementById('eventGrid');
  const registeredIds = new Set(myRegs.filter(r => r.status === 'registered').map(r => r.event_id));

  if (!events.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🗓️</div>
        <p class="empty-state-title">No events open right now</p>
        <p class="empty-state-desc">Check back soon.</p>
      </div>`;
    return;
  }

  el.innerHTML = events.map(e => {
    const isRegistered = registeredIds.has(e.id);
    const regCount = e.registration_count ?? 0;
    const isCompleted = e.is_completed;
    const pct = Math.min(100, Math.round((regCount / e.capacity) * 100));
    const fillClass = pct >= 100 ? 'full' : pct >= 80 ? 'near-full' : '';
    const full = pct >= 100;

    const typeBadge = e.event_type ? `<span class="badge badge-slate" style="font-size:0.7rem;">${esc(e.event_type)}</span>` : '';
    const modeBadge = e.mode ? `<span class="badge badge-slate" style="font-size:0.7rem;">${esc(e.mode)}</span>` : '';
    const paidBadge = e.is_paid ? `<span class="badge badge-amber" style="font-size:0.7rem;">₹${e.entry_fee ?? 'Paid'}</span>` : '<span class="badge badge-green" style="font-size:0.7rem;">Free</span>';
    const certBadge = e.has_certificate ? `<span class="badge badge-blue" style="font-size:0.7rem;">🎓 Certificate</span>` : '';

    return `
      <div class="event-card">
        <div class="event-card-top">
          <h3 class="event-card-title">${esc(e.title)}</h3>
          ${isRegistered ? '<span class="badge badge-green">Registered</span>' : ''}
        </div>
        <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.5rem;">
          ${typeBadge}${modeBadge}${paidBadge}${certBadge}
        </div>
        <div class="event-card-meta">
          <div class="event-card-meta-row"><span class="event-card-meta-icon">📍</span>${esc(e.venue)}</div>
          <div class="event-card-meta-row"><span class="event-card-meta-icon">🗓</span>${fmtDate(e.event_date)} · ${fmtTime(e.start_time)}</div>
        </div>
        <div class="event-card-capacity">
          <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${pct}%"></div></div>
          <span>${regCount}/${e.capacity}</span>
        </div>
        <div class="event-card-actions">
          ${isCompleted
            ? `<button class="btn btn-secondary btn-sm" disabled>Completed</button>`
            : isRegistered
              ? `<button class="btn btn-secondary btn-sm view-btn" data-id="${e.id}">View Details / QR</button>`
              : `<button class="btn btn-primary btn-sm open-btn" data-id="${e.id}" ${full ? 'disabled' : ''}>${full ? 'Full' : 'Register'}</button>`
          }
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', () => EventModal.open(Number(btn.dataset.id), _dashEvents, _dashRegIds, false, loadAll));
  });
  el.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => EventModal.open(Number(btn.dataset.id), _dashEvents, _dashRegIds, true, loadAll));
  });
}

// ── Load ──
async function loadAll() {
  const [regsRes, certsRes, eventsRes] = await Promise.all([
    Api.get('/participant/registrations'),
    Api.get('/participant/certificates'),
    Api.get('/participant/events'),
  ]);
  const regs = regsRes.ok ? regsRes.body.data : [];
  const certs = certsRes.ok ? certsRes.body.data : [];
  const events = eventsRes.ok ? eventsRes.body.data : [];

  // store for modal
  _dashEvents = events;
  _dashRegIds = new Set(regs.filter(r => r.status === 'registered').map(r => r.event_id));

  const attended = regs.filter(r => r.status === 'registered' && r.event?.is_completed).length;
  document.getElementById('statRegistered').textContent = regs.filter(r => r.status === 'registered').length;
  document.getElementById('statAttended').textContent = attended;
  document.getElementById('statCerts').textContent = certs.length;

  renderUpcoming(regs);
  renderCerts(certs);
  renderEvents(events, regs);
}

loadAll();
// frontend/js/participant/events.js

if (!Auth.isLoggedIn()) window.location.href = '../login';

const NAV_LINKS = [
  { href: 'dashboard', label: 'Dashboard' },
  { href: 'events', label: 'Events' },
  { href: 'my-registrations', label: 'My Registrations' },
  { href: 'my-certificates', label: 'Certificates' },
];

Auth.initNav({ links: NAV_LINKS, active: 'Events' });

// ── Helpers ──
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 300); }, 3000);
}
function fmtDate(d) { return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtTime(t) {
  const [h, m] = t.split(':');
  const d = new Date(); d.setHours(+h, +m);
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}
function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let allEvents = [];
let myRegIds = new Set();

/* ══════════════════════════════════════════
   RENDER CARDS
══════════════════════════════════════════ */
function render() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const statusF = document.getElementById('statusFilter').value;
  const el = document.getElementById('eventGrid');

  const filtered = allEvents.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search) || e.venue.toLowerCase().includes(search);
    const isRegistered = myRegIds.has(e.id);
    const full = (e.registration_count ?? 0) >= e.capacity;
    if (statusF === 'registered' && !isRegistered) return false;
    if (statusF === 'available' && (isRegistered || full)) return false;
    if (statusF === 'full' && !full) return false;
    return matchSearch;
  });

  if (!filtered.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🗓️</div>
        <p class="empty-state-title">No events found</p>
        <p class="empty-state-desc">Try a different search or filter.</p>
      </div>`;
    return;
  }

  el.innerHTML = filtered.map(e => {
    const isRegistered = myRegIds.has(e.id);
    const regCount = e.registration_count ?? 0;
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
          <div class="event-card-meta-row"><span class="event-card-meta-icon">🗓</span>${fmtDate(e.event_date)} · ${fmtTime(e.start_time)} – ${fmtTime(e.end_time)}</div>
        </div>
        <div class="event-card-capacity">
          <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${pct}%"></div></div>
          <span>${regCount}/${e.capacity}</span>
        </div>
        <div class="event-card-actions">
          ${isRegistered
            ? `<button class="btn btn-secondary btn-sm view-btn" data-id="${e.id}">View Details / QR</button>`
            : `<button class="btn btn-primary btn-sm open-btn" data-id="${e.id}" ${full ? 'disabled' : ''}>${full ? 'Full' : 'Register'}</button>`
          }
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', () => EventModal.open(Number(btn.dataset.id), allEvents, myRegIds, false, loadAll));
  });
  el.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => EventModal.open(Number(btn.dataset.id), allEvents, myRegIds, true, loadAll));
  });
}

/* ══════════════════════════════════════════
   FILTERS
══════════════════════════════════════════ */
document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('statusFilter').addEventListener('change', render);

/* ══════════════════════════════════════════
   LOAD
══════════════════════════════════════════ */
async function loadAll() {
  const [eventsRes, regsRes] = await Promise.all([
    Api.get('/participant/events'),
    Api.get('/participant/registrations'),
  ]);
  allEvents = eventsRes.ok ? eventsRes.body.data : [];
  const regs = regsRes.ok ? regsRes.body.data : [];
  myRegIds = new Set(regs.filter(r => r.status === 'registered').map(r => r.event_id));
  render();
}

loadAll();
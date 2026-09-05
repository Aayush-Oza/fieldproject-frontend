// frontend/js/participant/dashboard.js

if (!Auth.isLoggedIn()) window.location.href = '../login.html';

const NAV_LINKS = [
  { href: 'dashboard.html',        label: 'Dashboard' },
  { href: 'events.html',           label: 'Events' },
  { href: 'my-registrations.html', label: 'My Registrations' },
  { href: 'my-certificates.html',  label: 'Certificates' },
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
function fmtDay(d)  { return new Date(d).getDate(); }
function fmtMon(d)  { return new Date(d).toLocaleString('en', { month: 'short' }).toUpperCase(); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtTime(t) {
  const [h, m] = t.split(':');
  const d = new Date(); d.setHours(+h, +m);
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}

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
        <div class="dash-event-title">${r.event.title}</div>
        <div class="dash-event-meta">${r.event.venue} · ${fmtTime(r.event.start_time)}</div>
      </div>
      <button class="dash-event-qr" data-event-id="${r.event.id}" data-event-title="${r.event.title}">QR</button>
    </div>
  `).join('');

  el.querySelectorAll('.dash-event-qr').forEach(btn => {
    btn.addEventListener('click', () => openQR(btn.dataset.eventId, btn.dataset.eventTitle));
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
        <div class="dash-cert-title">${c.event_title || 'Event'}</div>
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
    const regCount     = e.registration_count ?? 0;
    const pct          = Math.min(100, Math.round((regCount / e.capacity) * 100));
    const fillClass    = pct >= 100 ? 'full' : pct >= 80 ? 'near-full' : '';
    const full         = pct >= 100;
    return `
      <div class="event-card">
        <div class="event-card-top">
          <h3 class="event-card-title">${e.title}</h3>
          ${isRegistered ? '<span class="badge badge-green">Registered</span>' : ''}
        </div>
        <div class="event-card-meta">
          <div class="event-card-meta-row"><span class="event-card-meta-icon">📍</span>${e.venue}</div>
          <div class="event-card-meta-row"><span class="event-card-meta-icon">🗓</span>${fmtDate(e.event_date)} · ${fmtTime(e.start_time)}</div>
        </div>
        <div class="event-card-capacity">
          <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${pct}%"></div></div>
          <span>${regCount}/${e.capacity}</span>
        </div>
        <div class="event-card-actions">
          ${isRegistered
            ? `<button class="btn btn-secondary btn-sm qr-btn" data-event-id="${e.id}" data-event-title="${e.title}">Get QR</button>
               <button class="btn btn-danger btn-sm cancel-btn" data-event-id="${e.id}" data-event-title="${e.title}">Cancel</button>`
            : `<button class="btn btn-primary btn-sm register-btn" data-event-id="${e.id}" ${full ? 'disabled' : ''}>${full ? 'Full' : 'Register'}</button>`
          }
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.register-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Registering…';
      const { ok, body } = await Api.post(`/participant/events/${btn.dataset.eventId}/register`);
      if (ok) { showToast('Registered!'); loadAll(); }
      else    { showToast(body.message || 'Failed', 'error'); btn.disabled = false; btn.textContent = 'Register'; }
    });
  });

  el.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm({
        icon: '🗓️', title: 'Cancel registration?',
        msg: `You'll lose your spot for <strong>${btn.dataset.eventTitle}</strong>.`,
        confirmTxt: 'Yes, cancel', cancelTxt: 'Keep it', danger: true,
        onConfirm: async () => {
          const { ok, body } = await Api.put(`/participant/events/${btn.dataset.eventId}/cancel`);
          if (ok) { showToast('Registration cancelled'); loadAll(); }
          else    { showToast(body.message || 'Failed', 'error'); }
        }
      });
    });
  });

  el.querySelectorAll('.qr-btn').forEach(btn => {
    btn.addEventListener('click', () => openQR(btn.dataset.eventId, btn.dataset.eventTitle));
  });
}

// ── QR Modal ──
async function openQR(eventId, eventTitle) {
  const modal = document.getElementById('qrModal');
  const img   = document.getElementById('qrImg');
  const dl    = document.getElementById('qrDownload');
  document.getElementById('qrEventName').textContent = eventTitle;
  img.src = '';
  modal.classList.remove('hidden');
  const token = sessionStorage.getItem('token');
  //const url   = `${window.API_BASE_URL || 'http://localhost:5000/api'}/participant/events/${eventId}/qr`;
  const url   = `${window.API_BASE_URL || 'http://localhost:5000/api'}/participant/events/${eventId}/qr`;
  try {
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const obj  = URL.createObjectURL(blob);
    img.src = obj; dl.href = obj; dl.download = `qr_event_${eventId}.png`;
  } catch {
    showToast('Could not load QR', 'error');
    modal.classList.add('hidden');
  }
}

document.getElementById('qrModalClose').addEventListener('click', () => document.getElementById('qrModal').classList.add('hidden'));
document.getElementById('qrModal').addEventListener('click', function(e) { if (e.target === this) this.classList.add('hidden'); });

// ── Load ──
async function loadAll() {
  const [regsRes, certsRes, eventsRes] = await Promise.all([
    Api.get('/participant/registrations'),
    Api.get('/participant/certificates'),
    Api.get('/participant/events'),
  ]);
  const regs   = regsRes.ok   ? regsRes.body.data   : [];
  const certs  = certsRes.ok  ? certsRes.body.data  : [];
  const events = eventsRes.ok ? eventsRes.body.data : [];

  const attended = regs.filter(r => r.status === 'registered' && r.event?.is_completed).length;
  document.getElementById('statRegistered').textContent = regs.filter(r => r.status === 'registered').length;
  document.getElementById('statAttended').textContent   = attended;
  document.getElementById('statCerts').textContent      = certs.length;

  renderUpcoming(regs);
  renderCerts(certs);
  renderEvents(events, regs);
}

loadAll();
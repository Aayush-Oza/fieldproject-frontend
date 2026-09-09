// frontend/js/participant/events.js

if (!Auth.isLoggedIn()) window.location.href = '../login.html';

const NAV_LINKS = [
  { href: 'dashboard.html', label: 'Dashboard' },
  { href: 'events.html', label: 'Events' },
  { href: 'my-registrations.html', label: 'My Registrations' },
  { href: 'my-certificates.html', label: 'Certificates' },
];

Auth.initNav({ links: NAV_LINKS, active: 'Events' });

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
function fmtDate(d) { return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtTime(t) {
  const [h, m] = t.split(':');
  const d = new Date(); d.setHours(+h, +m);
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}

let allEvents = [];
let myRegIds = new Set();

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
    const isCompleted = e.is_completed;
    return `
      <div class="event-card">
        <div class="event-card-top">
          <h3 class="event-card-title">${e.title}</h3>
          ${isRegistered ? '<span class="badge badge-green">Registered</span>' : ''}
        </div>
        ${e.description ? `<p class="event-card-desc">${e.description}</p>` : ''}
        <div class="event-card-meta">
          <div class="event-card-meta-row"><span class="event-card-meta-icon">📍</span>${e.venue}</div>
          <div class="event-card-meta-row"><span class="event-card-meta-icon">🗓</span>${fmtDate(e.event_date)} · ${fmtTime(e.start_time)} – ${fmtTime(e.end_time)}</div>
        </div>
        <div class="event-card-capacity">
          <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${pct}%"></div></div>
          <span>${regCount}/${e.capacity}</span>
        </div>
        <div class="event-card-actions">
  ${isCompleted
        ? `<button class="btn btn-secondary btn-sm" disabled>Completed</button>`
        : isRegistered
          ? `<button class="btn btn-secondary btn-sm qr-btn" ...>Get QR</button>
         <button class="btn btn-danger btn-sm cancel-btn" ...>Cancel</button>`
          : `<button class="btn btn-primary btn-sm register-btn" ... ${full ? 'disabled' : ''}>${full ? 'Full' : 'Register'}</button>`
      }
</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.register-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Registering…';
      const { ok, body } = await Api.post(`/participant/events/${btn.dataset.eventId}/register`);
      if (ok) { showToast('Registered!'); await loadAll(); }
      else { showToast(body.message || 'Failed', 'error'); btn.disabled = false; btn.textContent = 'Register'; }
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
          if (ok) { showToast('Registration cancelled'); await loadAll(); }
          else { showToast(body.message || 'Failed', 'error'); }
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
  const img = document.getElementById('qrImg');
  const dl = document.getElementById('qrDownload');
  document.getElementById('qrEventName').textContent = eventTitle;
  img.src = ''; modal.classList.remove('hidden');
  const token = sessionStorage.getItem('token');
  //const url   = `${window.API_BASE_URL || 'http://localhost:5000/api'}/participant/events/${eventId}/qr`;
  const url = `${window.API_BASE_URL || 'http://localhost:5000/api'}/participant/events/${eventId}/qr`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    img.src = obj; dl.href = obj; dl.download = `qr_event_${eventId}.png`;
  } catch {
    showToast('Could not load QR', 'error');
    modal.classList.add('hidden');
  }
}

document.getElementById('qrModalClose').addEventListener('click', () => document.getElementById('qrModal').classList.add('hidden'));
document.getElementById('qrModal').addEventListener('click', function (e) { if (e.target === this) this.classList.add('hidden'); });

document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('statusFilter').addEventListener('change', render);

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
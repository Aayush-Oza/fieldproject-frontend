// frontend/js/participant/registrations.js

if (!Auth.isLoggedIn()) window.location.href = '../login';

const NAV_LINKS = [
  { href: 'dashboard', label: 'Dashboard' },
  { href: 'events', label: 'Events' },
  { href: 'my-registrations', label: 'My Registrations' },
  { href: 'my-certificates', label: 'Certificates' },
];

Auth.initNav({ links: NAV_LINKS, active: 'My Registrations' });

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
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(t) {
  const [h, m] = t.split(':');
  const d = new Date(); d.setHours(+h, +m);
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}

let allRegs = [];
let activeFilter = 'all';

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

function render() {
  const el = document.getElementById('regList');
  const filtered = activeFilter === 'all' ? allRegs : allRegs.filter(r => r.status === activeFilter);

  if (!filtered.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p class="empty-state-title">No registrations found</p>
        <p class="empty-state-desc">${activeFilter === 'all' ? 'Browse events and register to get started.' : 'Nothing in this category yet.'}</p>
        ${activeFilter === 'all' ? '<a href="events" class="btn btn-primary btn-sm mt-2">Browse events</a>' : ''}
      </div>`;
    return;
  }

  el.innerHTML = filtered.map(r => {
    const event = r.event;
    const cancelled = r.status === 'cancelled';
    const completed = event?.is_completed;
    return `
      <div class="reg-item ${cancelled ? 'reg-cancelled' : ''}">
        <div class="reg-item-left">
          <div class="reg-event-title">${event?.title || 'Event'}</div>
          <div class="reg-event-meta">
            ${event ? `📍 ${event.venue} &nbsp;·&nbsp; 🗓 ${fmtDate(event.event_date)} · ${fmtTime(event.start_time)}` : ''}
          </div>
          <div class="reg-meta-row">Registered on ${fmtDate(r.registered_at)}</div>
        </div>
        <div class="reg-item-right">
          <span class="badge ${cancelled ? 'badge-red' : completed ? 'badge-slate' : 'badge-green'}">
            ${cancelled ? 'Cancelled' : completed ? 'Completed' : 'Active'}
          </span>
          ${!cancelled && !completed ? `
            <button class="btn btn-secondary btn-sm qr-btn" data-event-id="${event?.id}" data-event-title="${event?.title}">QR Code</button>
          ` : ''}
          ${completed && !cancelled ? `<button class="btn btn-success btn-sm cert-btn" data-event-id="${event?.id}">Certificate</button>` : ''}
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.qr-btn').forEach(btn => {
    btn.addEventListener('click', () => openQR(btn.dataset.eventId, btn.dataset.eventTitle));
  });

  el.querySelectorAll('.cert-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { ok, body } = await Api.get(`/participant/events/${btn.dataset.eventId}/certificate`);
      if (ok) window.location.href = 'my-certificates';
      else showToast(body?.message || 'Could not get certificate', 'error');
    });
  });
}

// ── QR Modal ──
async function openQR(eventId, eventTitle) {
  const modal = document.getElementById('qrModal');
  const img = document.getElementById('qrImg');
  const dl = document.getElementById('qrDownload');
  document.getElementById('qrEventName').textContent = eventTitle;
  img.src = '';
  modal.classList.remove('hidden');
  try {
    const res = await Api.get(`/participant/events/${eventId}/qr`);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
    const url = res.body.data.qr_url;
    img.src = url;
    dl.href = url;
    dl.download = `qr_event_${eventId}.png`;
  } catch (err) {
    showToast('Could not load QR', 'error');
    modal.classList.add('hidden');
  }
}

document.getElementById('qrModalClose').addEventListener('click', () => document.getElementById('qrModal').classList.add('hidden'));
document.getElementById('qrModal').addEventListener('click', function (e) { if (e.target === this) this.classList.add('hidden'); });

async function load() {
  const { ok, body } = await Api.get('/participant/registrations');
  allRegs = ok ? body.data : [];
  render();
}

load();
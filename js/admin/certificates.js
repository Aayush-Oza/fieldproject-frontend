// frontend/js/admin/certificates.js
// Requires: api.js, auth.js, admin-hamburger.js
//
// REST endpoints used:
//   GET /admin/events               → all events (with registration_count)
//   GET /admin/occupancy            → checkin_count per event
//   GET /admin/certificates/count   → total eligible certificates

document.addEventListener('DOMContentLoaded', init);

let allRows = [];   // cached for filtering

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
async function init() {
  const user = getUser();
  if (!user) { window.location.href = '../login'; return; }
  if (user.role !== 'admin') {
    window.location.href = user.role === 'volunteer'
      ? '../volunteer/dashboard'
      : '../participant/dashboard';
    return;
  }

  document.getElementById('searchInput')?.addEventListener('input', applyFilters);
  document.getElementById('statusFilter')?.addEventListener('change', applyFilters);

  await loadData();
}

/* ══════════════════════════════════════════
   LOAD
══════════════════════════════════════════ */
async function loadData() {
  try {
    // Fetch all three in parallel
    const [eventsRes, occupancyRes, certCountRes] = await Promise.all([
      Api.get('/admin/events'),
      Api.get('/admin/occupancy'),
      Api.get('/admin/certificates/count'),
    ]);

    if (!eventsRes.ok || !eventsRes.body?.success) throw new Error('Failed to load events');

    const events = eventsRes.body.data || [];
    const occupancy = toArray(occupancyRes.body?.data);   // may fail gracefully
    const certCount = certCountRes.body?.data?.count ?? '-';

    // Build occupancy lookup: event id → checkin_count
    const checkinMap = {};
    occupancy.forEach(o => {
      const id = o.event_id ?? o.id;
      if (id != null) checkinMap[id] = Number(o.checkin_count || 0);
    });

    // Stats
    const total = events.length;
    const completed = events.filter(e => e.is_completed).length;
    document.getElementById('statTotalEvents').textContent = total;
    document.getElementById('statCompletedEvents').textContent = completed;
    document.getElementById('statEligible').textContent = certCount;

    // Build rows
    allRows = events.map(e => ({
      id: e.id,
      title: e.title || '-',
      event_date: e.event_date || '',
      venue: e.venue || '-',
      capacity: e.capacity ?? 0,
      registered: e.registration_count ?? 0,
      checkin: checkinMap[e.id] ?? 0,
      is_completed: e.is_completed,
      is_published: e.is_published,
    }));

    applyFilters();

  } catch (err) {
    console.error('[Certificates]', err);
    setTbody(`<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--slate)">${esc(err.message)}</td></tr>`);
    showToast('Could not load certificate data.', true);
  }
}

/* ══════════════════════════════════════════
   FILTER + RENDER
══════════════════════════════════════════ */
function applyFilters() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const status = document.getElementById('statusFilter')?.value || 'all';

  const filtered = allRows.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search);
    const matchStatus =
      status === 'all' ? true :
        status === 'completed' ? r.is_completed :
          status === 'active' ? !r.is_completed :
            true;
    return matchSearch && matchStatus;
  });

  const countEl = document.getElementById('tableCount');
  if (countEl) countEl.textContent = `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    setTbody('<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--slate)">No events match your filters.</td></tr>');
    return;
  }

  renderTable(filtered);
}

/* ══════════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════════ */
function renderTable(rows) {
  const tbody = rows.map(r => {
    const statusBadge = r.is_completed
      ? '<span class="badge badge-green">Completed</span>'
      : r.is_published
        ? '<span class="badge badge-blue">Active</span>'
        : '<span class="badge badge-amber">Draft</span>';

    // eligible = checked in (checkin implies registered + attended)
    const eligible = r.checkin;

    return `
      <tr>
        <td><strong>${esc(r.title)}</strong></td>
        <td>${fmtDate(r.event_date)}</td>
        <td>${esc(r.venue)}</td>
        <td>${r.capacity}</td>
        <td>${r.registered}</td>
        <td>${r.checkin}</td>
        <td>
          <span style="font-weight:700;color:${eligible > 0 ? 'var(--green)' : 'var(--slate)'}">
            ${eligible}
          </span>
        </td>
        <td>${statusBadge}</td>
      </tr>`;
  }).join('');

  setTbody(tbody);
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function setTbody(html) {
  const el = document.getElementById('certTableBody');
  if (el) el.innerHTML = html;
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.occupancy)) return data.occupancy;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); }
  catch { return null; }
}

function fmtDate(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
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
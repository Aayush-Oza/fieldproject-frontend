// frontend/js/admin/certificates.js
// Admin certificate oversight - reads all events + their stats,
// displays eligibility counts per event (read-only).

document.addEventListener('DOMContentLoaded', () => {

  // ── auth guard ──
  const token = localStorage.getItem('token');
  const role  = localStorage.getItem('role');
  if (!token || role !== 'admin') {
    window.location.href = '../login.html';
    return;
  }

  // ── nav user info ──
  const name = localStorage.getItem('name') || 'Admin';
  const navName    = document.getElementById('navName');
  const drawerName = document.getElementById('drawerName');
  if (navName)    navName.textContent    = name;
  if (drawerName) drawerName.textContent = name;

  // ── logout ──
  const logoutHandler = () => {
    localStorage.clear();
    window.location.href = '../login.html';
  };
  document.getElementById('logoutBtn')?.addEventListener('click', logoutHandler);
  document.getElementById('drawerLogout')?.addEventListener('click', logoutHandler);

  // ── mobile hamburger ──
  const hamburger = document.getElementById('hamburger');
  const navDrawer = document.getElementById('navDrawer');
  hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navDrawer.classList.toggle('open');
  });

  // ── state ──
  let allEvents = [];   // raw event list
  let statsMap  = {};   // event_id → stats object

  // ── DOM refs ──
  const tbody        = document.getElementById('certTableBody');
  const searchInput  = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const tableCount   = document.getElementById('tableCount');
  const statTotalEvents     = document.getElementById('statTotalEvents');
  const statCompletedEvents = document.getElementById('statCompletedEvents');
  const statEligible        = document.getElementById('statEligible');

  // ── helpers ──
  function showToast(msg, type = 'error') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = `toast toast-${type}`;
    setTimeout(() => t.classList.add('toast-hide'), 3000);
    setTimeout(() => { t.className = 'toast hidden'; }, 3400);
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function statusBadge(event) {
    if (event.is_completed) return '<span class="badge badge-slate">Completed</span>';
    if (event.is_published)  return '<span class="badge badge-green">Published</span>';
    return '<span class="badge badge-amber">Draft</span>';
  }

  // ── fetch all events then stats ──
  async function loadData() {
    tbody.innerHTML = `<tr><td colspan="8"><div class="loading-state"><div class="spinner"></div></div></td></tr>`;

    const evRes = await Api.get('/admin/events');
    if (!evRes.ok) {
      showToast(evRes.body.message || 'Failed to load events');
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--slate);padding:2rem;">Failed to load events.</td></tr>`;
      return;
    }

    allEvents = evRes.body.data || [];

    // Update summary stats header
    statTotalEvents.textContent     = allEvents.length;
    statCompletedEvents.textContent = allEvents.filter(e => e.is_completed).length;

    // Fetch stats for all events in parallel
    const statsResults = await Promise.allSettled(
      allEvents.map(e => Api.get(`/admin/events/${e.id}/stats`))
    );

    let totalCheckedIn = 0;
    statsResults.forEach((res, i) => {
      const id = allEvents[i].id;
      if (res.status === 'fulfilled' && res.value.ok) {
        statsMap[id] = res.value.body.data;
        totalCheckedIn += statsMap[id].total_checkedin || 0;
      } else {
        statsMap[id] = null;
      }
    });

    statEligible.textContent = totalCheckedIn;

    renderTable();
  }

  // ── render filtered table ──
  function renderTable() {
    const query  = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;

    let list = allEvents.filter(e => {
      const matchSearch = e.title.toLowerCase().includes(query) ||
                          (e.venue || '').toLowerCase().includes(query);
      let matchStatus = true;
      if (filter === 'completed') matchStatus = e.is_completed;
      if (filter === 'active')    matchStatus = !e.is_completed;
      return matchSearch && matchStatus;
    });

    tableCount.textContent = `${list.length} event${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <div class="empty-state-icon">🎓</div>
              <div class="empty-state-title">No events found</div>
              <div class="empty-state-desc">Try adjusting your search or filter.</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(e => {
      const stats      = statsMap[e.id];
      const registered = stats ? stats.total_registered  : '-';
      const checkedIn  = stats ? stats.total_checkedin   : '-';

      // eligible = checked-in count (cert is auto-issued on check-in)
      let eligibleHtml;
      if (!stats) {
        eligibleHtml = '<span class="text-slate">-</span>';
      } else if (stats.total_checkedin === 0) {
        eligibleHtml = '<span class="text-slate">0</span>';
      } else {
        eligibleHtml = `<span class="text-green font-semi">${stats.total_checkedin}</span>`;
      }

      return `
        <tr>
          <td>${e.title}</td>
          <td>${fmtDate(e.event_date)}</td>
          <td>${e.venue || '-'}</td>
          <td>${e.capacity}</td>
          <td>${registered}</td>
          <td>${checkedIn}</td>
          <td>${eligibleHtml}</td>
          <td>${statusBadge(e)}</td>
        </tr>`;
    }).join('');
  }

  // ── filter listeners ──
  searchInput.addEventListener('input', renderTable);
  statusFilter.addEventListener('change', renderTable);

  // ── init ──
  loadData();
});
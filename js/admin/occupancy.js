// frontend/js/admin/occupancy.js
// Requires: socket.io CDN, api.js, auth.js, admin-hamburger.js
//
// Socket events used:
//   emit  → join_dashboard          (join admin room)
//   emit  → request_occupancy       (manual refresh per event)
//   on    → dashboard_update        { events: [...] }
//   on    → occupancy_update        single event object
//
// REST fallback:
//   GET /admin/occupancy            if socket fails to connect

let socket = null;
let occupancyMap = {};   // event_id → occupancy object
let socketOk = false;

document.addEventListener('DOMContentLoaded', init);

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
async function init() {
  const user = getUser();
  if (!user) { window.location.href = '../login.html'; return; }
  if (user.role !== 'admin') {
    window.location.href = user.role === 'volunteer'
      ? '../volunteer/dashboard.html'
      : '../participant/dashboard.html';
    return;
  }

  document.getElementById('refreshBtn')?.addEventListener('click', manualRefresh);

  connectSocket();

  // REST fallback after 3 s if socket hasn't delivered data
  setTimeout(() => {
    if (!socketOk) {
      console.warn('[Occupancy] Socket slow — falling back to REST');
      loadRest();
    }
  }, 3000);
}

/* ══════════════════════════════════════════
   SOCKET
══════════════════════════════════════════ */
function connectSocket() {
  setStatus('connecting');
  if (typeof io === 'undefined') {
    console.warn('[Occupancy] socket.io not loaded — falling back to REST');
    setStatus('error');
    loadRest();
    return;
  }
  try {
    // ✅ To this:
    socket = io('https://fieldproject-backend.onrender.com', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
  } catch (err) {
    console.error('[Occupancy] Socket init failed:', err);
    setStatus('error');
    loadRest();
    return;
  }

  socket.on('connect', () => {
    setStatus('live');
    socket.emit('join_dashboard');
  });

  socket.on('disconnect', () => {
    setStatus('disconnected');
    socketOk = false;
  });

  socket.on('connect_error', () => {
    setStatus('error');
    if (!socketOk) loadRest();
  });

  // All-events push from admin dashboard room
  socket.on('dashboard_update', ({ events }) => {
    socketOk = true;
    if (Array.isArray(events)) {
      events.forEach(ev => { occupancyMap[ev.event_id] = ev; });
      render();
    }
  });

  // Single-event push (from request_occupancy or after checkin)
  socket.on('occupancy_update', (data) => {
    socketOk = true;
    if (data?.event_id) {
      occupancyMap[data.event_id] = data;
      render();
    }
  });

  socket.on('error', (err) => {
    console.error('[Occupancy] Socket error:', err);
  });
}

/* ══════════════════════════════════════════
   REST FALLBACK
══════════════════════════════════════════ */
async function loadRest() {
  try {
    const res = await Api.get('/admin/occupancy');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
    const events = toArray(res.body.data);
    events.forEach(ev => { occupancyMap[ev.event_id] = ev; });
    render();
    setStatus('rest');
  } catch (err) {
    console.error('[Occupancy] REST fallback failed:', err);
    setGrid('<div class="empty-state"><div class="empty-state-icon">📡</div><div class="empty-state-title">Unable to load occupancy</div></div>');
    setTbody('occupancyTableBody', 5, 'Unable to load data.');
    showToast('Could not load occupancy data.', true);
  }
}

/* ══════════════════════════════════════════
   MANUAL REFRESH
══════════════════════════════════════════ */
function manualRefresh() {
  if (socket?.connected) {
    // Re-join dashboard room to get a fresh push
    socket.emit('join_dashboard');
    showToast('Refreshing…');
  } else {
    loadRest();
  }
}

/* ══════════════════════════════════════════
   RENDER
══════════════════════════════════════════ */
function render() {
  const events = Object.values(occupancyMap)
    .sort((a, b) => Number(b.fill_rate_pct || 0) - Number(a.fill_rate_pct || 0));

  if (!events.length) {
    setGrid('<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📊</div><div class="empty-state-title">No live events</div><div class="empty-state-desc">Events will appear here once check-ins begin.</div></div>');
    setTbody('occupancyTableBody', 5, 'No events to display.');
    return;
  }

  renderCards(events);
  renderTable(events);
  setLastUpdated();
}

/* ── CARDS ── */
function renderCards(events) {
  const grid = document.getElementById('occupancyGrid');
  if (!grid) return;

  grid.innerHTML = events.map(ev => {
    const fill = Math.min(100, Number(ev.fill_rate_pct || 0));
    const checked = Number(ev.checkin_count || 0);
    const capacity = Number(ev.capacity || 0);
    const { cls, label, ring } = statusInfo(fill);

    return `
      <div class="card" style="display:flex;flex-direction:column;gap:1rem;border-top:3px solid ${ring}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">
          <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;line-height:1.3;flex:1">
            ${esc(ev.event_title || 'Event')}
          </div>
          <span class="badge ${cls}">${label}</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-family:var(--font-head);font-size:2rem;font-weight:700;line-height:1;color:var(--white)">${checked}</div>
            <div style="font-size:0.75rem;color:var(--slate);margin-top:0.2rem">checked in of ${capacity}</div>
          </div>
          <div style="font-family:var(--font-head);font-size:1.5rem;font-weight:700;color:${ring}">${fmtNum(fill)}%</div>
        </div>

        <div class="capacity-bar">
          <div class="capacity-fill ${fill >= 100 ? 'full' : fill >= 80 ? 'near-full' : ''}" style="width:${fill}%"></div>
        </div>
      </div>`;
  }).join('');
}

/* ── TABLE ── */
function renderTable(events) {
  const tbody = document.getElementById('occupancyTableBody');
  if (!tbody) return;

  tbody.innerHTML = events.map(ev => {
    const fill = Math.min(100, Number(ev.fill_rate_pct || 0));
    const checked = Number(ev.checkin_count || 0);
    const capacity = Number(ev.capacity || 0);
    const { cls, label } = statusInfo(fill);

    return `
      <tr>
        <td><strong>${esc(ev.event_title || 'Event')}</strong></td>
        <td>${checked}</td>
        <td>${capacity}</td>
        <td>
          <div style="display:flex;align-items:center;gap:0.65rem">
            <div class="capacity-bar" style="width:80px;flex-shrink:0">
              <div class="capacity-fill ${fill >= 100 ? 'full' : fill >= 80 ? 'near-full' : ''}" style="width:${fill}%"></div>
            </div>
            <span style="font-size:0.82rem;font-weight:600">${fmtNum(fill)}%</span>
          </div>
        </td>
        <td><span class="badge ${cls}">${label}</span></td>
      </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function statusInfo(fill) {
  if (fill >= 100) return { cls: 'badge-red', label: 'Full', ring: 'var(--red)' };
  if (fill >= 80) return { cls: 'badge-amber', label: 'Near capacity', ring: 'var(--amber)' };
  return { cls: 'badge-green', label: 'Safe', ring: 'var(--green)' };
}

function setStatus(state) {
  const el = document.getElementById('socketStatus');
  if (!el) return;
  const map = {
    connecting: '⚪ Connecting…',
    live: '🟢 Live',
    disconnected: '🔴 Disconnected',
    error: '🔴 Socket error',
    rest: '🟡 Polling (no socket)',
  };
  el.textContent = map[state] || '⚪ Unknown';
}

function setLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (el) el.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

function setGrid(html) {
  const el = document.getElementById('occupancyGrid');
  if (el) el.innerHTML = html;
}

function setTbody(id, cols, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:2rem;color:var(--slate)">${msg}</td></tr>`;
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); }
  catch { return null; }
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.occupancy)) return data.occupancy;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : '0';
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
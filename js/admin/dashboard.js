// frontend/js/admin/dashboard.js
// Requires: api.js, auth.js, admin-hamburger.js

document.addEventListener('DOMContentLoaded', initDashboard);

/* ── INIT ── */
async function initDashboard() {
  const user = getUser();
  if (!user) { window.location.href = '../login.html'; return; }
  if (user.role !== 'admin') {
    window.location.href = user.role === 'volunteer'
      ? '../volunteer/dashboard.html'
      : '../participant/dashboard.html';
    return;
  }

  // Greeting
  const name = user.name || user.full_name || user.email || 'Admin';
  setText('greetingName', name);

  await Promise.allSettled([
    loadStats(),
    loadUpcomingEvents(),
    loadOccupancySnapshot(),
    loadRecentUsers(),
  ]);
}

/* ── AUTH HELPER ── */
function getUser() {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ══════════════════════════════════════════
   STATS
══════════════════════════════════════════ */
async function loadStats() {
  try {
    const [eventsRes, usersRes] = await Promise.all([
      Api.get('/admin/events'),
      Api.get('/admin/users'),
    ]);

    if (eventsRes.ok && eventsRes.body?.success) {
      const events = toArray(eventsRes.body.data);
      setText('statEvents',    events.length);
      setText('statPublished', events.filter(e => e.is_published).length);
      setText('statCompleted', events.filter(e => e.is_completed).length);
    }

    if (usersRes.ok && usersRes.body?.success) {
      const users = toArray(usersRes.body.data);
      setText('statUsers',      users.length);
      setText('statVolunteers', users.filter(u => u.role === 'volunteer').length);
    }
  } catch (err) {
    console.error('[Dashboard] Stats:', err);
    showToast('Some stats could not be loaded.', true);
  }

  // Certificate count — optional endpoint, fails silently if not yet added
  try {
    const certsRes = await Api.get('/admin/certificates/count');
    if (certsRes.ok && certsRes.body?.success) {
      setText('statCerts', certsRes.body.data?.count ?? '-');
    }
  } catch (_) {
    // endpoint not yet deployed — leave as '-'
  }
}

/* ══════════════════════════════════════════
   UPCOMING EVENTS
══════════════════════════════════════════ */
async function loadUpcomingEvents() {
  const el = document.getElementById('upcomingList');
  if (!el) return;

  try {
    const res = await Api.get('/admin/events');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message);

    const upcoming = toArray(res.body.data)
      .filter(e => !e.is_completed)
      .sort(byEventDate)
      .slice(0, 5);

    if (!upcoming.length) {
      el.innerHTML = emptyState('📅', 'No upcoming events.', '<a href="create-event.html">Create your first event</a>');
      return;
    }

    el.innerHTML = upcoming.map(renderUpcomingEvent).join('');
  } catch (err) {
    console.error('[Dashboard] Upcoming:', err);
    el.innerHTML = `
      <div class="dash-empty">
        <p>Unable to load upcoming events.</p>
        <button class="btn btn-secondary" onclick="loadUpcomingEvents()">Retry</button>
      </div>`;
  }
}

function renderUpcomingEvent(ev) {
  const date       = ev.event_date ? new Date(`${ev.event_date}T00:00:00`) : null;
  const day        = date ? date.getDate() : '-';
  const mon        = date ? date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : '';
  const dateLabel  = date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set';
  const timeLabel  = fmtTime(ev.start_time);
  const registered = Number(ev.registration_count ?? 0);
  const capacity   = Number(ev.capacity ?? 0);
  const fill       = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
  const published  = ev.is_published === true;

  return `
    <div class="dash-event-item">
      <div class="dash-event-date">
        <span class="dash-event-date-day">${esc(day)}</span>
        <span class="dash-event-date-mon">${esc(mon)}</span>
      </div>
      <div class="dash-event-info">
        <div class="dash-event-title">${esc(ev.title || 'Untitled')}</div>
        <div class="dash-event-meta">${esc(dateLabel)}${timeLabel ? ` · ${esc(timeLabel)}` : ''} · ${esc(ev.venue || 'Venue TBD')}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.35rem;flex-shrink:0">
        <span class="badge ${published ? 'badge-blue' : 'badge-slate'}">${published ? 'Published' : 'Draft'}</span>
        <span style="font-size:0.75rem;color:var(--slate)">${registered}/${capacity}</span>
        <div class="capacity-bar" style="width:80px">
          <div class="capacity-fill ${fill >= 100 ? 'full' : fill >= 80 ? 'near-full' : ''}" style="width:${fill}%"></div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   LIVE OCCUPANCY
══════════════════════════════════════════ */
async function loadOccupancySnapshot() {
  const el = document.getElementById('occupancySnap');
  if (!el) return;

  try {
    const res = await Api.get('/admin/occupancy');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message);

    const items = toArray(res.body.data)
      .sort((a, b) => Number(b.fill_rate_pct || 0) - Number(a.fill_rate_pct || 0))
      .slice(0, 5);

    if (!items.length) {
      el.innerHTML = emptyState('📊', 'No live events right now.');
      return;
    }

    el.innerHTML = items.map(renderOccupancy).join('');
  } catch (err) {
    console.error('[Dashboard] Occupancy:', err);
    el.innerHTML = '<div class="dash-empty"><p>Live occupancy unavailable.</p></div>';
  }
}

function renderOccupancy(item) {
  const fill      = Math.min(100, Number(item.fill_rate_pct || 0));
  const checked   = Number(item.checkin_count || 0);
  const capacity  = Number(item.capacity || 0);
  const statusCls = fill >= 100 ? 'badge-red' : fill >= 80 ? 'badge-amber' : 'badge-green';
  const statusTxt = fill >= 100 ? 'Full' : fill >= 80 ? 'Near capacity' : 'Safe';

  return `
    <div class="dash-event-item" style="flex-direction:column;align-items:stretch;gap:0.5rem">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:0.9rem">${esc(item.event_title || 'Event')}</strong>
        <span class="badge ${statusCls}">${statusTxt}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:var(--slate)">
        <span>${checked} / ${capacity} checked in</span>
        <span style="font-weight:600;color:var(--white)">${fmtNum(fill)}%</span>
      </div>
      <div class="capacity-bar">
        <div class="capacity-fill ${fill >= 100 ? 'full' : fill >= 80 ? 'near-full' : ''}" style="width:${fill}%"></div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   RECENT USERS
══════════════════════════════════════════ */
async function loadRecentUsers() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;

  try {
    const res = await Api.get('/admin/users');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message);

    const users = toArray(res.body.data)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 10);

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(renderUserRow).join('');
  } catch (err) {
    console.error('[Dashboard] Users:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Unable to load users.</td></tr>';
  }
}

function renderUserRow(u) {
  const name    = u.name || u.full_name || 'Unnamed';
  const email   = u.email || '-';
  const role    = u.role || 'participant';
  const joined  = u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const active  = u.is_active !== false;
  const initials = name.trim().split(/\s+/).filter(Boolean).reduce((acc, w, i, arr) =>
    i === 0 ? w[0].toUpperCase() : i === arr.length - 1 ? acc + w[0].toUpperCase() : acc, '');

  return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:0.65rem">
          <div style="width:32px;height:32px;border-radius:50%;background:rgba(59,111,232,0.15);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:var(--blue-light);flex-shrink:0">${esc(initials || 'U')}</div>
          <div>
            <div style="font-weight:600;font-size:0.875rem">${esc(name)}</div>
            <div style="font-size:0.75rem;color:var(--slate)">${esc(email)}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${roleBadge(role)}">${esc(cap(role))}</span></td>
      <td style="font-size:0.82rem">${esc(joined)}</td>
      <td><span style="font-size:0.78rem;font-weight:600;color:${active ? 'var(--green)' : 'var(--slate)'}">${active ? 'Active' : 'Disabled'}</span></td>
    </tr>`;
}

/* ══════════════════════════════════════════
   SMALL HELPERS
══════════════════════════════════════════ */
function toArray(data) {
  if (Array.isArray(data))           return data;
  if (Array.isArray(data?.items))    return data.items;
  if (Array.isArray(data?.events))   return data.events;
  if (Array.isArray(data?.users))    return data.users;
  if (Array.isArray(data?.occupancy)) return data.occupancy;
  return [];
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cap(s) { return String(s||'').replace(/^\w/, c => c.toUpperCase()); }

function fmtTime(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = Number(m[1]); const min = m[2];
  const p = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${p}`;
}

function fmtNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : '0';
}

function byEventDate(a, b) {
  return new Date(`${a.event_date||'9999-12-31'}T${a.start_time||'00:00'}`)
       - new Date(`${b.event_date||'9999-12-31'}T${b.start_time||'00:00'}`);
}

function roleBadge(role) {
  return { admin: 'badge-blue', volunteer: 'badge-green', participant: 'badge-amber' }[role] || 'badge-slate';
}

function emptyState(icon, msg, extra = '') {
  return `<div class="dash-empty" style="text-align:center;padding:2rem;color:var(--slate)">
    <div style="font-size:2rem;margin-bottom:0.5rem">${icon}</div>
    <p>${msg}</p>${extra}
  </div>`;
}

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast${isError ? ' toast-error' : ' toast-success'}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('toast-hide'), 3200);
  setTimeout(() => { toast.className = 'toast hidden'; }, 3700);
}
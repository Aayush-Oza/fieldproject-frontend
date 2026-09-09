// frontend/js/volunteer/dashboard.js
// Requires: api.js, auth.js, hamburger.js
//
// REST endpoints:
//   GET /volunteer/assignments         → my assigned events (returns assignment dicts)
//   GET /volunteer/assignments/:id/event → full event details per assignment

document.addEventListener('DOMContentLoaded', init);

let assignments = [];

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
async function init() {
  const user = getUser();
  if (!user) { window.location.href = '../login'; return; }
  if (user.role !== 'volunteer') {
    window.location.href = user.role === 'admin'
      ? '../admin/dashboard'
      : '../participant/dashboard';
    return;
  }

  const name = user.full_name || user.name || user.email || 'Volunteer';
  const greet = document.getElementById('greetingName');
  if (greet) greet.textContent = name;

  await loadAssignments();
}

/* ══════════════════════════════════════════
   LOAD
══════════════════════════════════════════ */
async function loadAssignments() {
  try {
    const res = await Api.get('/volunteer/assignments');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed to load');

    assignments = res.body.data || [];

    // Fetch full event details for each assignment in parallel
    const eventResults = await Promise.all(
      assignments.map(a =>
        Api.get(`/volunteer/assignments/${a.event_id}/event`)
          .then(r => r.body?.success ? { ...a, event: r.body.data } : { ...a, event: null })
          .catch(() => ({ ...a, event: null }))
      )
    );

    renderStats(eventResults);
    renderTable(eventResults);

  } catch (err) {
    console.error('[Volunteer Dashboard]', err);
    setTbody('<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--slate)">Unable to load assignments.</td></tr>');
    showToast('Could not load assignments.', true);
  }
}

/* ══════════════════════════════════════════
   STATS
══════════════════════════════════════════ */
function renderStats(rows) {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = rows.filter(r => r.event && r.event.event_date >= today && !r.event.is_completed).length;
  const completed = rows.filter(r => r.event?.is_completed).length;

  document.getElementById('statAssigned').textContent = rows.length;
  document.getElementById('statUpcoming').textContent = upcoming;
  document.getElementById('statCompleted').textContent = completed;
}

/* ══════════════════════════════════════════
   TABLE
══════════════════════════════════════════ */
function renderTable(rows) {
  if (!rows.length) {
    setTbody('<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--slate)">No assignments yet. Ask an admin to assign you to an event.</td></tr>');
    return;
  }

  const html = rows.map(row => {
    const ev = row.event;
    if (!ev) {
      return `<tr>
        <td colspan="4" style="color:var(--slate)">Event #${row.event_id} (details unavailable)</td>
        <td>-</td><td>-</td>
      </tr>`;
    }

    const statusBadge = ev.is_completed
      ? '<span class="badge badge-slate">Completed</span>'
      : ev.is_published
        ? '<span class="badge badge-blue">Active</span>'
        : '<span class="badge badge-amber">Draft</span>';

    const date = fmtDate(ev.event_date);
    const timeRange = `${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}`;

    return `
      <tr>
        <td><strong>${esc(ev.title)}</strong></td>
        <td style="font-size:0.82rem">${date}<br><span style="color:var(--slate)">${timeRange}</span></td>
        <td>${esc(ev.venue)}</td>
        <td>${esc(row.duty || '-')}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
            <a href="scanner?event_id=${ev.id}" class="btn btn-primary btn-sm">📷 Scan</a>
            <a href="checkin-log?event_id=${ev.id}" class="btn btn-secondary btn-sm">Log</a>
          </div>
        </td>
      </tr>`;
  }).join('');

  setTbody(html);
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function setTbody(html) {
  const el = document.getElementById('assignmentsBody');
  if (el) el.innerHTML = html;
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); }
  catch { return null; }
}

function fmtDate(iso) {
  if (!iso) return '-';
  try { return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function fmtTime(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  let h = Number(m[1]); const min = m[2], p = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${min} ${p}`;
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
// frontend/js/admin/volunteers.js
// Requires: api.js, auth.js, admin-hamburger.js
// Backend routes used:
//   GET    /admin/users
//   PUT    /admin/users/:id/make-volunteer
//   PUT    /admin/users/:id/make-participant
//   GET    /admin/events
//   GET    /admin/events/:id/volunteers
//   POST   /admin/events/:id/volunteers   { volunteer_id, duty }
//   DELETE /admin/events/:id/volunteers/:vol_id

let allUsers = [];   // every user
let allEvents = [];   // for assignment dropdown
let activeTab = 'volunteers';
let selectedEventId = null;

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

  bindUI();

  // Load users + events in parallel
  await Promise.allSettled([loadUsers(), loadEvents()]);
}

/* ══════════════════════════════════════════
   DATA LOADING
══════════════════════════════════════════ */
async function loadUsers() {
  try {
    const res = await Api.get('/admin/users');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
    allUsers = toArray(res.body.data);
    renderVolunteers();
    renderUsers();
  } catch (err) {
    console.error('[Volunteers] Users:', err);
    setTbody('volTableBody', 4, 'Unable to load volunteers.');
    setTbody('userTableBody', 5, 'Unable to load users.');
    showToast('Could not load users.', true);
  }
}

async function loadEvents() {
  try {
    const res = await Api.get('/admin/events');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
    allEvents = toArray(res.body.data).filter(e => !e.is_completed);
    populateEventDropdown();
  } catch (err) {
    console.error('[Volunteers] Events:', err);
  }
}

async function loadAssignments(eventId) {
  setTbody('assignTableBody', 5, 'Loading…');
  try {
    const res = await Api.get(`/admin/events/${eventId}/volunteers`);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
    renderAssignments(toArray(res.body.data), eventId);
  } catch (err) {
    console.error('[Volunteers] Assignments:', err);
    setTbody('assignTableBody', 5, 'Unable to load assignments.');
  }
}

/* ══════════════════════════════════════════
   RENDER - VOLUNTEERS TAB
══════════════════════════════════════════ */
function renderVolunteers() {
  const tbody = document.getElementById('volTableBody');
  if (!tbody) return;
  const search = document.getElementById('volSearch')?.value.trim().toLowerCase() || '';

  const vols = allUsers.filter(u => {
    if (u.role !== 'volunteer') return false;
    if (search && !`${u.name || ''} ${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(search)) return false;
    return true;
  });

  if (!vols.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--slate)">
      ${search ? 'No volunteers match your search.' : 'No volunteers yet. Promote a user from the Users tab.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = vols.map(u => {
    const name = u.name || u.full_name || 'Unnamed';
    const joined = fmtDate(u.created_at);
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:0.65rem">
        ${avatar(name)}
        <strong>${esc(name)}</strong>
      </div></td>
      <td style="color:var(--slate);font-size:0.85rem">${esc(u.email || '-')}</td>
      <td style="font-size:0.82rem">${esc(joined)}</td>
      <td>
        <button class="btn btn-danger btn-sm" data-action="demote" data-id="${u.id}">Demote</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-action="demote"]').forEach(btn => {
    btn.addEventListener('click', () => demoteUser(Number(btn.dataset.id)));
  });
}

/* ══════════════════════════════════════════
   RENDER - USERS TAB
══════════════════════════════════════════ */
function renderUsers() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  const search = document.getElementById('userSearch')?.value.trim().toLowerCase() || '';
  const role = document.getElementById('roleFilter')?.value || '';

  const users = allUsers.filter(u => {
    if (role && u.role !== role) return false;
    if (search && !`${u.name || ''} ${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(search)) return false;
    return true;
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--slate)">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const name = u.name || u.full_name || 'Unnamed';
    const role = u.role || 'participant';
    const joined = fmtDate(u.created_at);
    const isAdmin = role === 'admin';

    let actionBtn = '';
    if (!isAdmin) {
      if (role === 'volunteer') {
        actionBtn = `<button class="btn btn-danger btn-sm" data-action="demote" data-id="${u.id}">Demote</button>`;
      } else {
        actionBtn = `<button class="btn btn-success btn-sm" data-action="promote" data-id="${u.id}">Make Volunteer</button>`;
      }
    }

    return `<tr>
      <td><div style="display:flex;align-items:center;gap:0.65rem">
        ${avatar(name)}
        <div>
          <div style="font-weight:600;font-size:0.875rem">${esc(name)}</div>
          <div style="font-size:0.75rem;color:var(--slate)">${esc(u.email || '-')}</div>
        </div>
      </div></td>
      <td style="font-size:0.82rem;color:var(--slate)">${esc(u.email || '-')}</td>
      <td><span class="badge ${roleBadge(role)}">${esc(cap(role))}</span></td>
      <td style="font-size:0.82rem">${esc(joined)}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'promote') promoteUser(id);
      if (btn.dataset.action === 'demote') demoteUser(id);
    });
  });
}

/* ══════════════════════════════════════════
   RENDER - ASSIGNMENTS TAB
══════════════════════════════════════════ */
function populateEventDropdown() {
  const sel = document.getElementById('assignEventFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select an event…</option>' +
    allEvents.map(e => `<option value="${e.id}">${esc(e.title || 'Untitled')}</option>`).join('');
}

function renderAssignments(assignments, eventId) {
  const tbody = document.getElementById('assignTableBody');
  if (!tbody) return;

  if (!assignments.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">No volunteers assigned</div>
        <div class="empty-state-desc">Click "+ Assign Volunteer" to add one.</div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = assignments.map(a => {
    const name = a.volunteer_name || a.name || a.full_name || 'Unnamed';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:0.65rem">
        ${avatar(name)}
        <strong>${esc(name)}</strong>
      </div></td>
      <td style="font-size:0.82rem;color:var(--slate)">${esc(a.volunteer_email || a.email || '-')}</td>
      <td>${a.duty ? `<span class="badge badge-slate">${esc(a.duty)}</span>` : '<span style="color:var(--slate);font-size:0.8rem">-</span>'}</td>
      <td style="font-size:0.82rem">${esc(fmtDate(a.assigned_at || a.created_at))}</td>
      <td>
        <button class="btn btn-danger btn-sm" data-action="remove" data-vol-id="${a.volunteer_id || a.user_id || a.id}" data-event-id="${eventId}">Remove</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', () => removeAssignment(Number(btn.dataset.eventId), Number(btn.dataset.volId)));
  });
}

/* ══════════════════════════════════════════
   USER ROLE ACTIONS
══════════════════════════════════════════ */
async function promoteUser(userId) {
  const u = allUsers.find(x => x.id === userId);
  if (!u) return;
  showConfirm({
    icon: '⬆️',
    title: 'Make volunteer?',
    msg: `Promote <strong>${u.name || u.email}</strong> to volunteer role?`,
    confirmTxt: 'Yes, promote',
    cancelTxt: 'Cancel',
    danger: false,
    onConfirm: async () => {
      try {
        const res = await Api.put(`/admin/users/${userId}/make-volunteer`);
        if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
        showToast('User promoted to volunteer.');
        await loadUsers();
      } catch (err) {
        showToast(err.message || 'Could not promote user.', true);
      }
    }
  });
  return;
}

async function demoteUser(userId) {
  const u = allUsers.find(x => x.id === userId);
  if (!u) return;
  showConfirm({
    icon: '⬇️',
    title: 'Demote user?',
    msg: `Demote <strong>${u.name || u.email}</strong> back to participant?`,
    confirmTxt: 'Yes, demote',
    cancelTxt: 'Cancel',
    danger: true,
    onConfirm: async () => {
      try {
        const res = await Api.put(`/admin/users/${userId}/make-participant`);
        if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
        showToast('User demoted to participant.');
        await loadUsers();
      } catch (err) {
        showToast(err.message || 'Could not demote user.', true);
      }
    }
  });
  return;
}

/* ══════════════════════════════════════════
   ASSIGNMENT ACTIONS
══════════════════════════════════════════ */
function openAssignModal() {
  if (!selectedEventId) { showToast('Select an event first.', true); return; }

  // Populate volunteer dropdown - exclude already assigned if possible
  const sel = document.getElementById('assignVolSelect');
  const vols = allUsers.filter(u => u.role === 'volunteer');
  if (!vols.length) {
    showToast('No volunteers available. Promote a user first.', true);
    return;
  }
  sel.innerHTML = vols.map(v =>
    `<option value="${v.id}">${esc(v.name || v.full_name || v.email)}</option>`
  ).join('');

  document.getElementById('assignDuty').value = '';
  hideAlert();
  showModal('assignModal');
}

async function doAssign() {
  const volId = Number(document.getElementById('assignVolSelect')?.value);
  const duty = document.getElementById('assignDuty')?.value.trim() || null;

  if (!volId) { showAlert('Select a volunteer.'); return; }

  const btn = document.getElementById('doAssignBtn');
  setBtnLoading(btn, 'Assigning…');

  try {
    const res = await Api.post(`/admin/events/${selectedEventId}/volunteers`, {
      volunteer_id: volId,
      duty,
    });
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
    closeModal('assignModal');
    showToast('Volunteer assigned.');
    await loadAssignments(selectedEventId);
  } catch (err) {
    showAlert(err.message || 'Could not assign volunteer.');
  } finally {
    setBtnLoading(btn, null);
  }
}

async function removeAssignment(eventId, volId) {
  showConfirm({
    icon: '🗑️',
    title: 'Remove volunteer?',
    msg: 'Remove this volunteer from the event?',
    confirmTxt: 'Yes, remove',
    cancelTxt: 'Cancel',
    danger: true,
    onConfirm: async () => {
      try {
        const res = await Api.delete(`/admin/events/${eventId}/volunteers/${volId}`);
        if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
        showToast('Volunteer removed.');
        await loadAssignments(eventId);
      } catch (err) {
        showToast(err.message || 'Could not remove volunteer.', true);
      }
    }
  });
  return;
}

/* ══════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════ */
function switchTab(tab) {
  activeTab = tab;
  ['volunteers', 'users', 'assignments'].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle('hidden', t !== tab);
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

/* ══════════════════════════════════════════
   UI BINDINGS
══════════════════════════════════════════ */
function bindUI() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Search filters
  document.getElementById('volSearch')?.addEventListener('input', renderVolunteers);
  document.getElementById('userSearch')?.addEventListener('input', renderUsers);
  document.getElementById('roleFilter')?.addEventListener('change', renderUsers);

  // Assignment event picker
  document.getElementById('assignEventFilter')?.addEventListener('change', e => {
    selectedEventId = Number(e.target.value) || null;
    if (selectedEventId) {
      loadAssignments(selectedEventId);
    } else {
      setTbody('assignTableBody', 5, 'Select an event above.');
    }
  });

  // Assign modal
  document.getElementById('assignVolBtn')?.addEventListener('click', openAssignModal);
  document.getElementById('doAssignBtn')?.addEventListener('click', doAssign);
  document.getElementById('assignModalClose')?.addEventListener('click', () => closeModal('assignModal'));
  document.getElementById('assignCancel')?.addEventListener('click', () => closeModal('assignModal'));
  document.getElementById('assignModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('assignModal');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal('assignModal');
  });
}

/* ══════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════ */
function showModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('hidden'); }
  if (id === 'assignModal') hideAlert();
}
function showAlert(msg) {
  const el = document.getElementById('assignAlert');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
function hideAlert() {
  const el = document.getElementById('assignAlert');
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}
function setBtnLoading(btn, text) {
  if (!btn) return;
  if (text) { btn.dataset.orig = btn.textContent; btn.disabled = true; btn.textContent = text; }
  else { btn.disabled = false; btn.textContent = btn.dataset.orig || 'Assign'; }
}

/* ══════════════════════════════════════════
   SMALL HELPERS
══════════════════════════════════════════ */
function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); }
  catch { return null; }
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.volunteers)) return data.volunteers;
  return [];
}

function setTbody(id, cols, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;padding:2rem;color:var(--slate)">${msg}</td></tr>`;
}

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cap(s) { return String(s || '').replace(/^\w/, c => c.toUpperCase()); }

function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return isNaN(dt) ? '-' : dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function roleBadge(r) {
  return { admin: 'badge-blue', volunteer: 'badge-green', participant: 'badge-amber' }[r] || 'badge-slate';
}

function avatar(name) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<div style="width:32px;height:32px;border-radius:50%;background:rgba(59,111,232,0.15);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:var(--blue-light);flex-shrink:0">${initials || '?'}</div>`;
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
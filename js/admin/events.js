// frontend/js/admin/events.js
// Requires: api.js, auth.js, admin-hamburger.js

let allEvents = [];
let editingId = null;

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
  await loadEvents();
}

/* ══════════════════════════════════════════
   LOAD & RENDER
══════════════════════════════════════════ */
async function loadEvents() {
  const tbody = document.getElementById('eventsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--slate)">Loading…</td></tr>';

  try {
    const res = await Api.get('/admin/events');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed to load');
    allEvents = toArray(res.body.data);
    renderTable();
  } catch (err) {
    console.error('[Events] Load:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--slate)">
      Unable to load events. <button class="btn btn-secondary btn-sm" onclick="loadEvents()" style="margin-left:0.5rem">Retry</button>
    </td></tr>`;
    showToast(err.message || 'Unable to load events.', true);
  }
}

function renderTable() {
  const tbody = document.getElementById('eventsTableBody');
  if (!tbody) return;

  const search = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  const status = document.getElementById('statusFilter')?.value || '';

  let events = allEvents.filter(ev => {
    // search
    if (search && !['title', 'description', 'venue'].some(k => String(ev[k] || '').toLowerCase().includes(search))) return false;
    // status
    if (status === 'published') return ev.is_published && !ev.is_completed;
    if (status === 'draft') return !ev.is_published && !ev.is_completed;
    if (status === 'completed') return ev.is_completed;
    return true;
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  if (!events.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--slate)">No events found.</td></tr>';
    return;
  }

  tbody.innerHTML = events.map(renderRow).join('');

  // Bind row actions via delegation
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'edit') openEdit(id);
      if (btn.dataset.action === 'stats') openStats(id);
      if (btn.dataset.action === 'delete') confirmDelete(id);
    });
  });
}

function renderRow(ev) {
  const id = Number(ev.id);
  const registered = Number(ev.registration_count || 0);
  const capacity = Number(ev.capacity || 0);
  const fill = capacity > 0 ? Math.min(100, Math.round(registered / capacity * 100)) : 0;
  const date = ev.event_date ? new Date(`${ev.event_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const timeRange = [fmtTime(ev.start_time), fmtTime(ev.end_time)].filter(Boolean).join(' – ') || '-';

  let badge;
  if (ev.is_completed) badge = '<span class="badge badge-slate">Completed</span>';
  else if (ev.is_published) badge = '<span class="badge badge-blue">Published</span>';
  else badge = '<span class="badge badge-slate">Draft</span>';

  return `
    <tr>
      <td><strong>${esc(ev.title || 'Untitled')}</strong></td>
      <td style="font-size:0.82rem">${esc(date)}<br><span style="color:var(--slate)">${esc(timeRange)}</span></td>
      <td>${esc(ev.venue || '-')}</td>
      <td>
        <span style="font-size:0.875rem">${registered} / ${capacity}</span>
        <div class="capacity-bar" style="margin-top:0.3rem">
          <div class="capacity-fill ${fill >= 100 ? 'full' : fill >= 80 ? 'near-full' : ''}" style="width:${fill}%"></div>
        </div>
      </td>
      <td>${badge}</td>
      <td>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
  <button class="btn btn-secondary btn-sm" data-action="stats"  data-id="${id}">Stats</button>
  <button class="btn btn-secondary btn-sm" data-action="edit"   data-id="${id}">Edit</button>
  ${!ev.is_completed && !ev.is_published ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${id}">Delete</button>` : ''}
</div>
      </td>
    </tr>`;
}

/* ══════════════════════════════════════════
   EDIT MODAL
══════════════════════════════════════════ */
function openEdit(id) {
  const ev = allEvents.find(e => Number(e.id) === id);
  if (!ev) return;
  editingId = id;

  setVal('editTitle', ev.title || '');
  setVal('editDesc', ev.description || '');
  setVal('editVenue', ev.venue || '');
  setVal('editCapacity', ev.capacity ?? '');
  setVal('editDate', ev.event_date || '');
  setVal('editStart', normTime(ev.start_time));
  setVal('editEnd', normTime(ev.end_time));
  hideAlert();
  // Show Publish button only for drafts
  const publishBtn = document.getElementById('publishBtn');
  if (publishBtn) {
    const isDraft = !ev.is_published && !ev.is_completed;
    publishBtn.classList.toggle('hidden', !isDraft);
  }
  showModal('editModal');
}

async function saveEdit() {
  if (!editingId) return;

  const body = {
    title: getVal('editTitle'),
    description: getVal('editDesc'),
    venue: getVal('editVenue'),
    capacity: Number(getVal('editCapacity')),
    event_date: getVal('editDate'),
    start_time: getVal('editStart'),
    end_time: getVal('editEnd'),
  };

  const err = validateForm(body);
  if (err) { showAlert(err); return; }

  const btn = document.getElementById('saveEditBtn');
  setBtnLoading(btn, 'Saving…');

  try {
    const res = await Api.put(`/admin/events/${editingId}`, body);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Update failed');
    closeModal('editModal');
    showToast('Event updated.');
    await loadEvents();
  } catch (err) {
    console.error('[Events] Save:', err);
    showAlert(err.message || 'Unable to update event.');
  } finally {
    setBtnLoading(btn, null);
  }
}

function validateForm(d) {
  if (!d.title) return 'Title is required.';
  if (!d.venue) return 'Venue is required.';
  if (!d.capacity || d.capacity <= 0) return 'Capacity must be greater than 0.';
  if (!d.event_date) return 'Date is required.';
  if (!d.start_time) return 'Start time is required.';
  if (!d.end_time) return 'End time is required.';
  if (d.start_time >= d.end_time) return 'Start time must be before end time.';
  return null;
}

/* ══════════════════════════════════════════
   STATS MODAL
══════════════════════════════════════════ */
async function openStats(id) {
  const ev = allEvents.find(e => Number(e.id) === id);
  if (!ev) return;

  const content = document.getElementById('statsContent');
  const title = document.getElementById('statsModalTitle');
  if (title) title.textContent = ev.title || 'Event Stats';
  if (content) content.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  showModal('statsModal');

  try {
    const res = await Api.get(`/admin/events/${id}/stats`);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message);
    renderStats(res.body.data || {});
  } catch (err) {
    console.error('[Events] Stats:', err);
    if (content) content.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--slate)">Unable to load stats.</div>';
  }
}

function renderStats(s) {
  const content = document.getElementById('statsContent');
  if (!content) return;

  const cap = Number(s.capacity || 0);
  const reg = Number(s.total_registered || 0);
  const checked = Number(s.total_checkedin || 0);
  const occ = Number(s.occupancy_percent || 0);
  const st = s.status || 'safe';
  const badgeCls = st === 'full' ? 'badge-red' : st === 'near' ? 'badge-amber' : 'badge-green';
  const badgeTxt = st === 'full' ? 'Full' : st === 'near' ? 'Near capacity' : 'Safe';

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
      ${[['Capacity', cap], ['Registered', reg], ['Checked in', checked], ['Occupancy', fmtNum(occ) + '%']].map(([label, val]) => `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:var(--radius);padding:1rem;text-align:center">
          <div style="font-size:0.75rem;color:var(--slate);margin-bottom:0.3rem">${label}</div>
          <div style="font-size:1.5rem;font-weight:700;font-family:var(--font-head)">${val}</div>
        </div>`).join('')}
    </div>
    <div style="text-align:center"><span class="badge ${badgeCls}">${badgeTxt}</span></div>`;
}

/* ══════════════════════════════════════════
   DELETE
══════════════════════════════════════════ */
function confirmDelete(id) {
  const ev = allEvents.find(e => Number(e.id) === id);
  if (!ev) return;

  // Simple native confirm - no showConfirm dependency
  showConfirm({
    icon: '🗑️',
    title: 'Delete event?',
    msg: `This will permanently delete <strong>${ev.title}</strong>. This cannot be undone.`,
    confirmTxt: 'Yes, delete',
    cancelTxt: 'Cancel',
    danger: true,
    onConfirm: () => doDelete(id)
  });
}

async function doDelete(id) {
  try {
    const res = await Api.delete(`/admin/events/${id}`);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Delete failed');
    showToast('Event deleted.');
    await loadEvents();
  } catch (err) {
    console.error('[Events] Delete:', err);
    showToast(err.message || 'Unable to delete event.', true);
  }
}

/* ══════════════════════════════════════════
   UI BINDINGS
══════════════════════════════════════════ */
function bindUI() {
  document.getElementById('searchInput')?.addEventListener('input', renderTable);
  document.getElementById('statusFilter')?.addEventListener('change', renderTable);
  document.getElementById('publishBtn')?.addEventListener('click', publishEvent);
  document.getElementById('saveEditBtn')?.addEventListener('click', saveEdit);
  document.getElementById('editModalClose')?.addEventListener('click', () => closeModal('editModal'));
  document.getElementById('editCancel')?.addEventListener('click', () => closeModal('editModal'));
  document.getElementById('statsModalClose')?.addEventListener('click', () => closeModal('statsModal'));

  // Backdrop click closes
  ['editModal', 'statsModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal(id);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal('editModal'); closeModal('statsModal'); }
  });
}

/* ══════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════ */
function showModal(id) { document.getElementById(id)?.classList.replace('hidden', 'open') || document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('open');
  if (id === 'editModal') { editingId = null; hideAlert(); }
}

function showAlert(msg) {
  const el = document.getElementById('editAlert');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideAlert() {
  const el = document.getElementById('editAlert');
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

function setBtnLoading(btn, loadingText) {
  if (!btn) return;
  if (loadingText) {
    btn.dataset.orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = loadingText;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.orig || 'Save Changes';
  }
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
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function getVal(id) { return document.getElementById(id)?.value.trim() || ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = Number(m[1]); const min = m[2], p = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${min} ${p}`;
}

function fmtNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : '0';
}

function normTime(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? String(Number(m[1])).padStart(2, '0') + ':' + m[2] : String(t);
}

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.classList.add('toast-hide'); }, 3200);
  setTimeout(() => { toast.className = 'toast hidden'; }, 3700);
}
async function publishEvent() {
  if (!editingId) return;
  const btn = document.getElementById('publishBtn');
  setBtnLoading(btn, 'Publishing…');
  try {
    const res = await Api.put(`/admin/events/${editingId}`, { is_published: true });
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');
    closeModal('editModal');
    showToast('Event published!');
    await loadEvents();
  } catch (err) {
    showAlert(err.message || 'Could not publish event.');
  } finally {
    setBtnLoading(btn, null);
    document.getElementById('publishBtn').dataset.orig = 'Publish';
  }
}
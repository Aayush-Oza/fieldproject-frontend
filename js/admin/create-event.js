// frontend/js/admin/create-event.js
// Requires: api.js, auth.js, admin-hamburger.js

document.addEventListener('DOMContentLoaded', init);

function init() {
  const user = getUser();
  if (!user) { window.location.href = '../login.html'; return; }
  if (user.role !== 'admin') {
    window.location.href = user.role === 'volunteer'
      ? '../volunteer/dashboard.html'
      : '../participant/dashboard.html';
    return;
  }

  document.getElementById('createBtn')?.addEventListener('click', createEvent);
  document.getElementById('previewForecastBtn')?.addEventListener('click', previewForecast);
}

/* ══════════════════════════════════════════
   CREATE EVENT
══════════════════════════════════════════ */
async function createEvent() {
  hideAlert();

  const body = {
    title:        getVal('title'),
    description:  getVal('description'),
    venue:        getVal('venue'),
    capacity:     Number(getVal('capacity')),
    event_date:   getVal('event_date'),
    start_time:   getVal('start_time'),
    end_time:     getVal('end_time'),
    is_published: document.getElementById('is_published')?.checked || false,
  };

  const err = validate(body);
  if (err) { showAlert(err); return; }

  const btn = document.getElementById('createBtn');
  setLoading(btn, 'Creating…');

  try {
    const res = await Api.post('/admin/events', body);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed to create event');
    showToast('Event created!');
    setTimeout(() => { window.location.href = 'events.html'; }, 1000);
  } catch (err) {
    showAlert(err.message || 'Unable to create event.');
  } finally {
    setLoading(btn, null);
  }
}

/* ══════════════════════════════════════════
   FORECAST PREVIEW
══════════════════════════════════════════ */
async function previewForecast() {
  const capacity   = getVal('capacity');
  const event_date = getVal('event_date');
  const start_time = getVal('start_time');
  const end_time   = getVal('end_time');

  const el = document.getElementById('forecastPreview');
  if (!capacity || !event_date || !start_time || !end_time) {
    if (el) el.textContent = 'Fill in Capacity, Date, Start and End Time first.';
    return;
  }

  if (el) el.textContent = 'Running forecast…';

  try {
    const res = await Api.post('/admin/forecast/preview', {
      capacity:         Number(capacity),
      venue:            getVal('venue') || 'unknown',
      event_date,
      start_time:       start_time + ':00',
      end_time:         end_time   + ':00',
      registered_count: 0,
    });

    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Forecast failed');

    const d = res.body.data;
    if (el) el.innerHTML = `
      Predicted attendance: <strong style="color:var(--white)">${d.predicted_attendance}</strong>
      of ${d.capacity} capacity
      &nbsp;·&nbsp;
      <strong style="color:var(--white)">${d.utilization_pct}%</strong> utilization`;
  } catch (err) {
    if (el) el.textContent = `Forecast unavailable: ${err.message}`;
  }
}

/* ══════════════════════════════════════════
   VALIDATE
══════════════════════════════════════════ */
function validate(d) {
  if (!d.title)                       return 'Title is required.';
  if (!d.venue)                       return 'Venue is required.';
  if (!d.capacity || d.capacity <= 0) return 'Capacity must be greater than 0.';
  if (!d.event_date)                  return 'Event date is required.';
  if (!d.start_time)                  return 'Start time is required.';
  if (!d.end_time)                    return 'End time is required.';
  if (d.start_time >= d.end_time)     return 'Start time must be before end time.';
  return null;
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); }
  catch { return null; }
}

function getVal(id) {
  return document.getElementById(id)?.value.trim() || '';
}

function showAlert(msg) {
  const el = document.getElementById('formAlert');
  if (!el) return;
  el.innerHTML = `<div class="alert alert-error">${esc(msg)}</div>`;
}

function hideAlert() {
  const el = document.getElementById('formAlert');
  if (el) el.innerHTML = '';
}

function setLoading(btn, text) {
  if (!btn) return;
  if (text) {
    btn.dataset.orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = text;
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.orig || 'Create Event';
  }
}

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
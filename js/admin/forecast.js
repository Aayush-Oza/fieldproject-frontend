// frontend/js/admin/forecast.js
// Requires: api.js, auth.js
//
// REST endpoints used:
//   GET  /admin/forecast/status            → model status
//   GET  /admin/forecast/events/:id        → forecast for saved event
//   POST /admin/forecast/preview           → forecast from manual form
//   GET  /admin/events                     → populate event dropdown

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

  // nav name
  const navName = document.getElementById('navName');
  if (navName) navName.textContent = user.name || user.email || 'Admin';

  // logout
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('drawerLogout')?.addEventListener('click', logout);

  initTabs();
  await loadModelStatus();
  await loadEvents();

  document.getElementById('eventSelect')?.addEventListener('change', onEventSelect);
  document.getElementById('runForecastBtn')?.addEventListener('click', runSavedForecast);
  document.getElementById('runPreviewBtn')?.addEventListener('click', runPreviewForecast);
}

/* ══════════════════════════════════════════
   TABS
══════════════════════════════════════════ */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.dataset.tab;
      document.getElementById('tabSaved').classList.toggle('hidden', tab !== 'saved');
      document.getElementById('tabPreview').classList.toggle('hidden', tab !== 'preview');
    });
  });
}

/* ══════════════════════════════════════════
   MODEL STATUS
══════════════════════════════════════════ */
async function loadModelStatus() {
  const wrap = document.getElementById('modelStatusWrap');
  if (!wrap) return;

  try {
    const res = await Api.get('/admin/forecast/status');
    if (!res.ok || !res.body?.success) throw new Error();

    const d = res.body.data;
    if (d.model_trained) {
      wrap.innerHTML = `
        <div class="model-status ready">
          <span class="model-status-dot"></span>
          Model Ready · ${d.model_size_kb} KB · updated ${fmtDate(d.last_modified)}
        </div>`;
    } else {
      wrap.innerHTML = `
        <div class="model-status not-ready">
          <span class="model-status-dot"></span>
          Model not trained - run <code>python -m ai.train</code>
        </div>`;
    }
  } catch {
    wrap.innerHTML = `
      <div class="model-status not-ready">
        <span class="model-status-dot"></span>
        Could not reach model status
      </div>`;
  }
}

/* ══════════════════════════════════════════
   LOAD EVENTS INTO SELECT
══════════════════════════════════════════ */
async function loadEvents() {
  const select = document.getElementById('eventSelect');
  if (!select) return;

  try {
    const res = await Api.get('/admin/events');
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Failed');

    const events = res.body.data || [];
    if (!events.length) {
      select.innerHTML = '<option value="">No events found</option>';
      return;
    }

    select.innerHTML = '<option value="">- choose an event -</option>' +
      events.map(e => `<option value="${e.id}" data-json='${esc(JSON.stringify(e))}'>${esc(e.title)}</option>`).join('');
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load events</option>';
    showToast('Could not load events.', true);
  }
}

/* ══════════════════════════════════════════
   EVENT SELECT → INFO PREVIEW
══════════════════════════════════════════ */
function onEventSelect() {
  const select = document.getElementById('eventSelect');
  const info = document.getElementById('eventInfo');
  const runBtn = document.getElementById('runForecastBtn');
  const opt = select.options[select.selectedIndex];

  if (!select.value) {
    info?.classList.add('hidden');
    if (runBtn) runBtn.disabled = true;
    return;
  }

  try {
    const ev = JSON.parse(opt.dataset.json);
    document.getElementById('infoVenue').textContent = ev.venue || '-';
    document.getElementById('infoDate').textContent = fmtDate(ev.event_date) || '-';
    document.getElementById('infoTime').textContent = `${ev.start_time || '-'} – ${ev.end_time || '-'}`;
    document.getElementById('infoCapacity').textContent = ev.capacity || '-';
    info?.classList.remove('hidden');
    if (runBtn) runBtn.disabled = false;
  } catch {
    info?.classList.add('hidden');
    if (runBtn) runBtn.disabled = true;
  }
}

/* ══════════════════════════════════════════
   RUN FORECAST - SAVED EVENT
══════════════════════════════════════════ */
async function runSavedForecast() {
  const eventId = document.getElementById('eventSelect')?.value;
  if (!eventId) return;

  const btn = document.getElementById('runForecastBtn');
  setLoading(btn, true);
  setResultLoading('savedResult');

  try {
    const res = await Api.get(`/admin/forecast/events/${eventId}`);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Forecast failed');
    renderResult('savedResult', res.body.data);
  } catch (err) {
    renderError('savedResult', err.message);
    showToast(err.message, true);
  } finally {
    setLoading(btn, false);
  }
}

/* ══════════════════════════════════════════
   RUN FORECAST - PREVIEW
══════════════════════════════════════════ */
async function runPreviewForecast() {
  const errEl = document.getElementById('previewFormError');
  errEl?.classList.add('hidden');

  const capacity = document.getElementById('preCapacity')?.value;
  const date = document.getElementById('preDate')?.value;
  const start = document.getElementById('preStart')?.value;
  const end = document.getElementById('preEnd')?.value;

  // Validate
  if (!capacity || !date || !start || !end) {
    if (errEl) {
      errEl.textContent = 'Capacity, Date, Start Time and End Time are required.';
      errEl.classList.remove('hidden');
    }
    return;
  }
  if (Number(capacity) < 1) {
    if (errEl) {
      errEl.textContent = 'Capacity must be at least 1.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  const btn = document.getElementById('runPreviewBtn');
  setLoading(btn, true);
  setResultLoading('previewResult');

  const payload = {
    capacity: Number(capacity),
    venue: document.getElementById('preVenue')?.value || 'unknown',
    event_date: date,
    start_time: start + ':00',
    end_time: end + ':00',
    registered_count: Number(document.getElementById('preRegistered')?.value || 0),
  };

  try {
    const res = await Api.post('/admin/forecast/preview', payload);
    if (!res.ok || !res.body?.success) throw new Error(res.body?.message || 'Forecast failed');
    renderResult('previewResult', res.body.data);
  } catch (err) {
    renderError('previewResult', err.message);
    showToast(err.message, true);
  } finally {
    setLoading(btn, false);
  }
}

/* ══════════════════════════════════════════
   RENDER RESULT
══════════════════════════════════════════ */
function renderResult(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const predicted = data.predicted_attendance ?? 0;
  const capacity = data.capacity ?? 0;
  const util = data.utilization_pct ?? 0;
  const features = data.features_used || {};

  const barClass = util >= 100 ? 'full' : util >= 80 ? 'high' : '';
  const utilCapped = Math.min(util, 100);

  el.innerHTML = `
    <div class="forecast-result">

      <div>
        <div class="forecast-number">${predicted}</div>
        <div class="forecast-label">Predicted attendees out of ${capacity} capacity</div>
      </div>

      <div class="util-bar-wrap">
        <div class="util-bar-header">
          <span>Utilization</span>
          <span>${util}%</span>
        </div>
        <div class="util-bar-track">
          <div class="util-bar-fill ${barClass}" style="width:${utilCapped}%"></div>
        </div>
      </div>

      <div>
        <div style="font-size:0.75rem;color:var(--slate);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.6rem;">
          Features Used
        </div>
        <div class="features-grid">
          ${featureItem('Capacity', features.capacity ?? '-')}
          ${featureItem('Day of Week', dayName(features.day_of_week))}
          ${featureItem('Month', monthName(features.month))}
          ${featureItem('Start Hour', features.start_hour !== undefined ? `${features.start_hour}:00` : '-')}
          ${featureItem('Duration', features.duration_hours !== undefined ? `${features.duration_hours}h` : '-')}
          ${featureItem('Registrations', features.registered_count ?? 0)}
        </div>
      </div>

    </div>`;
}

function featureItem(key, val) {
  return `
    <div class="feature-item">
      <div class="feature-key">${key}</div>
      <div class="feature-val">${val}</div>
    </div>`;
}

function renderError(containerId, msg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="forecast-placeholder">
      <div class="forecast-placeholder-icon">⚠️</div>
      <div class="forecast-placeholder-text">${esc(msg)}</div>
    </div>`;
}

function setResultLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); }
  catch { return null; }
}

function logout() {
  sessionStorage.clear();
  window.location.href = '../login.html';
}

function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.textContent = on ? 'Running…' : (btn.id === 'runPreviewBtn' ? 'Preview Forecast' : 'Run Forecast');
}

function fmtDate(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

function dayName(n) {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][n] ?? '-';
}

function monthName(n) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][n - 1] ?? '-';
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
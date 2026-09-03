// frontend/js/admin/forecast.js
// AI Crowd Forecasting page.
// Tabs: (1) forecast a saved event, (2) preview forecast before saving.

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

  // ── DOM refs ──
  const modelStatusWrap = document.getElementById('modelStatusWrap');
  const tabBtns         = document.querySelectorAll('.tab-btn');
  const tabSaved        = document.getElementById('tabSaved');
  const tabPreview      = document.getElementById('tabPreview');

  // tab 1
  const eventSelect    = document.getElementById('eventSelect');
  const eventInfo      = document.getElementById('eventInfo');
  const runForecastBtn = document.getElementById('runForecastBtn');
  const savedResult    = document.getElementById('savedResult');

  // tab 2
  const preCapacity    = document.getElementById('preCapacity');
  const preVenue       = document.getElementById('preVenue');
  const preDate        = document.getElementById('preDate');
  const preStart       = document.getElementById('preStart');
  const preEnd         = document.getElementById('preEnd');
  const preRegistered  = document.getElementById('preRegistered');
  const previewFormErr = document.getElementById('previewFormError');
  const runPreviewBtn  = document.getElementById('runPreviewBtn');
  const previewResult  = document.getElementById('previewResult');

  // ── helpers ──
  function showToast(msg, type = 'error') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = `toast toast-${type}`;
    setTimeout(() => t.classList.add('toast-hide'), 3500);
    setTimeout(() => { t.className = 'toast hidden'; }, 3900);
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function fmtTime(t) {
    if (!t) return '—';
    // t can be "HH:MM:SS" or "HH:MM"
    const [h, m] = t.split(':');
    const d = new Date();
    d.setHours(+h, +m);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  // ── model status badge ──
  async function loadModelStatus() {
    const res = await Api.get('/admin/forecast/status');
    if (!res.ok) {
      modelStatusWrap.innerHTML = `<span class="model-status not-ready"><span class="model-status-dot"></span>Status unknown</span>`;
      return;
    }
    const d = res.body.data;
    if (d.model_trained) {
      const kb = d.model_size_kb ? `· ${d.model_size_kb} KB` : '';
      modelStatusWrap.innerHTML = `<span class="model-status ready"><span class="model-status-dot"></span>Model Ready ${kb}</span>`;
    } else {
      modelStatusWrap.innerHTML = `<span class="model-status not-ready"><span class="model-status-dot"></span>Model Not Trained</span>`;
    }
  }

  // ── load events into select ──
  async function loadEvents() {
    const res = await Api.get('/admin/events');
    if (!res.ok) { showToast('Failed to load events'); return; }
    const events = res.body.data || [];
    events.forEach(e => {
      const opt  = document.createElement('option');
      opt.value  = e.id;
      opt.textContent = `${e.title} — ${fmtDate(e.event_date)}`;
      // store data attrs for quick preview
      opt.dataset.venue    = e.venue || '';
      opt.dataset.date     = e.event_date || '';
      opt.dataset.start    = e.start_time || '';
      opt.dataset.end      = e.end_time || '';
      opt.dataset.capacity = e.capacity || '';
      eventSelect.appendChild(opt);
    });
  }

  // ── event select change → show info ──
  eventSelect.addEventListener('change', () => {
    const opt = eventSelect.options[eventSelect.selectedIndex];
    if (!opt.value) {
      eventInfo.classList.add('hidden');
      runForecastBtn.disabled = true;
      return;
    }
    document.getElementById('infoVenue').textContent    = opt.dataset.venue    || '—';
    document.getElementById('infoDate').textContent     = fmtDate(opt.dataset.date);
    document.getElementById('infoTime').textContent     = `${fmtTime(opt.dataset.start)} – ${fmtTime(opt.dataset.end)}`;
    document.getElementById('infoCapacity').textContent = opt.dataset.capacity || '—';
    eventInfo.classList.remove('hidden');
    runForecastBtn.disabled = false;
  });

  // ── build result HTML ──
  function buildResultHTML(data) {
    const pct        = data.utilization_pct ?? 0;
    const predicted  = data.predicted_attendance ?? 0;
    const capacity   = data.capacity ?? 0;
    const features   = data.features_used || {};

    const fillClass  = pct >= 100 ? 'full' : pct >= 80 ? 'high' : '';

    const featureLabels = {
      capacity:         'Capacity',
      day_of_week:      'Day of Week',
      month:            'Month',
      start_hour:       'Start Hour',
      duration_hours:   'Duration (hrs)',
      venue_encoded:    'Venue Code',
      registered_count: 'Registered',
    };

    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    const featuresHTML = Object.entries(features).map(([k, v]) => {
      const label = featureLabels[k] || k;
      const val   = k === 'day_of_week' ? (days[v] || v)
                  : k === 'duration_hours' ? `${v}h`
                  : v;
      return `
        <div class="feature-item">
          <div class="feature-key">${label}</div>
          <div class="feature-val">${val}</div>
        </div>`;
    }).join('');

    return `
      <div class="forecast-result">
        <div>
          <div class="forecast-number">${predicted}</div>
          <div class="forecast-label">Predicted Attendees of ${capacity} capacity</div>
        </div>

        <div class="util-bar-wrap">
          <div class="util-bar-header">
            <span>Utilization</span>
            <span>${pct}%</span>
          </div>
          <div class="util-bar-track">
            <div class="util-bar-fill ${fillClass}" style="width:${Math.min(pct,100)}%"></div>
          </div>
        </div>

        ${pct >= 100
          ? `<div class="alert alert-error">⚠️ Event is predicted to exceed capacity.</div>`
          : pct >= 80
          ? `<div class="alert alert-warning">⚡ Near capacity — consider reserving overflow.</div>`
          : `<div class="alert alert-success">✅ Comfortable occupancy predicted.</div>`
        }

        <div>
          <div class="section-label" style="margin-bottom:0.5rem;">Features Used by Model</div>
          <div class="features-grid">${featuresHTML}</div>
        </div>
      </div>`;
  }

  // ── run saved event forecast ──
  runForecastBtn.addEventListener('click', async () => {
    const id = eventSelect.value;
    if (!id) return;

    runForecastBtn.disabled    = true;
    runForecastBtn.textContent = 'Running…';
    savedResult.innerHTML      = `<div class="loading-state"><div class="spinner"></div></div>`;

    const res = await Api.get(`/admin/forecast/events/${id}`);

    runForecastBtn.disabled    = false;
    runForecastBtn.textContent = 'Run Forecast';

    if (!res.ok) {
      const msg = res.body.message || 'Forecast failed';
      savedResult.innerHTML = `<div class="alert alert-error">${msg}</div>`;
      showToast(msg);
      return;
    }

    savedResult.innerHTML = buildResultHTML(res.body.data);
  });

  // ── run preview forecast ──
  runPreviewBtn.addEventListener('click', async () => {
    previewFormErr.classList.add('hidden');

    const capacity = preCapacity.value.trim();
    const date     = preDate.value;
    const start    = preStart.value;
    const end      = preEnd.value;

    if (!capacity || !date || !start || !end) {
      previewFormErr.textContent = 'Capacity, date, start time and end time are required.';
      previewFormErr.classList.remove('hidden');
      return;
    }

    // convert HH:MM to HH:MM:SS for backend
    const toHMS = t => t.length === 5 ? `${t}:00` : t;

    const payload = {
      capacity:         parseInt(capacity, 10),
      venue:            preVenue.value.trim() || 'unknown',
      event_date:       date,
      start_time:       toHMS(start),
      end_time:         toHMS(end),
      registered_count: parseInt(preRegistered.value || '0', 10),
    };

    runPreviewBtn.disabled    = true;
    runPreviewBtn.textContent = 'Forecasting…';
    previewResult.innerHTML   = `<div class="loading-state"><div class="spinner"></div></div>`;

    const res = await Api.post('/admin/forecast/preview', payload);

    runPreviewBtn.disabled    = false;
    runPreviewBtn.textContent = 'Preview Forecast';

    if (!res.ok) {
      const msg = res.body.message || 'Forecast failed';
      previewResult.innerHTML = `<div class="alert alert-error">${msg}</div>`;
      showToast(msg);
      return;
    }

    previewResult.innerHTML = buildResultHTML(res.body.data);
  });

  // ── tab switching ──
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      tabSaved.classList.toggle('hidden', tab !== 'saved');
      tabPreview.classList.toggle('hidden', tab !== 'preview');
    });
  });

  // ── init ──
  loadModelStatus();
  loadEvents();
});
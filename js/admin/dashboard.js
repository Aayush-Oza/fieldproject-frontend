// Admin Dashboard
// Requires: api.js, auth.js, ui.js

document.addEventListener('DOMContentLoaded', () => {
  initNav({
    links: [
      { href: '/admin/dashboard.html', label: 'Dashboard' },
      { href: '/admin/events.html', label: 'Events' },
      { href: '/admin/volunteers.html', label: 'Volunteers' },
      { href: '/admin/occupancy.html', label: 'Occupancy' },
      { href: '/admin/forecast.html', label: 'Forecast' },
      { href: '/admin/certificates.html', label: 'Certificates' },
    ],
    active: 'Dashboard',
  });

  initDashboard();
});

async function initDashboard() {
  const user = Auth.getUser();

  if (!user) {
    window.location.href = '/login.html';
    return;
  }

  // Make sure this page is actually being used by an admin.
  if (user.role !== 'admin') {
    window.location.href =
      user.role === 'volunteer'
        ? '/volunteer/dashboard.html'
        : '/participant/dashboard.html';
    return;
  }

  setGreeting(user);
  bindDashboardEvents();

  await Promise.allSettled([
    loadDashboardStats(),
    loadUpcomingEvents(),
    loadOccupancySnapshot(),
    loadRecentUsers(),
  ]);
}

/* ============================================================
   GREETING
============================================================ */

function setGreeting(user) {
  const navName = document.getElementById('navName');
  const greetingName = document.getElementById('greetingName');

  const name =
    user?.name ||
    user?.full_name ||
    user?.email ||
    'Admin';

  if (navName) {
    navName.textContent = name;
  }

  if (greetingName) {
    greetingName.textContent = name;
  }
}

/* ============================================================
   DASHBOARD STATS
============================================================ */

async function loadDashboardStats() {
  try {
    const eventsResult = await Api.get('/admin/events');

    if (!eventsResult.ok || !eventsResult.body?.success) {
      throw new Error(
        eventsResult.body?.message || 'Unable to load events'
      );
    }

    const events = normalizeArray(eventsResult.body.data);

    const totalEvents = events.length;

    const publishedEvents = events.filter(
      (event) => event.is_published === true
    ).length;

    const completedEvents = events.filter(
      (event) => event.is_completed === true
    ).length;

    setText('statEvents', totalEvents);
    setText('statPublished', publishedEvents);
    setText('statCompleted', completedEvents);

    /*
     * User count and volunteer count are loaded separately.
     * We deliberately don't guess these from event data.
     */
    await Promise.all([
      loadUserStats(),
      loadCertificateStat(),
    ]);
  } catch (err) {
    console.error('[Admin Dashboard] Stats:', err);

    setText('statEvents', '—');
    setText('statPublished', '—');
    setText('statCompleted', '—');

    showToast(
      'Some dashboard statistics could not be loaded.',
      true
    );
  }
}

/* ============================================================
   USERS / VOLUNTEERS
============================================================ */

async function loadUserStats() {
  try {
    const result = await Api.get('/admin/users');

    if (!result.ok || !result.body?.success) {
      throw new Error(
        result.body?.message || 'Unable to load users'
      );
    }

    const users = normalizeArray(result.body.data);

    const volunteers = users.filter(
      (user) => user.role === 'volunteer'
    );

    setText('statUsers', users.length);
    setText('statVolunteers', volunteers.length);
  } catch (err) {
    console.error('[Admin Dashboard] User stats:', err);

    setText('statUsers', '—');
    setText('statVolunteers', '—');
  }
}

/* ============================================================
   CERTIFICATES
============================================================ */

async function loadCertificateStat() {
  /*
   * There is currently no confirmed admin certificate-list/count
   * endpoint in the backend supplied for this project.
   *
   * Therefore we intentionally don't invent an API call here.
   * The card stays as "—" until a real admin endpoint exists.
   */

  setText('statCerts', '—');
}

/* ============================================================
   UPCOMING EVENTS
============================================================ */

async function loadUpcomingEvents() {
  const container = document.getElementById('upcomingList');

  if (!container) return;

  setLoading(container, 'Loading upcoming events…');

  try {
    const result = await Api.get('/admin/events');

    if (!result.ok || !result.body?.success) {
      throw new Error(
        result.body?.message || 'Unable to load events'
      );
    }

    const events = normalizeArray(result.body.data);

    const upcoming = events
      .filter((event) => !event.is_completed)
      .sort(compareEvents)
      .slice(0, 5);

    if (!upcoming.length) {
      container.innerHTML = `
        <div class="dash-empty">
          <div class="dash-empty-icon">📅</div>
          <p>No upcoming events.</p>
          <a href="/admin/create-event.html">
            Create your first event
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = upcoming
      .map(renderUpcomingEvent)
      .join('');
  } catch (err) {
    console.error('[Admin Dashboard] Upcoming events:', err);

    container.innerHTML = `
      <div class="dash-empty">
        <p>Unable to load upcoming events.</p>
        <button
          type="button"
          class="btn btn-secondary"
          data-action="retry-upcoming"
        >
          Retry
        </button>
      </div>
    `;

    const retry = container.querySelector(
      '[data-action="retry-upcoming"]'
    );

    if (retry) {
      retry.addEventListener(
        'click',
        loadUpcomingEvents
      );
    }
  }
}

function renderUpcomingEvent(event) {
  const title = escapeHtml(
    event.title || 'Untitled event'
  );

  const venue = escapeHtml(
    event.venue || 'Venue not specified'
  );

  const date = formatDate(event.event_date);

  const startTime = formatTime(event.start_time);

  const registered =
    Number(event.registration_count ?? 0);

  const capacity =
    Number(event.capacity ?? 0);

  const fillRate =
    capacity > 0
      ? Math.min(
          100,
          Math.round((registered / capacity) * 100)
        )
      : 0;

  const published = event.is_published === true;

  return `
    <div class="dash-event-row">

      <div class="dash-event-date">
        <strong>${escapeHtml(getDay(event.event_date))}</strong>
        <span>${escapeHtml(getMonth(event.event_date))}</span>
      </div>

      <div class="dash-event-info">
        <h4>${title}</h4>

        <p>
          ${escapeHtml(date)}
          ${startTime ? ` · ${escapeHtml(startTime)}` : ''}
        </p>

        <p class="dash-event-venue">
          ${venue}
        </p>
      </div>

      <div class="dash-event-meta">

        <span class="dash-status ${
          published
            ? 'dash-status-success'
            : 'dash-status-muted'
        }">
          ${published ? 'Published' : 'Draft'}
        </span>

        <span class="dash-event-capacity">
          ${registered} / ${capacity}
        </span>

        <div class="dash-progress">
          <div
            class="dash-progress-bar"
            style="width:${fillRate}%"
          ></div>
        </div>

      </div>

    </div>
  `;
}

/* ============================================================
   LIVE OCCUPANCY
============================================================ */

async function loadOccupancySnapshot() {
  const container =
    document.getElementById('occupancySnap');

  if (!container) return;

  setLoading(container, 'Loading live occupancy…');

  try {
    const result =
      await Api.get('/admin/occupancy');

    if (!result.ok || !result.body?.success) {
      throw new Error(
        result.body?.message ||
          'Unable to load occupancy'
      );
    }

    const occupancy =
      normalizeArray(result.body.data);

    if (!occupancy.length) {
      container.innerHTML = `
        <div class="dash-empty">
          <div class="dash-empty-icon">📊</div>
          <p>No live events right now.</p>
        </div>
      `;
      return;
    }

    const sorted = occupancy
      .sort(
        (a, b) =>
          Number(b.fill_rate_pct || 0) -
          Number(a.fill_rate_pct || 0)
      )
      .slice(0, 5);

    container.innerHTML = sorted
      .map(renderOccupancy)
      .join('');
  } catch (err) {
    console.error(
      '[Admin Dashboard] Occupancy:',
      err
    );

    container.innerHTML = `
      <div class="dash-empty">
        <p>Live occupancy unavailable.</p>
      </div>
    `;
  }
}

function renderOccupancy(item) {
  const title = escapeHtml(
    item.event_title || 'Event'
  );

  const capacity = Number(
    item.capacity || 0
  );

  const checkedIn = Number(
    item.checkin_count || 0
  );

  const fillRate = Math.min(
    100,
    Number(item.fill_rate_pct || 0)
  );

  let status = 'Safe';

  if (fillRate >= 100) {
    status = 'Full';
  } else if (fillRate >= 80) {
    status = 'Near capacity';
  }

  return `
    <div class="dash-occupancy-row">

      <div class="dash-occupancy-main">
        <strong>${title}</strong>

        <span>
          ${checkedIn} / ${capacity} checked in
        </span>
      </div>

      <div class="dash-occupancy-right">

        <span class="dash-occupancy-percent">
          ${formatNumber(fillRate)}%
        </span>

        <span class="dash-status ${getOccupancyClass(fillRate)}">
          ${status}
        </span>

      </div>

      <div class="dash-progress">
        <div
          class="dash-progress-bar"
          style="width:${fillRate}%"
        ></div>
      </div>

    </div>
  `;
}

function getOccupancyClass(rate) {
  if (rate >= 100) {
    return 'dash-status-danger';
  }

  if (rate >= 80) {
    return 'dash-status-warning';
  }

  return 'dash-status-success';
}

/* ============================================================
   RECENT USERS
============================================================ */

async function loadRecentUsers() {
  const tbody =
    document.getElementById('userTableBody');

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="table-loading">
        Loading users…
      </td>
    </tr>
  `;

  try {
    const result =
      await Api.get('/admin/users');

    if (!result.ok || !result.body?.success) {
      throw new Error(
        result.body?.message ||
          'Unable to load users'
      );
    }

    const users =
      normalizeArray(result.body.data);

    const recent = users
      .sort(compareUsers)
      .slice(0, 10);

    if (!recent.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty">
            No users found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = recent
      .map(renderUserRow)
      .join('');
  } catch (err) {
    console.error(
      '[Admin Dashboard] Recent users:',
      err
    );

    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          Unable to load users.
        </td>
      </tr>
    `;
  }
}

function renderUserRow(user) {
  const name = escapeHtml(
    user.name ||
      user.full_name ||
      'Unnamed user'
  );

  const email = escapeHtml(
    user.email || '—'
  );

  const role = user.role || 'participant';

  const created = formatDateTime(
    user.created_at
  );

  const active =
    user.is_active !== false;

  return `
    <tr>

      <td>
        <div class="user-cell">
          <div class="user-avatar">
            ${escapeHtml(getInitials(name))}
          </div>

          <div>
            <strong>${name}</strong>
            <small>${email}</small>
          </div>
        </div>
      </td>

      <td>
        <span class="role-badge role-${escapeHtml(role)}">
          ${escapeHtml(capitalize(role))}
        </span>
      </td>

      <td>
        ${escapeHtml(created)}
      </td>

      <td>
        <span class="${
          active
            ? 'status-active'
            : 'status-inactive'
        }">
          ${active ? 'Active' : 'Disabled'}
        </span>
      </td>

    </tr>
  `;
}

/* ============================================================
   DASHBOARD CONTROLS
============================================================ */

function bindDashboardEvents() {
  const toggle =
    document.getElementById('toggleUserTable');

  const tableSection =
    document.getElementById('userTableSection');

  if (toggle && tableSection) {
    toggle.addEventListener('click', () => {
      const hidden =
        tableSection.classList.toggle('hidden');

      toggle.textContent =
        hidden
          ? 'Show users'
          : 'Hide users';
    });
  }

  const createEvent =
    document.querySelector(
      'a[href$="create-event.html"]'
    );

  if (createEvent) {
    createEvent.addEventListener(
      'click',
      () => {
        // Allow normal navigation.
      }
    );
  }
}

/* ============================================================
   HELPERS
============================================================ */

function normalizeArray(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.events)) {
    return data.events;
  }

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  if (Array.isArray(data?.occupancy)) {
    return data.occupancy;
  }

  return [];
}

function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function setLoading(element, text) {
  element.innerHTML = `
    <div class="dash-loading">
      ${escapeHtml(text)}
    </div>
  `;
}

function compareEvents(a, b) {
  const aDate =
    new Date(
      `${a.event_date || '9999-12-31'}T${
        a.start_time || '00:00'
      }`
    ).getTime();

  const bDate =
    new Date(
      `${b.event_date || '9999-12-31'}T${
        b.start_time || '00:00'
      }`
    ).getTime();

  return aDate - bDate;
}

function compareUsers(a, b) {
  const aDate =
    new Date(
      a.created_at || 0
    ).getTime();

  const bDate =
    new Date(
      b.created_at || 0
    ).getTime();

  return bDate - aDate;
}

function formatDate(dateString) {
  if (!dateString) return 'Date not set';

  const date =
    new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(dateString);
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
}

function formatDateTime(dateString) {
  if (!dateString) return '—';

  const date =
    new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return String(dateString);
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
}

function formatTime(timeString) {
  if (!timeString) return '';

  const match =
    String(timeString).match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!match) {
    return String(timeString);
  }

  let hour = Number(match[1]);
  const minute = match[2];

  const period =
    hour >= 12 ? 'PM' : 'AM';

  hour =
    hour % 12 || 12;

  return `${hour}:${minute} ${period}`;
}

function getDay(dateString) {
  if (!dateString) return '—';

  const date =
    new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.getDate();
}

function getMonth(dateString) {
  if (!dateString) return '';

  const date =
    new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date
    .toLocaleDateString(
      undefined,
      { month: 'short' }
    )
    .toUpperCase();
}

function getInitials(name) {
  const words =
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!words.length) {
    return 'U';
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[words.length - 1][0]
  ).toUpperCase();
}

function capitalize(value) {
  const str = String(value || '');

  return str
    ? str.charAt(0).toUpperCase() +
        str.slice(1)
    : '';
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '0';
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, isError = false) {
  const toast =
    document.getElementById('toast');

  if (!toast) return;

  toast.textContent = message;

  toast.classList.remove(
    'show',
    'error'
  );

  if (isError) {
    toast.classList.add('error');
  }

  // Force reflow so repeated toasts animate.
  void toast.offsetWidth;

  toast.classList.add('show');

  clearTimeout(
    showToast._timer
  );

  showToast._timer =
    setTimeout(() => {
      toast.classList.remove(
        'show',
        'error'
      );
    }, 3500);
}
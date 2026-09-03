// ============================================================
// ADMIN EVENTS
// Requires: api.js, auth.js, ui.js
// ============================================================

let allEvents = [];
let editingEventId = null;
let statsEventId = null;

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
    active: 'Events',
  });

  initEventsPage();
});


// ============================================================
// INIT
// ============================================================

async function initEventsPage() {
  const user = Auth.getUser();

  if (!user) {
    window.location.href = '/login.html';
    return;
  }

  if (user.role !== 'admin') {
    window.location.href =
      user.role === 'volunteer'
        ? '/volunteer/dashboard.html'
        : '/participant/dashboard.html';

    return;
  }

  bindEvents();
  await loadEvents();
}


// ============================================================
// LOAD EVENTS
// ============================================================

async function loadEvents() {
  const tbody = document.getElementById('eventsTableBody');

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="table-loading">
        Loading events…
      </td>
    </tr>
  `;

  try {
    const result = await Api.get('/admin/events');

    if (!result.ok || !result.body?.success) {
      throw new Error(
        result.body?.message || 'Unable to load events'
      );
    }

    allEvents = normalizeEvents(result.body.data);

    renderEvents();

  } catch (err) {
    console.error('[Admin Events] Load:', err);

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">
          Unable to load events.
          <button
            type="button"
            class="btn btn-secondary"
            id="retryEventsBtn"
          >
            Retry
          </button>
        </td>
      </tr>
    `;

    document
      .getElementById('retryEventsBtn')
      ?.addEventListener('click', loadEvents);

    showToast(
      err.message || 'Unable to load events.',
      true
    );
  }
}


// ============================================================
// RENDER
// ============================================================

function renderEvents() {
  const tbody =
    document.getElementById('eventsTableBody');

  if (!tbody) return;

  const search =
    document
      .getElementById('searchInput')
      ?.value
      .trim()
      .toLowerCase() || '';

  const status =
    document
      .getElementById('statusFilter')
      ?.value || 'all';

  let events = [...allEvents];

  // Search
  if (search) {
    events = events.filter((event) => {
      return [
        event.title,
        event.description,
        event.venue,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(search)
        );
    });
  }

  // Status
  events = events.filter((event) => {
    return matchesStatus(event, status);
  });

  // Newest-created first
  events.sort((a, b) => {
    const aDate =
      new Date(a.created_at || 0).getTime();

    const bDate =
      new Date(b.created_at || 0).getTime();

    return bDate - aDate;
  });

  if (!events.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">
          No events found.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = events
    .map(renderEventRow)
    .join('');

  bindRowActions();
}


// ============================================================
// EVENT ROW
// ============================================================

function renderEventRow(event) {
  const id = Number(event.id);

  const title = escapeHtml(
    event.title || 'Untitled event'
  );

  const venue = escapeHtml(
    event.venue || '-'
  );

  const date = formatDate(
    event.event_date
  );

  const time = formatTimeRange(
    event.start_time,
    event.end_time
  );

  const registered =
    Number(event.registration_count || 0);

  const capacity =
    Number(event.capacity || 0);

  const fillRate =
    capacity > 0
      ? Math.min(
          100,
          Math.round(
            (registered / capacity) * 100
          )
        )
      : 0;

  let status;

  if (event.is_completed) {
    status = `
      <span class="dash-status dash-status-muted">
        Completed
      </span>
    `;
  } else if (event.is_published) {
    status = `
      <span class="dash-status dash-status-success">
        Published
      </span>
    `;
  } else {
    status = `
      <span class="dash-status dash-status-muted">
        Draft
      </span>
    `;
  }

  return `
    <tr data-event-id="${id}">

      <td>
        <div class="event-table-title">
          <strong>${title}</strong>
        </div>
      </td>

      <td>
        ${venue}
      </td>

      <td>
        ${escapeHtml(date)}
      </td>

      <td>
        ${escapeHtml(time)}
      </td>

      <td>
        <div class="event-capacity">
          <strong>
            ${registered}
          </strong>
          <span>
            / ${capacity}
          </span>
        </div>

        <div class="dash-progress">
          <div
            class="dash-progress-bar"
            style="width:${fillRate}%"
          ></div>
        </div>
      </td>

      <td>
        ${status}
      </td>

      <td>
        <div class="table-actions">

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="stats"
            data-id="${id}"
          >
            Stats
          </button>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="edit"
            data-id="${id}"
          >
            Edit
          </button>

          <button
            type="button"
            class="btn btn-danger btn-sm"
            data-action="delete"
            data-id="${id}"
          >
            Delete
          </button>

        </div>
      </td>

    </tr>
  `;
}


// ============================================================
// SEARCH / FILTER
// ============================================================

function bindEvents() {
  document
    .getElementById('searchInput')
    ?.addEventListener(
      'input',
      renderEvents
    );

  document
    .getElementById('statusFilter')
    ?.addEventListener(
      'change',
      renderEvents
    );

  // Edit modal
  document
    .getElementById('editModalClose')
    ?.addEventListener(
      'click',
      closeEditModal
    );

  document
    .getElementById('editModalClose2')
    ?.addEventListener(
      'click',
      closeEditModal
    );

  document
    .getElementById('saveEditBtn')
    ?.addEventListener(
      'click',
      saveEditedEvent
    );

  // Stats modal
  document
    .getElementById('statsModalClose')
    ?.addEventListener(
      'click',
      closeStatsModal
    );

  // Close modals by clicking backdrop
  document
    .getElementById('editModal')
    ?.addEventListener(
      'click',
      (event) => {
        if (
          event.target === event.currentTarget
        ) {
          closeEditModal();
        }
      }
    );

  document
    .getElementById('statsModal')
    ?.addEventListener(
      'click',
      (event) => {
        if (
          event.target === event.currentTarget
        ) {
          closeStatsModal();
        }
      }
    );

  // Escape key
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;

      closeEditModal();
      closeStatsModal();
    }
  );
}


// ============================================================
// TABLE ACTIONS
// ============================================================

function bindRowActions() {
  document
    .querySelectorAll('[data-action="edit"]')
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const id =
            Number(button.dataset.id);

          openEditModal(id);
        }
      );
    });

  document
    .querySelectorAll('[data-action="stats"]')
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const id =
            Number(button.dataset.id);

          openStatsModal(id);
        }
      );
    });

  document
    .querySelectorAll('[data-action="delete"]')
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const id =
            Number(button.dataset.id);

          deleteEvent(id);
        }
      );
    });
}


// ============================================================
// EDIT EVENT
// ============================================================

function openEditModal(eventId) {
  const event =
    allEvents.find(
      (item) =>
        Number(item.id) === eventId
    );

  if (!event) {
    showToast(
      'Event not found.',
      true
    );

    return;
  }

  editingEventId = eventId;

  setInputValue(
    'editTitle',
    event.title
  );

  setInputValue(
    'editDesc',
    event.description || ''
  );

  setInputValue(
    'editVenue',
    event.venue || ''
  );

  setInputValue(
    'editCapacity',
    event.capacity ?? ''
  );

  setInputValue(
    'editDate',
    event.event_date || ''
  );

  setInputValue(
    'editStart',
    normalizeTimeInput(
      event.start_time
    )
  );

  setInputValue(
    'editEnd',
    normalizeTimeInput(
      event.end_time
    )
  );

  clearEditAlert();

  const modal =
    document.getElementById('editModal');

  if (!modal) return;

  modal.classList.add('open');

  // Support projects where modal uses hidden.
  modal.classList.remove('hidden');
}

function closeEditModal() {
  const modal =
    document.getElementById('editModal');

  if (!modal) return;

  modal.classList.remove('open');
  modal.classList.add('hidden');

  editingEventId = null;

  clearEditAlert();
}


// ============================================================
// SAVE EDIT
// ============================================================

async function saveEditedEvent() {
  if (!editingEventId) return;

  const title =
    getInputValue('editTitle');

  const description =
    getInputValue('editDesc');

  const venue =
    getInputValue('editVenue');

  const capacity =
    getInputValue('editCapacity');

  const eventDate =
    getInputValue('editDate');

  const startTime =
    getInputValue('editStart');

  const endTime =
    getInputValue('editEnd');

  const validation =
    validateEventForm({
      title,
      venue,
      capacity,
      eventDate,
      startTime,
      endTime,
    });

  if (validation) {
    showEditAlert(validation);
    return;
  }

  const button =
    document.getElementById(
      'saveEditBtn'
    );

  setButtonLoading(
    button,
    true,
    'Saving…'
  );

  try {
    const result =
      await Api.put(
        `/admin/events/${editingEventId}`,
        {
          title,
          description,
          venue,
          capacity: Number(capacity),
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
        }
      );

    if (
      !result.ok ||
      !result.body?.success
    ) {
      throw new Error(
        result.body?.message ||
          'Unable to update event'
      );
    }

    closeEditModal();

    showToast(
      'Event updated successfully.'
    );

    await loadEvents();

  } catch (err) {
    console.error(
      '[Admin Events] Update:',
      err
    );

    showEditAlert(
      err.message ||
        'Unable to update event.'
    );

  } finally {
    setButtonLoading(
      button,
      false,
      'Save changes'
    );
  }
}


// ============================================================
// EVENT STATS
// ============================================================

async function openStatsModal(eventId) {
  const event =
    allEvents.find(
      (item) =>
        Number(item.id) === eventId
    );

  if (!event) {
    showToast(
      'Event not found.',
      true
    );

    return;
  }

  statsEventId = eventId;

  const modal =
    document.getElementById(
      'statsModal'
    );

  const title =
    document.getElementById(
      'statsModalTitle'
    );

  const content =
    document.getElementById(
      'statsContent'
    );

  if (!modal || !content) return;

  if (title) {
    title.textContent =
      event.title || 'Event statistics';
  }

  content.innerHTML = `
    <div class="dash-loading">
      Loading statistics…
    </div>
  `;

  modal.classList.add('open');
  modal.classList.remove('hidden');

  try {
    const result =
      await Api.get(
        `/admin/events/${eventId}/stats`
      );

    if (
      !result.ok ||
      !result.body?.success
    ) {
      throw new Error(
        result.body?.message ||
          'Unable to load statistics'
      );
    }

    const stats =
      result.body.data || {};

    renderStats(stats);

  } catch (err) {
    console.error(
      '[Admin Events] Stats:',
      err
    );

    content.innerHTML = `
      <div class="dash-empty">
        <p>
          Unable to load event statistics.
        </p>
      </div>
    `;
  }
}

function renderStats(stats) {
  const content =
    document.getElementById(
      'statsContent'
    );

  if (!content) return;

  const capacity =
    Number(stats.capacity || 0);

  const registered =
    Number(
      stats.total_registered || 0
    );

  const checkedIn =
    Number(
      stats.total_checkedin || 0
    );

  const occupancy =
    Number(
      stats.occupancy_percent || 0
    );

  const status =
    stats.status || 'safe';

  const statusText =
    status === 'full'
      ? 'Full'
      : status === 'near'
        ? 'Near capacity'
        : 'Safe';

  const statusClass =
    status === 'full'
      ? 'dash-status-danger'
      : status === 'near'
        ? 'dash-status-warning'
        : 'dash-status-success';

  content.innerHTML = `
    <div class="stats-grid">

      <div class="stats-card">
        <span>Capacity</span>
        <strong>${capacity}</strong>
      </div>

      <div class="stats-card">
        <span>Registered</span>
        <strong>${registered}</strong>
      </div>

      <div class="stats-card">
        <span>Checked in</span>
        <strong>${checkedIn}</strong>
      </div>

      <div class="stats-card">
        <span>Occupancy</span>
        <strong>
          ${formatNumber(occupancy)}%
        </strong>
      </div>

    </div>

    <div class="stats-status">
      <span class="dash-status ${statusClass}">
        ${statusText}
      </span>
    </div>
  `;
}

function closeStatsModal() {
  const modal =
    document.getElementById(
      'statsModal'
    );

  if (!modal) return;

  modal.classList.remove('open');
  modal.classList.add('hidden');

  statsEventId = null;
}


// ============================================================
// DELETE EVENT
// ============================================================

function deleteEvent(eventId) {
  const event =
    allEvents.find(
      (item) =>
        Number(item.id) === eventId
    );

  if (!event) {
    showToast(
      'Event not found.',
      true
    );

    return;
  }

  showConfirm({
    icon: '🗑️',
    title: 'Delete event?',
    msg:
      `"${event.title}" will be permanently deleted.`,
    confirmTxt: 'Delete',
    cancelTxt: 'Cancel',
    danger: true,

    onConfirm: async () => {
      await performDeleteEvent(
        eventId
      );
    },
  });
}

async function performDeleteEvent(eventId) {
  try {
    const result =
      await Api.delete(
        `/admin/events/${eventId}`
      );

    if (
      !result.ok ||
      !result.body?.success
    ) {
      throw new Error(
        result.body?.message ||
          'Unable to delete event'
      );
    }

    showToast(
      'Event deleted successfully.'
    );

    await loadEvents();

  } catch (err) {
    console.error(
      '[Admin Events] Delete:',
      err
    );

    showToast(
      err.message ||
        'Unable to delete event.',
      true
    );
  }
}


// ============================================================
// VALIDATION
// ============================================================

function validateEventForm(data) {
  if (!data.title) {
    return 'Event title is required.';
  }

  if (!data.venue) {
    return 'Venue is required.';
  }

  if (
    !data.capacity ||
    Number(data.capacity) <= 0
  ) {
    return 'Capacity must be greater than 0.';
  }

  if (!data.eventDate) {
    return 'Event date is required.';
  }

  if (!data.startTime) {
    return 'Start time is required.';
  }

  if (!data.endTime) {
    return 'End time is required.';
  }

  if (data.startTime >= data.endTime) {
    return 'Start time must be before end time.';
  }

  return null;
}


// ============================================================
// STATUS FILTER
// ============================================================

function matchesStatus(event, status) {
  if (!status || status === 'all') {
    return true;
  }

  switch (status) {
    case 'published':
      return (
        event.is_published === true &&
        event.is_completed !== true
      );

    case 'draft':
      return (
        event.is_published !== true &&
        event.is_completed !== true
      );

    case 'completed':
      return event.is_completed === true;

    case 'upcoming':
      return (
        event.is_completed !== true &&
        isUpcoming(event)
      );

    default:
      return true;
  }
}

function isUpcoming(event) {
  if (!event.event_date) {
    return false;
  }

  const date =
    new Date(
      `${event.event_date}T${
        normalizeTimeInput(
          event.start_time
        ) || '00:00'
      }`
    );

  return date.getTime() >= Date.now();
}


// ============================================================
// FORM HELPERS
// ============================================================

function getInputValue(id) {
  return (
    document.getElementById(id)
      ?.value
      .trim() || ''
  );
}

function setInputValue(id, value) {
  const input =
    document.getElementById(id);

  if (input) {
    input.value = value ?? '';
  }
}

function normalizeTimeInput(time) {
  if (!time) return '';

  const value =
    String(time);

  const match =
    value.match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!match) {
    return value;
  }

  return (
    String(
      Number(match[1])
    ).padStart(2, '0') +
    ':' +
    match[2]
  );
}

function clearEditAlert() {
  const alert =
    document.getElementById(
      'editAlert'
    );

  if (!alert) return;

  alert.textContent = '';
  alert.classList.remove('show');
}

function showEditAlert(message) {
  const alert =
    document.getElementById(
      'editAlert'
    );

  if (!alert) return;

  alert.textContent = message;
  alert.classList.add('show');
}


// ============================================================
// NORMALIZATION
// ============================================================

function normalizeEvents(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.events)) {
    return data.events;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}


// ============================================================
// FORMATTING
// ============================================================

function formatDate(value) {
  if (!value) return '-';

  const date =
    new Date(
      `${value}T00:00:00`
    );

  if (Number.isNaN(date.getTime())) {
    return String(value);
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

function formatTime(value) {
  if (!value) return '';

  const match =
    String(value).match(
      /^(\d{1,2}):(\d{2})/
    );

  if (!match) {
    return String(value);
  }

  let hour =
    Number(match[1]);

  const minute =
    match[2];

  const period =
    hour >= 12 ? 'PM' : 'AM';

  hour =
    hour % 12 || 12;

  return `${hour}:${minute} ${period}`;
}

function formatTimeRange(start, end) {
  const first =
    formatTime(start);

  const last =
    formatTime(end);

  if (!first && !last) {
    return '-';
  }

  if (!last) {
    return first;
  }

  return `${first} – ${last}`;
}

function formatNumber(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return '0';
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}


// ============================================================
// UI HELPERS
// ============================================================

function setButtonLoading(
  button,
  loading,
  loadingText
) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText =
      button.textContent;

    button.disabled = true;
    button.textContent =
      loadingText;
  } else {
    button.disabled = false;

    button.textContent =
      button.dataset.originalText ||
      'Save changes';
  }
}

function showToast(
  message,
  isError = false
) {
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

  void toast.offsetWidth;

  toast.classList.add('show');

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(() => {
      toast.classList.remove(
        'show',
        'error'
      );
    }, 3500);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
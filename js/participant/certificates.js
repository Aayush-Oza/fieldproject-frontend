// frontend/js/participant/certificates.js

if (!Auth.isLoggedIn()) window.location.href = '../login';

const user = Auth.getUser();
document.getElementById('navName').textContent = user?.name || '';
document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

function render(certs) {
  const el = document.getElementById('certGrid');

  if (!certs.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🎓</div>
        <p class="empty-state-title">No certificates yet</p>
        <p class="empty-state-desc">Attend events and get checked in to earn certificates.</p>
        <a href="events" class="btn btn-primary btn-sm mt-2">Browse events</a>
      </div>`;
    return;
  }

  el.innerHTML = certs.map(c => `
    <div class="cert-card">
      <div class="cert-card-icon">🎓</div>
      <div class="cert-card-body">
        <h3 class="cert-card-title">${c.event_title || 'Event Certificate'}</h3>
        <p class="cert-card-date">Issued on ${fmtDate(c.issued_at)}</p>
      </div>
      <span class="badge badge-green cert-badge">Eligible</span>
      <button
        class="btn btn-primary btn-sm cert-download-btn"
        data-event-id="${c.event_id}"
        data-title="${c.event_title || 'certificate'}"
      >⬇ Download PDF</button>
    </div>
  `).join('');

  document.querySelectorAll('.cert-download-btn').forEach(btn => {
    btn.addEventListener('click', () => downloadCert(btn, btn.dataset.eventId, btn.dataset.title));
  });
}

async function downloadCert(btn, eventId, title) {
  const token = sessionStorage.getItem('token');
  const base  = window.API_BASE_URL || '';
  const url   = `${base}/participant/events/${eventId}/certificate/download`;

  // Show loading state on button
  const original = btn.innerHTML;
  btn.innerHTML   = '⏳ Generating...';
  btn.disabled    = true;

  try {
    const res = await fetch(url, {
      method:  'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      // Try to parse error message from backend
      let msg = 'Could not download certificate.';
      try {
        const json = await res.json();
        msg = json.message || msg;
      } catch (_) {}
      alert(msg);
      return;
    }

    // Stream blob → trigger browser download
    const blob     = await res.blob();
    const blobUrl  = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = blobUrl;
    a.download     = `Certificate_${title.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

  } catch (err) {
    console.error('Certificate download error:', err);
    alert('Something went wrong. Please try again.');
  } finally {
    btn.innerHTML = original;
    btn.disabled  = false;
  }
}

async function load() {
  const { ok, body } = await Api.get('/participant/certificates');
  render(ok ? body.data : []);
}

load();
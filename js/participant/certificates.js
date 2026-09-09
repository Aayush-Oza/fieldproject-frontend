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
    <button class="btn btn-primary btn-sm cert-download-btn" data-event-id="${c.event_id}" data-title="${c.event_title || 'certificate'}">⬇ Download</button>
  </div>
`).join('');

  document.querySelectorAll('.cert-download-btn').forEach(btn => {
    btn.addEventListener('click', () => downloadCert(btn.dataset.eventId, btn.dataset.title));
  });
}

async function downloadCert(eventId, title) {
  const token = sessionStorage.getItem('token');
  const url = `${window.API_BASE_URL || 'https://fieldproject-backend.onrender.com/api'}/participant/events/${eventId}/certificate/download`;

  // If no download endpoint, generate a simple printable page
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>${title} Certificate</title>
    <style>
      body { font-family: 'Georgia', serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
      .cert { background: white; border: 8px double #2c5282; padding: 60px 80px; text-align: center; max-width: 700px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
      h1 { color: #2c5282; font-size: 2.5rem; margin-bottom: 0.5rem; }
      h2 { font-size: 1.5rem; color: #333; margin: 1.5rem 0; }
      p { color: #555; font-size: 1rem; }
      .seal { font-size: 4rem; margin: 1rem 0; }
      .footer { margin-top: 2rem; font-size: 0.85rem; color: #888; border-top: 1px solid #eee; padding-top: 1rem; }
      @media print { body { background: white; } }
    </style></head>
    <body><div class="cert">
      <div class="seal">🎓</div>
      <h1>Certificate of Participation</h1>
      <p>This certifies that</p>
      <h2>${Auth.getUser()?.name || 'Participant'}</h2>
      <p>has successfully participated in</p>
      <h2>${title}</h2>
      <p>organised via EventOps</p>
      <div class="footer">Issued on ${new Date().toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; EventOps</div>
    </div>
    <script>window.onload = () => window.print();<\/script>
    </body></html>
  `);
  w.document.close();
}
async function load() {
  const { ok, body } = await Api.get('/participant/certificates');
  render(ok ? body.data : []);
}

load();
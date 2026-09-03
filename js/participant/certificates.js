// frontend/js/participant/certificates.js

if (!Auth.isLoggedIn()) window.location.href = '../login.html';

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
        <a href="events.html" class="btn btn-primary btn-sm mt-2">Browse events</a>
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
    </div>
  `).join('');
}

async function load() {
  const { ok, body } = await Api.get('/participant/certificates');
  render(ok ? body.data : []);
}

load();
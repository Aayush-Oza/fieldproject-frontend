// frontend/js/hamburger.js
// Mobile nav for participant pages. Include AFTER auth.js.

(function () {
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'navDrawer';
  drawer.innerHTML = `
    <div class="nav-drawer-user">
      <div>
        <div class="nav-drawer-name" id="drawerName">–</div>
        <span class="nav-role-badge role-participant" style="font-size:0.7rem;padding:2px 8px;">Participant</span>
      </div>
    </div>
    <a href="dashboard.html"        class="nav-drawer-link" data-page="dashboard">Dashboard</a>
    <a href="events.html"           class="nav-drawer-link" data-page="events">Events</a>
    <a href="my-registrations.html" class="nav-drawer-link" data-page="my-registrations">My Registrations</a>
    <a href="my-certificates.html"  class="nav-drawer-link" data-page="my-certificates">Certificates</a>
    <button class="nav-drawer-logout" id="drawerLogout">Sign out</button>
  `;
  document.body.appendChild(drawer);

  const navInner = document.querySelector('.nav-inner');
  const burger   = document.createElement('button');
  burger.className = 'nav-hamburger';
  burger.id = 'navBurger';
  burger.setAttribute('aria-label', 'Toggle menu');
  burger.innerHTML = '<span></span><span></span><span></span>';
  navInner.appendChild(burger);

  const page = location.pathname.split('/').pop().replace('.html', '');
  drawer.querySelectorAll('.nav-drawer-link').forEach(a => {
    if (a.dataset.page === page) a.classList.add('active');
  });

  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    drawer.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    if (!burger.contains(e.target) && !drawer.contains(e.target)) {
      burger.classList.remove('open');
      drawer.classList.remove('open');
    }
  });

  function fillName() {
    try {
      const raw = sessionStorage.getItem('user');
      if (!raw) return;
      const u    = JSON.parse(raw);
      const name = u.full_name || u.name || u.email || '–';
      const el   = document.getElementById('drawerName');
      if (el) el.textContent = name;
      const navName = document.getElementById('navName');
      if (navName) navName.textContent = name;
    } catch (_) {}
  }
  fillName();
  setTimeout(fillName, 400);

  function doLogout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.href = '../login.html';
  }

  document.getElementById('drawerLogout').addEventListener('click', doLogout);
  const desktopLogout = document.getElementById('logoutBtn');
  if (desktopLogout) desktopLogout.addEventListener('click', doLogout);
})();
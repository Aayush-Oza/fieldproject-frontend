// frontend/js/admin-hamburger.js
// Mobile nav drawer for admin pages. Include AFTER auth.js.

(function () {
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = 'navDrawer';
  drawer.innerHTML = `
    <div class="nav-drawer-user">
      <div>
        <div class="nav-drawer-name" id="drawerName">–</div>
        <span class="nav-role-badge role-admin" style="font-size:0.7rem;padding:2px 8px;">Admin</span>
      </div>
    </div>
    <a href="dashboard.html"    class="nav-drawer-link" data-page="dashboard">Dashboard</a>
    <a href="events.html"       class="nav-drawer-link" data-page="events">Events</a>
    <a href="volunteers.html"   class="nav-drawer-link" data-page="volunteers">Volunteers</a>
    <a href="occupancy.html"    class="nav-drawer-link" data-page="occupancy">Occupancy</a>
    <a href="forecast.html"     class="nav-drawer-link" data-page="forecast">Forecast</a>
    <a href="certificates.html" class="nav-drawer-link" data-page="certificates">Certificates</a>
    <button class="nav-drawer-logout" id="drawerLogout">Sign out</button>
  `;
  document.body.appendChild(drawer);

  const navInner = document.querySelector('.nav-inner');
  const burger = document.createElement('button');
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
      const u = JSON.parse(raw);
      const name = u.full_name || u.name || u.email || '–';
      const el = document.getElementById('drawerName');
      if (el) el.textContent = name;
      const navName = document.getElementById('navName');
      if (navName) navName.textContent = name;
    } catch (_) { }
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
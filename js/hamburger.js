/* hamburger.js – shared mobile nav for all participant pages
   Include AFTER auth.js on every participant HTML page */

(function () {
  /* ── inject drawer HTML ── */
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
    <a href="dashboard.html"       class="nav-drawer-link" data-page="dashboard">Dashboard</a>
    <a href="events.html"          class="nav-drawer-link" data-page="events">Events</a>
    <a href="my-registrations.html" class="nav-drawer-link" data-page="my-registrations">My Registrations</a>
    <a href="my-certificates.html" class="nav-drawer-link" data-page="my-certificates">Certificates</a>
    <button class="nav-drawer-logout" id="drawerLogout">Sign out</button>
  `;
  document.body.appendChild(drawer);

  /* ── inject hamburger button into nav-inner ── */
  const navInner = document.querySelector('.nav-inner');
  const burger = document.createElement('button');
  burger.className = 'nav-hamburger';
  burger.id = 'navBurger';
  burger.setAttribute('aria-label', 'Toggle menu');
  burger.innerHTML = '<span></span><span></span><span></span>';
  navInner.appendChild(burger);

  /* ── mark active link based on current filename ── */
  const page = location.pathname.split('/').pop().replace('.html', '');
  drawer.querySelectorAll('.nav-drawer-link').forEach(a => {
    if (a.dataset.page === page) a.classList.add('active');
  });

  /* ── toggle drawer ── */
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    drawer.classList.toggle('open');
  });

  /* ── close on outside click ── */
  document.addEventListener('click', (e) => {
    if (!burger.contains(e.target) && !drawer.contains(e.target)) {
      burger.classList.remove('open');
      drawer.classList.remove('open');
    }
  });

  /* ── populate name from auth ── */
  function fillName() {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (!raw) return;
      const u = JSON.parse(raw);
      const name = u.full_name || u.name || u.email || '–';
      const el = document.getElementById('drawerName');
      if (el) el.textContent = name;
    } catch (_) {}
  }
  fillName();
  /* retry once in case auth.js sets user after this runs */
  setTimeout(fillName, 800);

  /* ── sign out ── */
  function doLogout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '../login.html';
  }

  document.getElementById('drawerLogout').addEventListener('click', doLogout);

  /* also wire the existing desktop Sign out button if present */
  const desktopLogout = document.getElementById('logoutBtn');
  if (desktopLogout) desktopLogout.addEventListener('click', doLogout);
})();
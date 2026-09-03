// frontend/js/ui.js
// Shared UI helpers: mobile nav hamburger + custom confirm dialog.
// Load this AFTER api.js and auth.js on every dashboard page.

// ═══════════════════════════════════════
// MOBILE NAV
// Call initNav({ links, active }) on each page.
// links: array of { href, label }
// active: label of current page
// ═══════════════════════════════════════
function initNav({ links = [], active = '' } = {}) {
  const user = Auth.getUser();

  // Desktop nav name
  const navName = document.getElementById('navName');
  if (navName) navName.textContent = user?.name || '';

  // Logout buttons (desktop + drawer)
  document.querySelectorAll('.nav-logout, .nav-drawer-logout').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm({
        icon:       '👋',
        title:      'Sign out?',
        msg:        'You will be returned to the login page.',
        confirmTxt: 'Sign out',
        cancelTxt:  'Stay',
        danger:     false,
        onConfirm:  () => Auth.logout(),
      });
    });
  });

  // Build hamburger button
  const navInner = document.querySelector('.nav-inner');
  if (!navInner) return;

  const hamburger = document.createElement('button');
  hamburger.className     = 'nav-hamburger';
  hamburger.ariaLabel     = 'Menu';
  hamburger.innerHTML     = '<span></span><span></span><span></span>';
  navInner.appendChild(hamburger);

  // Build drawer
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';

  links.forEach(({ href, label }) => {
    const a = document.createElement('a');
    a.href      = href;
    a.className = 'nav-drawer-link' + (label === active ? ' active' : '');
    a.textContent = label;
    drawer.appendChild(a);
  });

  // User row inside drawer
  const userRow = document.createElement('div');
  userRow.className = 'nav-drawer-user';
  userRow.innerHTML = `
    <span class="nav-role-badge role-${user?.role || 'participant'}">${capitalize(user?.role || 'participant')}</span>
    <span class="nav-drawer-name">${user?.name || ''}</span>
    <button class="nav-drawer-logout">Sign out</button>
  `;
  drawer.appendChild(userRow);

  // Logout inside drawer
  userRow.querySelector('.nav-drawer-logout').addEventListener('click', () => {
    showConfirm({
      icon:       '👋',
      title:      'Sign out?',
      msg:        'You will be returned to the login page.',
      confirmTxt: 'Sign out',
      cancelTxt:  'Stay',
      danger:     false,
      onConfirm:  () => Auth.logout(),
    });
  });

  document.body.appendChild(drawer);

  // Toggle
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    drawer.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!navInner.contains(e.target) && !drawer.contains(e.target)) {
      hamburger.classList.remove('open');
      drawer.classList.remove('open');
    }
  });
}

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }


// ═══════════════════════════════════════
// CUSTOM CONFIRM DIALOG
// showConfirm({ icon, title, msg, confirmTxt, cancelTxt, danger, onConfirm })
// ═══════════════════════════════════════
function showConfirm({ icon = '⚠️', title = 'Are you sure?', msg = '', confirmTxt = 'Confirm', cancelTxt = 'Cancel', danger = true, onConfirm }) {
  // Remove any existing
  const existing = document.getElementById('confirmOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'confirmOverlay';
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon">${icon}</div>
      <h3 class="confirm-title">${title}</h3>
      <p class="confirm-msg">${msg}</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary" id="confirmCancel">${cancelTxt}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOk">${confirmTxt}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#confirmCancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirmOk').addEventListener('click', () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });

  // Close on backdrop click
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}
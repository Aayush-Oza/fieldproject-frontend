// frontend/js/auth.js
// Uses sessionStorage so each browser tab has its own isolated session.
// Multiple roles can be tested simultaneously in separate tabs without collision.

const Auth = {

  async register(payload) {
    try {
      const { ok, body } = await Api.post('/auth/register', payload);
      if (ok && body.success) return { success: true, message: body.message, data: body.data };
      return { success: false, message: body.message || 'Registration failed' };
    } catch (err) {
      console.error('[Auth.register]', err);
      return { success: false, message: 'Network error. Is the server running?' };
    }
  },

  async login(email, password) {
    try {
      const { ok, body } = await Api.post('/auth/login', { email, password });
      if (ok && body.success) {
        const { token, user } = body.data;
        // sessionStorage: isolated per tab, cleared when tab closes
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));
        return { success: true, message: body.message, user };
      }
      return { success: false, message: body.message || 'Login failed' };
    } catch (err) {
      console.error('[Auth.login]', err);
      return { success: false, message: 'Network error. Is the server running?' };
    }
  },

  logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.href = '../login';
  },

  getUser() {
    try { return JSON.parse(sessionStorage.getItem('user')); }
    catch { return null; }
  },

  isLoggedIn() {
    return !!sessionStorage.getItem('token');
  },

  redirectIfLoggedIn() {
    if (!this.isLoggedIn()) return;
    const user = this.getUser();
    if (!user) return;
    const dest = {
      admin:       'admin/dashboard',
      volunteer:   'volunteer/dashboard',
      participant: 'participant/dashboard',
    };
    window.location.href = dest[user.role] || 'participant/dashboard';
  },

  initNav() {
    const user = this.getUser();
    if (!user) {
      window.location.href = '../login';
      return null;
    }
    const name = user.name || user.full_name || user.email || '';
    const navName     = document.getElementById('navName');
    const greetingName = document.getElementById('greetingName');
    if (navName)      navName.textContent      = name;
    if (greetingName) greetingName.textContent = name;
    return user;
  },
};
// frontend/js/auth.js

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
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        return { success: true, message: body.message, user };
      }
      return { success: false, message: body.message || 'Login failed' };
    } catch (err) {
      console.error('[Auth.login]', err);
      return { success: false, message: 'Network error. Is the server running?' };
    }
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  },

  getUser() {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  },

  isLoggedIn() {
    return !!localStorage.getItem('token');
  },

  redirectIfLoggedIn() {
    if (!this.isLoggedIn()) return;
    const user = this.getUser();
    if (!user) return;
    const dest = {
      admin: '/admin/dashboard.html',
      volunteer: '/volunteer/dashboard.html',
      participant: '/participant/dashboard.html',
    };
    window.location.href = dest[user.role] || '/participant/dashboard.html';
  },

  initNav() {
    const user = this.getUser();

    if (!user) {
      window.location.href = '/login.html';
      return null;
    }

    const navName = document.getElementById('navName');
    const greetingName = document.getElementById('greetingName');

    const name = user.name || user.full_name || user.email || 'Participant';

    if (navName) {
      navName.textContent = name;
    }

    if (greetingName) {
      greetingName.textContent = name;
    }

    return user;
  },
};
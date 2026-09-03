// frontend/js/api.js
// Central API helper - all backend calls go through here.

const API_BASE = window.API_BASE_URL || 'http://localhost:5000/api';

const Api = {
  /**
   * Internal fetch wrapper.
   * @param {string} path   - e.g. '/auth/register'
   * @param {object} opts   - fetch options override
   */
  async _request(path, opts = {}) {
    const token = localStorage.getItem('token');

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
    });

    // Try to parse JSON regardless of status
    let body;
    try {
      body = await res.json();
    } catch {
      body = { success: false, message: 'Invalid server response' };
    }

    return { status: res.status, ok: res.ok, body };
  },

  get(path)         { return this._request(path, { method: 'GET' }); },
  post(path, data)  { return this._request(path, { method: 'POST',  body: JSON.stringify(data) }); },
  put(path, data)   { return this._request(path, { method: 'PUT',   body: JSON.stringify(data) }); },
  delete(path)      { return this._request(path, { method: 'DELETE' }); },
};
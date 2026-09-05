// frontend/js/api.js
// Central API helper. Reads token from sessionStorage (per-tab isolation).

const API_BASE = window.API_BASE_URL || 'http://localhost:5000/api';

const Api = {
  async _request(path, opts = {}) {
    // sessionStorage so each tab uses its own login session
    const token = sessionStorage.getItem('token');

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

    let body;
    try { body = await res.json(); }
    catch { body = { success: false, message: 'Invalid server response' }; }

    return { status: res.status, ok: res.ok, body };
  },

  get(path)        { return this._request(path, { method: 'GET' }); },
  post(path, data) { return this._request(path, { method: 'POST',   body: JSON.stringify(data) }); },
  put(path, data)  { return this._request(path, { method: 'PUT',    body: JSON.stringify(data) }); },
  delete(path)     { return this._request(path, { method: 'DELETE' }); },
};
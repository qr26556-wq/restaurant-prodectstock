// ---- Small API + auth helper shared by every page ----
const API = {
  base: '/api',
  token: () => localStorage.getItem('rf_token'),
  setToken: (t) => localStorage.setItem('rf_token', t),
  clearToken: () => localStorage.removeItem('rf_token'),

  async request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = API.token();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(API.base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Kuch galat ho gaya.');
      err.code = data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  },

  // For multipart/form-data (e.g. photo uploads). Don't set Content-Type
  // manually — the browser needs to add its own multipart boundary.
  async upload(path, formData) {
    const headers = {};
    const token = API.token();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(API.base + path, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Kuch galat ho gaya.');
      err.code = data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  },
};

function requireLoginOrRedirect() {
  if (!API.token()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function showMsg(el, text, type = 'error') {
  el.textContent = text;
  el.className = 'form-msg ' + type;
}

// Populate nav auth state (Login/Signup vs Dashboard/Logout)
function hydrateNav() {
  const authSlot = document.querySelector('[data-auth-slot]');
  if (!authSlot) return;
  if (API.token()) {
    authSlot.innerHTML = `
      <a href="dashboard.html" class="btn btn-ghost">Dashboard</a>
      <a href="#" id="logoutBtn" class="btn btn-primary">Logout</a>
    `;
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.preventDefault();
      API.clearToken();
      window.location.href = 'index.html';
    });
  } else {
    authSlot.innerHTML = `
      <a href="login.html" class="btn btn-ghost">Login</a>
      <a href="signup.html" class="btn btn-primary">Start free</a>
    `;
  }
}

document.addEventListener('DOMContentLoaded', hydrateNav);

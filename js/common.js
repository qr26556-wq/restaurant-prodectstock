/* =========================================================
   COMMON — shared across every page
   Depends on firebase-config.js being loaded first.
   ========================================================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  });
}

const RESTPOS = (() => {

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    pos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.5 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/></svg>',
    kitchen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>',
    products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };
  const icon = (name) => ICONS[name] || '';

  const NAV_ITEMS = [
    { href: 'dashboard.html', key: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'manager'] },
    { href: 'pos.html', key: 'pos', label: 'POS Billing', icon: 'pos', roles: ['admin', 'manager', 'cashier'] },
    { href: 'kitchen.html', key: 'kitchen', label: 'Kitchen (KOT)', icon: 'kitchen', roles: ['admin', 'manager', 'cashier'] },
    { href: 'products.html', key: 'products', label: 'Products', icon: 'products', roles: ['admin', 'manager'] },
    { href: 'orders.html', key: 'orders', label: 'Orders', icon: 'orders', roles: ['admin', 'manager', 'cashier'] },
  ];

  const ROLE_LABELS = { admin: 'Administrator', manager: 'Manager', cashier: 'Cashier' };

  function toast(msg, type = 'default') {
    let host = document.getElementById('toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  function money(n, currency) {
    const c = currency || (window.__settings && window.__settings.currency) || '₹';
    const v = Number(n || 0);
    return `${c}${v.toFixed(2)}`;
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function genOrderNumber() {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 900 + 100);
    return `${stamp}-${rand}`;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Renders sidebar + bottom nav into #navHost, gated by role.
  function renderNav(activeKey, role, userLabel) {
    const items = NAV_ITEMS.filter(i => i.roles.includes(role));
    const sidebarLinks = items.map(i =>
      `<a href="${i.href}" class="${i.key === activeKey ? 'active' : ''}">${icon(i.icon)}<span>${i.label}</span></a>`
    ).join('');
    const bottomLinks = items.map(i =>
      `<a href="${i.href}" class="${i.key === activeKey ? 'active' : ''}">${icon(i.icon)}<span>${i.label.split(' ')[0]}</span></a>`
    ).join('');

    const sidebar = `
      <aside class="sidebar">
        <div class="brand">
          <div class="mark">R</div>
          <div>
            <div class="name" id="brandName">RESTPOS</div>
            <div class="role">${ROLE_LABELS[role] || role}</div>
          </div>
        </div>
        <nav>${sidebarLinks}</nav>
        <div class="bottom">
          <button class="logout" id="logoutBtn">${icon('logout')}<span>Log out</span></button>
        </div>
      </aside>
      <nav class="bottomnav">${bottomLinks}</nav>`;
    document.getElementById('navHost').innerHTML = sidebar;
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // fill topbar user label if present
    const who = document.getElementById('whoLabel');
    if (who) who.textContent = userLabel || '';

    // fetch restaurant name for brand, if settings loaded later this can be re-set
    DB.getSettings().then(data => {
      if (data && data.restaurantName) {
        const el = document.getElementById('brandName');
        if (el) el.textContent = data.restaurantName;
      }
      window.__settings = data || {};
    }).catch(() => {});
  }

  function logout() {
    auth.signOut().then(() => {
      sessionStorage.removeItem('restpos_user');
      window.location.href = 'login.html';
    });
  }

  // Guards a page: requires login, optionally requires a specific role.
  // Calls back(userDoc) once resolved. userDoc = {uid,name,email,role}
  function guard(requiredRoles, callback) {
    auth.onAuthStateChanged(async (user) => {
      if (!user) { window.location.href = 'login.html'; return; }
      try {
        const snap = await db.collection('users').doc(user.uid).get();
        if (!snap.exists) {
          toast('No profile found for this account. Contact an admin.', 'error');
          setTimeout(logout, 1200);
          return;
        }
        const data = snap.data();
        if (data.active === false) {
          toast('This account has been disabled.', 'error');
          setTimeout(logout, 1200);
          return;
        }
        if (requiredRoles && !requiredRoles.includes(data.role)) {
          window.location.href = (data.role === 'admin' || data.role === 'manager') ? 'dashboard.html' : 'pos.html';
          return;
        }
        if (!data.restaurantId) {
          toast('This account isn\'t linked to a restaurant. Contact an admin.', 'error');
          setTimeout(logout, 1200);
          return;
        }
        DB.init(data.restaurantId);
        const userDoc = { uid: user.uid, name: data.name || user.email, email: user.email, role: data.role, restaurantId: data.restaurantId };
        sessionStorage.setItem('restpos_user', JSON.stringify(userDoc));
        callback(userDoc);
      } catch (e) {
        console.error(e);
        toast('Could not load your account. Check your connection.', 'error');
      }
    });
  }

  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  return { icon, toast, money, fmtDate, genOrderNumber, escapeHtml, renderNav, guard, logout, openModal, closeModal, NAV_ITEMS };
})();

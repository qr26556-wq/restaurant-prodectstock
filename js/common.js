/* =========================================================
   COMMON — shared across every page
   Depends on firebase-config.js being loaded first.
   ========================================================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  });
}

// Small fixed banner so staff at the counter know why syncing looks stuck
// when wifi drops — the app itself keeps working (cached data + Firestore's
// own offline write queue), this is purely a confidence signal.
(function offlineBanner() {
  function ensureBanner() {
    let el = document.getElementById('offlineBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'offlineBanner';
      el.textContent = "You're offline — changes will sync once you're back online.";
      el.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'top:0', 'z-index:9999',
        'background:#6E1017', 'color:#fff', 'font-size:12.5px', 'font-weight:600',
        'text-align:center', 'padding:7px 10px', 'display:none',
      ].join(';');
      document.body.appendChild(el);
    }
    return el;
  }
  function update() {
    const el = ensureBanner();
    el.style.display = navigator.onLine ? 'none' : 'block';
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  document.addEventListener('DOMContentLoaded', update);
})();

const RESTPOS = (() => {

  // Lightweight translation layer: covers the sidebar/bottom-nav labels
  // and the most common on-screen words. Scope is intentionally limited
  // to these shared, high-visibility strings rather than every label on
  // every page — translating everything would mean rewriting each page's
  // markup with data-i18n tags one by one, which can be extended later.
  const I18N = {
    en: {
      dashboard: 'Dashboard', pos: 'POS', kitchen: 'Kitchen', products: 'Products',
      orders: 'Orders', staff: 'Staff', settings: 'Settings', logout: 'Log out',
      admin: 'Admin', manager: 'Manager', cashier: 'Cashier',
      save: 'Save', cancel: 'Cancel', add: 'Add', delete: 'Delete', edit: 'Edit',
    },
    ur: {
      dashboard: 'ڈیش بورڈ', pos: 'پی او ایس', kitchen: 'کچن', products: 'پروڈکٹس',
      orders: 'آرڈرز', staff: 'اسٹاف', settings: 'ترتیبات', logout: 'لاگ آؤٹ',
      admin: 'ایڈمن', manager: 'منیجر', cashier: 'کیشیئر',
      save: 'محفوظ کریں', cancel: 'منسوخ', add: 'شامل کریں', delete: 'حذف کریں', edit: 'ترمیم',
    },
  };
  let currentLang = 'en';
  function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key; }
  function setLanguage(lang) {
    currentLang = I18N[lang] ? lang : 'en';
    document.documentElement.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  }

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
    staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  };
  const icon = (name) => ICONS[name] || '';

  const NAV_ITEMS = [
    { href: 'dashboard.html', key: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'manager'] },
    { href: 'pos.html', key: 'pos', label: 'POS Billing', icon: 'pos', roles: ['admin', 'manager', 'cashier'] },
    { href: 'kitchen.html', key: 'kitchen', label: 'Kitchen (KOT)', icon: 'kitchen', roles: ['admin', 'manager', 'cashier'] },
    { href: 'products.html', key: 'products', label: 'Products', icon: 'products', roles: ['admin', 'manager'] },
    { href: 'orders.html', key: 'orders', label: 'Orders', icon: 'orders', roles: ['admin', 'manager', 'cashier'] },
    { href: 'staff.html', key: 'staff', label: 'Staff', icon: 'staff', roles: ['admin'] },
    { href: 'settings.html', key: 'settings', label: 'Settings', icon: 'settings', roles: ['admin'] },
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
      `<a href="${i.href}" class="${i.key === activeKey ? 'active' : ''}">${icon(i.icon)}<span data-i18n="${i.key}">${t(i.key)}</span></a>`
    ).join('');
    const bottomLinks = items.map(i =>
      `<a href="${i.href}" class="${i.key === activeKey ? 'active' : ''}">${icon(i.icon)}<span data-i18n="${i.key}">${t(i.key)}</span></a>`
    ).join('');

    const sidebar = `
      <aside class="sidebar">
        <div class="brand">
          <div class="mark">R</div>
          <div>
            <div class="name" id="brandName">RESTPOS</div>
            <div class="role" data-i18n="${role}">${t(role) || ROLE_LABELS[role] || role}</div>
          </div>
        </div>
        <nav>${sidebarLinks}</nav>
        <div class="bottom">
          <button class="logout" id="logoutBtn">${icon('logout')}<span data-i18n="logout">${t('logout')}</span></button>
        </div>
      </aside>
      <nav class="bottomnav">${bottomLinks}</nav>`;
    document.getElementById('navHost').innerHTML = sidebar;
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // fill topbar user label if present
    const who = document.getElementById('whoLabel');
    if (who) who.textContent = userLabel || '';

    mountClock();

    // fetch restaurant name for brand, if settings loaded later this can be re-set
    DB.getSettings().then(data => {
      if (data && data.restaurantName) {
        const el = document.getElementById('brandName');
        if (el) el.textContent = data.restaurantName;
      }
      window.__settings = data || {};
      if (data && data.language) setLanguage(data.language);
    }).catch(() => {});
  }

  // Small live clock shown in the topbar of every page (next to the
  // signed-in user's name), so the counter always has the current time
  // in view without anyone needing to check their phone separately.
  function mountClock() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('liveClock')) return;
    const clock = document.createElement('div');
    clock.id = 'liveClock';
    clock.className = 'hint mono';
    clock.style.marginLeft = 'auto';
    clock.style.marginRight = '14px';
    const who = document.getElementById('whoLabel');
    if (who) topbar.insertBefore(clock, who); else topbar.appendChild(clock);
    const tick = () => {
      clock.textContent = new Date().toLocaleString(undefined, {
        weekday: 'short', hour: '2-digit', minute: '2-digit',
      });
    };
    tick();
    setInterval(tick, 1000 * 30);
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

  /* ---------------- PDF: receipt (narrow, thermal-style) ---------------- */
  function receiptPDF(order, settings, filenamePrefix = 'receipt') {
    if (typeof window.jspdf === 'undefined') { toast('PDF tool still loading — try again in a moment', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    let y = 8;
    const center = (text, size = 11, bold = false) => {
      doc.setFontSize(size); doc.setFont(undefined, bold ? 'bold' : 'normal');
      doc.text(String(text), 40, y, { align: 'center' }); y += size * 0.62;
    };
    const left = (text, size = 9) => {
      doc.setFontSize(size); doc.setFont(undefined, 'normal');
      doc.splitTextToSize(String(text), 72).forEach(l => { doc.text(l, 4, y); y += 4.2; });
    };
    const kv = (label, value, bold = false) => {
      doc.setFontSize(9); doc.setFont(undefined, bold ? 'bold' : 'normal');
      doc.text(String(label), 4, y);
      doc.text(String(value), 76, y, { align: 'right' });
      y += 4.4;
    };
    const rule = () => { doc.setLineWidth(0.1); doc.line(4, y, 76, y); y += 3.5; };

    center(settings.restaurantName || 'Restaurant', 12, true);
    if (settings.address) left(settings.address);
    if (settings.phone) left(settings.phone);
    y += 1; rule();
    left(`Order #${order.orderNumber}`);
    left(fmtDate(order.createdAt) === '—' ? new Date().toLocaleString() : fmtDate(order.createdAt));
    if (order.cashierName) left(`Cashier: ${order.cashierName}`);
    left(`${order.type}${order.tableName ? ' · ' + order.tableName : ''}`);
    rule();
    (order.items || []).forEach(i => kv(`${i.name} x${i.qty}`, money(i.price * i.qty, settings.currency)));
    rule();
    kv('Subtotal', money(order.subtotal, settings.currency));
    kv('Discount', '-' + money(order.discount, settings.currency));
    kv('Tax', money(order.tax, settings.currency));
    kv('Total', money(order.total, settings.currency), true);
    rule();
    left(`Paid via ${order.paymentMethod || '—'}`);
    y += 2; center('Thank you — visit again!', 9);
    doc.save(`${filenamePrefix}-${order.orderNumber || Date.now()}.pdf`);
  }

  /* ---------------- PDF: full-page table report (orders list, backups) ---------------- */
  function tablePDF(filename, title, head, rows, meta) {
    if (typeof window.jspdf === 'undefined') { toast('PDF tool still loading — try again in a moment', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text(title, 14, 16);
    let startY = 22;
    if (meta) {
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(meta, 14, 22);
      doc.setTextColor(30);
      startY = 28;
    }
    if (typeof doc.autoTable === 'function') {
      doc.autoTable({ head: [head], body: rows, startY, styles: { fontSize: 8 }, headStyles: { fillColor: [232, 89, 12] } });
    } else {
      // fallback if autotable didn't load: plain text rows
      let y = startY + 4;
      doc.setFontSize(9);
      doc.text(head.join('  |  '), 14, y); y += 6;
      rows.forEach(r => {
        if (y > 280) { doc.addPage(); y = 16; }
        doc.text(r.join('  |  '), 14, y); y += 6;
      });
    }
    doc.save(filename);
  }

  return { icon, toast, money, fmtDate, genOrderNumber, escapeHtml, renderNav, guard, logout, openModal, closeModal, receiptPDF, tablePDF, t, setLanguage, NAV_ITEMS };
})();

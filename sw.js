const CACHE_NAME = 'restpos-shell-v15';
const SHELL_FILES = [
  'index.html',
  'login.html',
  'diagnostics.html',
  'dashboard.html',
  'pos.html',
  'kitchen.html',
  'products.html',
  'orders.html',
  'staff.html',
  'settings.html',
  'owner.html',
  'css/styles.css',
  'js/firebase-config.js',
  'js/common.js',
  'js/db.js',
  'js/login.js',
  'js/dashboard.js',
  'js/pos.js',
  'js/kitchen.js',
  'js/products.js',
  'js/orders.js',
  'js/staff.js',
  'js/settings.js',
  'js/owner.js',
  'js/diagnostics.js',
  'manifest.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

// Third-party library scripts the app depends on to even boot (Firebase
// SDK) or to run specific screens (jsPDF for receipts/backups, Chart.js
// for the dashboard). These live on a CDN, so they're normally outside
// the same-origin check below — we precache them explicitly and treat
// their origins as "ours" in the fetch handler so a shift that started
// online keeps working with no signal at all, not just the app shell.
const CDN_FILES = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all([
        cache.addAll(SHELL_FILES),
        // Cross-origin CDN files need an explicit 'cors' request or the
        // cached response comes back opaque (status 0) and can't be
        // reused reliably — request them individually so one slow/blocked
        // CDN can't fail the whole install step.
        ...CDN_FILES.map(url =>
          fetch(url, { mode: 'cors' }).then(res => res.ok && cache.put(url, res)).catch(() => {})
        ),
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for our own static shell AND the CDN libraries above:
// every request tries the live network FIRST so a new deploy/library
// update is picked up immediately, and only falls back to the cached
// copy if the network is unreachable (offline use at the counter). This
// also refreshes the cache with whatever the network just returned, so
// the offline fallback stays reasonably current.
// Everything else (Firebase Auth/Firestore API calls, fonts, analytics)
// goes straight to the network untouched — those responses should never
// be served from a stale cache.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwnOrigin = url.origin === self.location.origin;
  const isCdnAsset = CDN_FILES.includes(event.request.url);
  if (event.request.method !== 'GET' || !(isOwnOrigin || isCdnAsset)) return;

  event.respondWith(
    fetch(event.request, isCdnAsset ? { mode: 'cors' } : undefined).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return res;
    }).catch(() => caches.match(event.request))
  );
});

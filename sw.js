const CACHE_NAME = 'restpos-shell-v3';
const SHELL_FILES = [
  'index.html',
  'login.html',
  'dashboard.html',
  'pos.html',
  'kitchen.html',
  'products.html',
  'orders.html',
  'staff.html',
  'settings.html',
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
  'manifest.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
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

// Network-first for our own static shell: every request tries the live
// network FIRST so a new deploy is picked up immediately, and only falls
// back to the cached copy if the network is unreachable (offline use at
// the counter). This also refreshes the cache with whatever the network
// just returned, so the offline fallback stays reasonably current.
// Everything else (Firebase, CDNs) goes straight to the network untouched.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return res;
    }).catch(() => caches.match(event.request))
  );
});

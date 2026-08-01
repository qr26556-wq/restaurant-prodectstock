const CACHE_NAME = 'restpos-shell-v1';
const SHELL_FILES = [
  'index.html',
  'login.html',
  'dashboard.html',
  'pos.html',
  'kitchen.html',
  'products.html',
  'orders.html',
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

// Cache-first for our own static shell; everything else (Firebase, CDNs) goes
// straight to the network so live data is never served stale.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      }).catch(() => cached);
    })
  );
});

// Al Hadi Store — Service Worker
// Caches static shell files so the site loads instantly on repeat visits
// and can "Add to Home Screen" like a real app. Firebase/API calls are
// NEVER cached — those always go to the network so products/orders stay live.
//
// IMPORTANT: bump CACHE_NAME any time this file or the precache list
// changes, so old phones/browsers throw away their stale cache instead of
// serving an outdated copy of the site indefinitely.
const CACHE_NAME = 'al-hadi-store-v4';
const STATIC_ASSETS = [
  '/css/style.css',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Never intercept Firebase / Firestore / Auth / analytics / cross-origin API calls.
  if (
    req.method !== 'GET' ||
    url.includes('firestore.googleapis.com') ||
    url.includes('firebaseio.com') ||
    url.includes('identitytoolkit') ||
    url.includes('googleapis.com') ||
    url.includes('google-analytics') ||
    url.includes('cloudinary.com') ||
    !url.startsWith(self.location.origin)
  ) {
    return;
  }

  // HTML pages (the shell itself, e.g. "/" or "/index.html") and the app's
  // JS/CSS: network-first. A phone that already has the site installed
  // must see code/pricing updates on the very next visit, not "one visit
  // behind" — so we only fall back to the cached copy when there's no
  // internet at all.
  const isNavigation = req.mode === 'navigate';
  const isAppCode = url.endsWith('.js') || url.endsWith('.css');
  if (isNavigation || isAppCode) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else (icons, manifest, images): cache-first, refreshed in
  // the background — fine to be a little stale since these rarely change.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

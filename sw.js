// ============================================================
// SERVICE WORKER — Tracker PWA
// ============================================================
// IMPORTANT: Bump CACHE_VERSION whenever you deploy new files.
// The browser detects the change, deletes the old cache, and
// fetches everything fresh from the network.
// ============================================================
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME    = `tracker-${CACHE_VERSION}`;

// Files to pre-cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './firebase-config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ---- INSTALL: pre-cache all app shell files ----
self.addEventListener('install', event => {
  console.log(`[SW ${CACHE_VERSION}] Installing…`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ---- ACTIVATE: delete ALL old caches ----
self.addEventListener('activate', event => {
  console.log(`[SW ${CACHE_VERSION}] Activating — cleaning old caches…`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('tracker-') && key !== CACHE_NAME)
          .map(key => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // take control of all open tabs
  );
});

// ---- FETCH: Network-first for Firebase/Google APIs, Cache-first for app shell ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for Firebase, Google APIs, and external resources
  const networkOnly = [
    'firestore.googleapis.com',
    'firebase.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'accounts.google.com',
    'googleapis.com',
    'gstatic.com',
  ];

  if (networkOnly.some(domain => url.hostname.includes(domain))) {
    // Pass through to network, don't cache
    return;
  }

  // For same-origin app shell files: Cache-first, fallback to network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Cache valid responses
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

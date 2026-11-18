const CACHE_APP = 'capanni-vc-app-v2';
const CACHE_TILES = 'capanni-vc-tiles-v2';

const APP_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_APP).then((cache) => {
      return cache.addAll(APP_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_APP && k !== CACHE_TILES)
            .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (
    url.includes('tile.opentopomap.org') ||
    url.includes('tile.openstreetmap.org') ||
    url.includes('arcgisonline.com/ArcGIS/rest/services/World_Imagery')
  ) {
    event.respondWith(
      caches.open(CACHE_TILES).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response && (response.status === 200 || response.type === 'opaque')) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          return new Response('', { status: 408, statusText: 'Offline tile' });
        }
      })
    );
    return;
  }

  if (url.includes('overpass-api.de')) {
    event.respondWith(
      caches.open(CACHE_APP).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_APP).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});

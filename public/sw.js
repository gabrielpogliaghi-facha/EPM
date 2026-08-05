// Service Worker del sistema EPM.
// Estrategias:
//  - /api/*            → network-first (siempre intenta traer datos frescos; si no hay
//                         conexión, devuelve la última respuesta cacheada de esa misma URL).
//  - Navegación (HTML)  → network-first con fallback a index.html cacheado y, si tampoco
//                         hay nada cacheado, a /offline.html.
//  - Resto de archivos  → cache-first con actualización en segundo plano (más rápido).
//
// Subir CACHE_VERSION en cada release para invalidar el cache viejo automáticamente.
const CACHE_VERSION = 'v2'; // v2: íconos regenerados con el logo real de la EPM
const CACHE_NAME = `epm-cache-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/logo-epm.jpg',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  // CDN: React/ReactDOM/Babel — sin esto el shell de la SPA no puede ni arrancar offline.
  'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
  'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.7/babel.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // allSettled: si un solo recurso (ej. un CDN caído) falla, no debe tirar abajo
      // el cacheo del resto de los archivos.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // no interceptar POST/PUT/DELETE (altas, ediciones, login, etc.)

  const url = new URL(req.url);

  // ── API: network-first ─────────────────────────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ── Navegación (cargar una página completa) ──────────────────────────────────
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // ── Resto: cache-first, actualiza en segundo plano ───────────────────────────
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

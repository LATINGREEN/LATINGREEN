// Service worker de Eco-Arcade Latin Green: permite instalar el juego como
// app y jugarlo sin conexión. Al cambiar el juego, sube la versión de CACHE
// para que los dispositivos descarguen la nueva.
const CACHE = 'eco-arcade-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/logo.svg',
  './assets/latin-green.m4a',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // las peticiones parciales del reproductor de audio van directo a la red
  if (req.headers.has('range')) return;

  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (isPage) {
    // página: primero red (para recibir actualizaciones), si no hay, caché
    event.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // recursos: primero caché, si no está, red (y se guarda)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && new URL(req.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});

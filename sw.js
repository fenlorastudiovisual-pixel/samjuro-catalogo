/* Samjuro PWA — Service Worker
   Estrategia: network-first (siempre intenta traer lo último de internet;
   si no hay red, usa lo último que guardó). Ideal para un catálogo que
   actualizas seguido por git, porque nunca sirve una versión vieja si hay señal. */

const CACHE = 'samjuro-v1';

self.addEventListener('install', (e) => {
  // Activa la nueva versión de inmediato, sin esperar.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Solo manejamos GET. Lo demás (POST a APIs, etc.) pasa directo.
  if (req.method !== 'GET') return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Guarda una copia de la respuesta buena para usarla sin red después.
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

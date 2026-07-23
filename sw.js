/* ────────────────────────────────────────────────────────────
   sw.js — Catálogo Samjuro (Fenlora)
   - NETWORK-FIRST para la app (siempre lo último con internet;
     sin señal abre la última versión guardada).
   - CACHE-FIRST para las IMÁGENES del CDN (para verlas sin señal).
     El botón "Usar sin señal" llena este mismo cache de golpe.
   - NETWORK-FIRST con respaldo para los datos de Supabase (GET),
     así el catálogo también abre sin señal con los últimos datos.
   ──────────────────────────────────────────────────────────── */
const VERSION   = 'catalogo-2026-07-23-01';
const CACHE     = 'samjuro-app-' + VERSION;   // app (se renueva en cada deploy)
const IMG_CACHE = 'samjuro-imgs';             // imágenes (se conserva entre deploys) — MISMO nombre que usa el botón
const DATA_CACHE= 'samjuro-datos';            // datos de Supabase (respaldo sin señal)

self.addEventListener('install', function (e) { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const keep = [CACHE, IMG_CACHE, DATA_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return keep.indexOf(k) === -1; })
                          .map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

// Imágenes del CDN: cache-first (y guarda al verlas).
async function cacheFirstImg(req) {
  const cache = await caches.open(IMG_CACHE);
  const hit = await cache.match(req);
  if (hit) {
    fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    }).catch(function () {});
    return hit;
  }
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return hit || Response.error();
  }
}

// Datos de Supabase (GET): network-first con respaldo guardado.
async function netFirstData(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    return hit || Response.error();
  }
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;   // POST a APIs pasa directo
  const url = new URL(req.url);

  // Cross-origin (CDN de imágenes, Supabase, etc.)
  if (url.origin !== self.location.origin) {
    if (req.destination === 'image' || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url.pathname)) {
      e.respondWith(cacheFirstImg(req));                 // imágenes → guardar
    } else if (/supabase\.co\/rest\//i.test(url.href)) {
      e.respondWith(netFirstData(req));                  // datos → respaldo sin señal
    }
    return; // el resto pasa directo a la red
  }

  // Mismo origen (la app): network-first.
  e.respondWith((async function () {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      const home = await caches.match('./');
      if (home) return home;
      throw err;
    }
  })());
});
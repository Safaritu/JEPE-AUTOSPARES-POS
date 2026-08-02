// Service worker for JEPE AUTOSPARES POS.
//
// This is a POS/financial system, so correctness beats offline convenience:
// pages and app scripts are always fetched from the network when online, and
// only served from cache as a last resort when the network is unreachable.
// Only static, rarely-changing assets (icons, manifest) are cache-first.
const CACHE_VERSION = 'jepe-pos-v1';
const STATIC_ASSETS = [
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isStaticAsset = url.origin === self.location.origin && STATIC_ASSETS.includes(url.pathname);

    if (isStaticAsset) {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request))
        );
        return;
    }

    // Everything else (HTML pages, app .js modules, API calls): network-first,
    // so users always see live data/code while online. Same-origin navigations
    // and scripts get cached as an offline fallback only.
    const isSameOriginAppFile = url.origin === self.location.origin;
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (isSameOriginAppFile && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

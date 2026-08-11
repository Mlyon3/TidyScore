const LEGACY_CACHE_NAMES = ['tidyscore-shell-v1'];

self.addEventListener('activate', event => {
    event.waitUntil(Promise.all(LEGACY_CACHE_NAMES.map(cacheName => caches.delete(cacheName))));
});

const CACHE_NAME = 'stratmont-cache-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/theme.js',
    '/dashboard.html',
    '/dashboard.js',
    '/admin.html',
    '/admin.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(STATIC_ASSETS);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('/api/')) {
        // Network-first for API requests
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request))
        );
    } else {
        // Cache-first for static assets
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(
                        function(response) {
                            if(!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            var responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(function(cache) {
                                    cache.put(event.request, responseToCache);
                                });
                            return response;
                        }
                    );
                })
        );
    }
});

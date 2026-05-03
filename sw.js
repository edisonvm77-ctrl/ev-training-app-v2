/**
 * EV Training — Service Worker
 *
 * Strategy: app-shell caching for instant launch + offline-first reads
 * for static files. All network reads (Firebase, fonts CDN) go through
 * the network without being cached so they stay fresh.
 *
 * Bump CACHE_VERSION whenever you change the app shell to force a refresh.
 */

const CACHE_VERSION = 'evt-shell-v7';
const SHELL_FILES = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/styles.css',
    './js/data.js',
    './js/cloud.js',
    './js/storage.js',
    './js/auth.js',
    './js/illustrations.js',
    './js/select.js',
    './js/workout.js',
    './js/dashboard.js',
    './js/app.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache =>
            cache.addAll(SHELL_FILES).catch(err => console.warn('[SW] precache failed', err))
        )
    );
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Always go to network for Firebase/Google APIs (live data)
    if (url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firebaseapp.com') ||
        url.hostname.includes('gstatic.com') && !url.pathname.includes('firebasejs')) {
        return;
    }

    // Cache-first for our app shell + same-origin assets
    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(res => {
                // Only cache same-origin successful responses
                if (!res || res.status !== 200 || res.type !== 'basic') return res;
                const clone = res.clone();
                caches.open(CACHE_VERSION).then(c => c.put(req, clone));
                return res;
            }).catch(() => caches.match('./index.html'));
        })
    );
});

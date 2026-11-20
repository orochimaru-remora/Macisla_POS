'use strict';

const CACHE = 'posnic-static-macisla-v2';

const PRECACHE = [
  'script/dashboard.8de0f236.js',
  'style/dashboard.0b5d28cc.css',
  'static/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => (self.registration.navigationPreload ? self.registration.navigationPreload.enable() : undefined))
      .then(() => self.clients.claim())
  );
});

const REFERENCE = /^\/(api\/)?setting\/getJSON(Country|State|Currency|TimeZone|GstState)/;
const LANGUAGE_PACK = /\/languages\/(msg-)?[a-z]{2}(-[A-Za-z]{2,4})?\.json$/;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) return preloaded;
          return await fetch(request);
        } catch {
          const fallback = await caches.match('static/offline.html');
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  // Always load macisla-boot.js fresh from the network so boot/policy fixes apply immediately.
  if (url.pathname === '/static/macisla-boot.js') return;

  if (REFERENCE.test(url.pathname) || LANGUAGE_PACK.test(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) =>
          cache.match(request).then((hit) => {
            const refresh = fetch(request).then((response) => {
              if (response.ok && response.type === 'basic') cache.put(request, response.clone()).catch(() => {});
              return response;
            });
            if (hit) {
              refresh.catch(() => {});
              return hit;
            }
            return refresh;
          })
        )
        .catch(() => fetch(request))
    );
    return;
  }

  if (!/^\/(static|style|script|fonts|images)\//.test(url.pathname)) return;

  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.match(request).then((hit) => {
          if (hit) return hit;
          return fetch(request).then((response) => {
            if (response.ok && response.type === 'basic') {
              cache.put(request, response.clone());
              return response;
            }
            const fb = familyFallback(url.pathname);
            if (!response.ok && fb) {
              return cache.match(fb).then((cur) => cur || fetch(fb).catch(() => response)).then((r) => r || response);
            }
            return response;
          });
        })
      )
      .catch(() => fetch(request))
  );
});

function familyFallback(pathname) {
  const m = pathname.match(/^\/((?:script|style)\/[A-Za-z0-9_-]+)\.[0-9a-f]{8}\.(js|css)$/);
  if (!m) return null;
  const family = m[1] + '.';
  return PRECACHE.find((entry) => entry.startsWith(family) && entry !== pathname.slice(1)) || null;
}

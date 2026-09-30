/*
 * Service Worker — Time Tracking PWA (spec §33/§34/§69)
 * Static assets: cache-first. App shell (navigation): network-first with
 * offline fallback. API data is never persisted here (privacy rule §33).
 */

const VERSION = "tt-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell / navigations: network-first, cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(OFFLINE_URL, copy));
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  // Static assets: cache-first
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(woff2?|png|svg|jpg|jpeg|webp|ico|css|js)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});

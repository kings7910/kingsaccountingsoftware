const CACHE = "kings-shell-v2";
const OFFLINE_PAGE = "/offline.html";
const PUBLIC_ASSETS = [OFFLINE_PAGE, "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PUBLIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("kings-shell-") && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache account pages, API responses, or Server Component payloads.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_PAGE)) || new Response(
        "You’re offline. Reconnect and reload to continue.",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }));
  } else if (PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(url.pathname)) || Response.error();
    }));
  }
});

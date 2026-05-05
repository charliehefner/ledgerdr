// Kill-switch service worker. Replaces previous Workbox PWA worker that was
// caching stale app shells on field devices. Self-cleans and unregisters.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(clients.map((c) => {
        try {
          const url = new URL(c.url);
          url.searchParams.set("sw-cleanup", Date.now().toString());
          return c.navigate(url.toString());
        } catch (_) {
          return undefined;
        }
      }));
    } finally {
      await self.registration.unregister();
    }
  })());
});

// Bypass: never intercept fetches, so live network always wins.
self.addEventListener("fetch", () => {});

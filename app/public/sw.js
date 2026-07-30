// Minimal service worker. Its job is to make the app installable (Chrome
// requires a registered worker with a fetch handler) and to give an offline
// fallback for the static reference data — NOT to cache pages.
//
// Deliberately conservative: every page and API request goes straight to the
// network. This app's whole point is live data out of Neon — 117,000 recipes,
// ingredient databases, style guidelines — and a stale-serving worker would be
// worse than no worker at all. We learned that lesson the hard way when a
// cached homepage kept showing counts from a database it could no longer reach.
//
// The one thing worth caching is /data, the committed reference export: it is
// static, versioned by deploy, and genuinely useful offline.

const CACHE = "worthogg-v1";
const OFFLINE_CACHEABLE = ["/data"];

self.addEventListener("install", (event) => {
  // Take over immediately rather than waiting for every tab to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions of this worker.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first with a cache fallback, for the static data export only.
  if (OFFLINE_CACHEABLE.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw new Error("offline and nothing cached");
        }
      })()
    );
    return;
  }

  // Everything else: straight to the network, no caching. The fetch handler
  // still exists, which is what installability requires.
});

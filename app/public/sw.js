// Service worker for WortHogg.
//
// History matters here: an earlier worker cached a page that showed live
// database counts, and kept serving them after the database moved on. The
// lesson stuck — so the rule is still "never cache a page that shows live
// data." What changed is that the calculators no longer show live data: their
// ingredient/strain/water lists are baked into the bundle at build time
// (lib/picker-data.ts), so the calculator pages are safe to serve offline.
//
// This worker therefore caches, by strict allowlist:
//   - content-hashed build assets (/_next/static, /brand) — immutable, so
//     cache-first forever;
//   - the offline calculator routes — stale-while-revalidate (instant from
//     cache, refreshed in the background);
//   - /data, the committed reference export — network-first with a fallback.
// Everything else — recipes, brewers, /account, /api — goes straight to the
// network and is never cached. Auth and live data must never be served stale.

const CACHE = "worthogg-v2";

// The routes that carry no live data and are safe offline. An allowlist, not a
// denylist, so a new live page is never cached by accident.
const OFFLINE_ROUTES = ["/calculator", "/build", "/water/builder", "/tools", "/pitching"];
const NETWORK_FIRST = ["/data"];

const isImmutable = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/brand/") ||
  url.pathname === "/manifest.webmanifest";

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) (await caches.open(CACHE)).put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((fresh) => {
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);
  return cached || (await network) || new Response("Offline", { status: 503, statusText: "Offline" });
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) (await caches.open(CACHE)).put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("offline and nothing cached");
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Best-effort precache of the offline routes so they work on first
      // launch with no network; a failure here must not block install.
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(OFFLINE_ROUTES);
      } catch {
        /* precache is a bonus, not a requirement */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
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

  // Never cache auth or API — always live.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/account")) return;

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (OFFLINE_ROUTES.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (NETWORK_FIRST.includes(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Everything else: straight to the network, never cached.
});

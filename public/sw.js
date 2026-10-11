/* Keyboard Studio offline cache: stale-while-revalidate for same-origin GETs.
   After one visit the app shell and piano samples work without a network. */
const CACHE = 'keyboard-studio-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // The origin may be shared with other GitHub Pages projects: only
        // ever delete this app's own old caches.
        Promise.all(
          keys
            .filter((k) => k.startsWith('keyboard-studio-') && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// The page reports everything it loaded so a first visit becomes fully
// available offline without waiting for a second load.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'precache' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls
          .filter((u) => {
            try {
              return new URL(u, self.location.href).origin === self.location.origin;
            } catch {
              return false;
            }
          })
          .map((u) =>
            cache.match(u, { ignoreVary: true }).then((hit) => (hit ? null : cache.add(u).catch(() => {})))
          )
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreVary: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});

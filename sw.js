/* Campfire service worker: keeps map tiles, the map backdrop and the animal-range file in a
   local cache so panning, zooming and repeat visits don't wait on the network.
   Only those requests are handled (cache first). Their URLs carry a build version (?v=...), and
   each kind of file gets one cache per version ("campfire-tiles-<v>", "campfire-ranges-<v>");
   when a new version first shows up, the older caches of that kind are deleted.
   Everything else (the page, data.json, scripts) goes to the network as usual. */
const seen = new Set();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function cacheFor(url) {
  if (url.origin !== location.origin || !url.searchParams.has('v')) return null;
  const kind = /\/tiles\//.test(url.pathname) ? 'tiles' : /\/ranges\.json$/.test(url.pathname) ? 'ranges' : null;
  return kind && { kind, name: `campfire-${kind}-${url.searchParams.get('v')}` };
}

async function retire(kind, keep) {
  for (const k of await caches.keys()) if (k.startsWith(`campfire-${kind}-`) && k !== keep) await caches.delete(k);
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const c = cacheFor(new URL(e.request.url));
  if (!c) return;
  e.respondWith((async () => {
    const cache = await caches.open(c.name);
    if (!seen.has(c.name)) { seen.add(c.name); retire(c.kind, c.name); }
    const hit = await cache.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok) cache.put(e.request, res.clone());
    return res;
  })());
});

/* Campfire service worker: makes the site open instantly (and work offline) as a home-screen app.
   - Map tiles and the ranges file carry a build version (?v=...): cache first, one cache per version
     ("campfire-tiles-<v>", "campfire-ranges-<v>"); older versions are deleted when a new one shows up.
   - The page itself (index.html, script.js, style.css, data.json, hundred.json, the manifest and icons):
     network first, so updates appear straight away, falling back to the saved copy when offline or
     when the network takes more than a few seconds ("campfire-shell").
   - Libraries and fonts from CDNs (Leaflet, Fuse.js, Google Fonts): their URLs never change, so
     cache first ("campfire-lib-1"). */
const seen = new Set();
const SHELL = 'campfire-shell';
const LIB = 'campfire-lib-1';
const LIB_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const SHELL_FILES = /\/(index\.html|script\.js|style\.css|data\.json|hundred\.json|manifest\.webmanifest|icons\/[^/]+\.png)$/;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  const scope = self.registration.scope;
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([scope, 'script.js', 'style.css', 'data.json', 'manifest.webmanifest'].map((u) => new URL(u, scope).href))).catch(() => {}));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function versioned(url) {
  if (url.origin !== location.origin || !url.searchParams.has('v')) return null;
  const kind = /\/tiles\//.test(url.pathname) ? 'tiles' : /\/ranges\.json$/.test(url.pathname) ? 'ranges' : null;
  return kind && { kind, name: `campfire-${kind}-${url.searchParams.get('v')}` };
}

async function retire(kind, keep) {
  for (const k of await caches.keys()) if (k.startsWith(`campfire-${kind}-`) && k !== keep) await caches.delete(k);
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

// Network first; the saved copy if the network fails or is slow. Pages are all saved under the
// app's start address, so any page address works offline.
async function networkFirst(req, key) {
  const cache = await caches.open(SHELL);
  const net = fetch(req).then((res) => { if (res.ok) cache.put(key, res.clone()); return res; });
  const slow = new Promise((resolve) => setTimeout(resolve, 4000));
  try {
    const res = await Promise.race([net, slow.then(() => cache.match(key).then((hit) => hit || net))]);
    return res || (await net);
  } catch {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const v = versioned(url);
  if (v) {
    if (!seen.has(v.name)) { seen.add(v.name); retire(v.kind, v.name); }
    e.respondWith(cacheFirst(req, v.name));
    return;
  }
  if (LIB_HOSTS.includes(url.hostname)) { e.respondWith(cacheFirst(req, LIB)); return; }
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, self.registration.scope)); return; }
  if (SHELL_FILES.test(url.pathname)) e.respondWith(networkFirst(req, url.origin + url.pathname));
});

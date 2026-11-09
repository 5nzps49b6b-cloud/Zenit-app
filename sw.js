/* Zenit Offline-Speicher. Bei einer neuen Version die Nummer erhöhen. */
const CACHE = 'zenit-v6';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  /* Die App selbst: zuerst aus dem Netz (damit Updates sofort da sind), offline aus dem Speicher. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await Promise.race([
          fetch(req, { cache: 'no-store' }),
          new Promise((_, rej) => setTimeout(() => rej('timeout'), 4000))
        ]);
        if (res && res.ok) { c.put('index.html', res.clone()); return res; }
        throw 'bad';
      } catch (err) {
        return (await c.match('index.html')) || (await c.match('./')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  /* Icons usw.: aus dem Speicher, im Hintergrund aktualisieren. */
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Offline', { status: 503 });
  }));
});

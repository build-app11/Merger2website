/* pocket-sw.js — mengaktifkan multi-thread (SharedArrayBuffer) dari sisi browser, tanpa mengatur header di hosting.
   Taruh di folder yang sama dengan player-reading.html. Cakupannya hanya halaman player; service worker lain tidak diubah.
   Yang dilakukan: menambahkan header COOP dan COEP pada halaman. Permintaan lain diteruskan ke jaringan,
   dengan cadangan dari Cache Storage saat offline. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || (req.cache === 'only-if-cached' && req.mode !== 'same-origin')) return;
  const page = req.mode === 'navigate';
  e.respondWith((async () => {
    let res;
    try { res = await fetch(req); }
    catch (err) {
      res = await caches.match(req, { ignoreSearch: page });
      if (!res) throw err;
    }
    if (!page || res.status === 0) return res;
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  })());
});

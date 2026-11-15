/* Service worker Learning Fun: jaringan dulu, cache sebagai cadangan.
   - Selalu mengambil versi terbaru bila online (tidak ada halaman basi), dan memakai salinan terakhir bila offline atau lambat (>4 dtk).
   - Hanya permintaan GET ke situs yang sama. /api/* (server) dan sumber luar (audio, gambar, YouTube) tidak disentuh.
   - Naikkan VERSION untuk membuang cache lama. */
'use strict';
var VERSION = 'lf-v5', SHELL = ['./', 'index.html', 'akun.html', 'i18n.js', 'lf-stats.js', 'lf-collect.js', 'lf-goals.js', 'pwa.js', 'lf-api.js', 'manifest.webmanifest', 'icons/icon-192.png', 'data/index.json', 'data/card.json'];
var SLOW_MS = 4000;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));   // satu file gagal tidak membatalkan yang lain
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION && k !== 'lf-offline'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function cacheable(req, url) {
  if (req.method !== 'GET' || url.origin !== self.location.origin) return false;
  if (url.pathname.indexOf('/api/') === 0) return false;
  if (req.headers.has('range')) return false;                // permintaan sebagian (media) tidak di-cache
  return /\.(?:html|js|json|css|png|svg|webmanifest|txt|xml)$/i.test(url.pathname) || url.pathname === '/' || url.pathname.slice(-1) === '/';
}
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (!cacheable(req, url)) return;
  e.respondWith(new Promise(function (resolve) {
    var done = false, timer;
    function fromCache() { return caches.match(req, { ignoreSearch: req.mode === 'navigate' && url.pathname.slice(-5) === '.html' }); }
    function fallback() {
      fromCache().then(function (hit) { if (!done) { done = true; clearTimeout(timer); resolve(hit || Response.error()); } });
    }
    timer = setTimeout(function () {                        // jaringan lambat: pakai salinan bila ada, tapi tunggu jaringan kalau belum ada
      fromCache().then(function (hit) { if (hit && !done) { done = true; resolve(hit); } });
    }, SLOW_MS);
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {}); }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(fallback);
  }));
});

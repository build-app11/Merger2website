/* Mendaftarkan service worker (sw.js) supaya halaman yang pernah dibuka tetap tersedia offline.
   Hanya di https atau localhost. Tambahkan ?nosw ke alamat untuk mematikan dan menghapus cache. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var ok = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!ok) return;
  var off = /[?&]nosw\b/.test(location.search);
  window.addEventListener('load', function () {
    if (off) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
      return;
    }
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
})();

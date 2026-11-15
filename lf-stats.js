/* Learning Fun: pencatat statistik belajar (disimpan di localStorage "lf:stats").
   Bentuk data: { v:1, days: { "2026-11-14": { listen: detik, reads: n, words: n, langs: { en: { listen, reads, words } } } } }
   Semua fungsi aman dipanggil kapan saja; kegagalan penyimpanan diabaikan.

   LFStats.listen(sec, lang)   tambah waktu mendengarkan
   LFStats.read(slug, lang)    catat satu bacaan selesai (sekali per slug per hari)
   LFStats.word(n, lang)       catat kata baru dipelajari
   LFStats.track(isPlaying, getLang)  hitung waktu putar tiap detik selama isPlaying() true dan tab terlihat
   LFStats.get()               baca seluruh data
   LFStats.day(d)              kunci hari lokal "YYYY-MM-DD" */
(function () {
  var KEY = 'lf:stats', MAXDAYS = 400;
  var day = function (d) { return (d || new Date()).toLocaleDateString('sv'); };
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v === 'object' && v.days && typeof v.days === 'object') return v; } catch (e) {}
    return { v: 1, days: {} };
  }
  function save(s) {
    var ks = Object.keys(s.days).sort();
    if (ks.length > MAXDAYS) ks.slice(0, ks.length - MAXDAYS).forEach(function (k) { delete s.days[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function code(l) {
    l = String(l || '').toLowerCase().split('-')[0];
    if (/^[a-z]{2,3}$/.test(l)) return l;
    try { if (window.LFL && LFL.code) return LFL.code; } catch (e) {}
    return 'en';
  }
  function bump(field, n, lang, seen) {
    n = +n; if (!(n > 0)) return;
    var s = load(), k = day(), d = s.days[k] || (s.days[k] = { listen: 0, reads: 0, words: 0, langs: {} });
    var c = code(lang), L = d.langs[c] || (d.langs[c] = { listen: 0, reads: 0, words: 0 });
    d[field] = (d[field] || 0) + n; L[field] = (L[field] || 0) + n;
    if (seen) { d.seen = d.seen || []; if (d.seen.indexOf(seen) < 0) d.seen.push(seen); }
    save(s);
  }
  var pend = 0, pendLang = null;
  function flush() { if (pend > 0) { bump('listen', Math.round(pend), pendLang); pend = 0; } }
  var api = window.LFStats = {
    KEY: KEY,
    day: day,
    get: load,
    listen: function (sec, lang) { bump('listen', Math.round(sec), lang); },
    word: function (n, lang) { bump('words', n == null ? 1 : n, lang); },
    read: function (slug, lang) {
      var s = load(), d = s.days[day()];
      if (slug && d && d.seen && d.seen.indexOf(slug) >= 0) return;
      bump('reads', 1, lang, slug || '');
    },
    track: function (isPlaying, getLang) {
      var last = 0;
      setInterval(function () {
        var now = Date.now(), dt = last ? (now - last) / 1000 : 0; last = now;
        var on = false; try { on = !!isPlaying(); } catch (e) {}
        if (!on || document.hidden || dt <= 0 || dt > 5) return;   // lompatan besar = tab tertidur, jangan dihitung
        var lg = null; try { lg = getLang && getLang(); } catch (e) {}
        if (pendLang && pendLang !== code(lg)) flush();
        pendLang = code(lg); pend += dt;
        if (pend >= 10) flush();                                     // simpan tiap ~10 detik, bukan tiap detik
      }, 1000);
      addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
    }
  };
})();

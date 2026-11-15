/* Learning Fun: target belajar harian dan tantangan harian (disimpan di localStorage, ikut cadangan di akun.html).
   Membaca statistik dari lf-stats.js ('lf:stats') dan progres path ('lf:path'); riwayat dari lf-collect.js bila ada.

   Kunci:
     lf:goals  { listen: menit/hari, reads: bacaan/hari, words: kata baru/hari }   0 = target dimatikan
     lf:daily  { pick: { d: "YYYY-MM-DD", slug }, done: { "YYYY-MM-DD": slug } }

   LFG.goals() / setGoals(g)     target (bawaan 10 menit, 1 bacaan, 5 kata)
   LFG.today()                   { listen (menit, pecahan), reads, words } hari ini
   LFG.progress(tanggal)         sama, untuk tanggal tertentu
   LFG.met(tanggal)              true bila semua target aktif tercapai (minimal satu target aktif)
   LFG.streak()                  hari beruntun target tercapai; hari ini yang belum tercapai tidak memutus
   LFG.pick(slugs, valid)        slug tantangan hari ini: dipilih sekali per hari dari slugs, lalu tetap selama masih ada di valid
   LFG.challengeDone(slug)       true bila tantangan selesai hari ini (lihat aturan di bawah)
   LFG.markDone(slug)            catat tantangan selesai
   LFG.challengeStreak()         hari beruntun tantangan selesai

   Tantangan dianggap selesai bila hari ini: pelajaran itu ditandai selesai di path, atau tercatat selesai dibaca di statistik,
   atau dibuka (riwayat) dan kamu mendengarkan minimal 3 menit. Setiap perubahan memicu window event 'lfg:change'. */
(function () {
  'use strict';
  var KG = 'lf:goals', KD = 'lf:daily', DEF = { listen: 10, reads: 1, words: 5 }, LISTEN_MIN = 180;
  function rd(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return false; } try { window.dispatchEvent(new CustomEvent('lfg:change')); } catch (e) {} return true; }
  var isObj = function (v) { return v && typeof v === 'object' && !Array.isArray(v); };
  var dayKey = function (d) { return (d || new Date()).toLocaleDateString('sv'); };
  var shift = function (k, n) { var p = k.split('-'); return dayKey(new Date(+p[0], +p[1] - 1, +p[2] + n)); };
  var num = function (v, max, d) { v = Math.round(+v); return isFinite(v) && v >= 0 ? Math.min(v, max) : d; };

  function goals() {
    var g = rd(KG, null); if (!isObj(g)) return { listen: DEF.listen, reads: DEF.reads, words: DEF.words };
    return { listen: num(g.listen, 600, DEF.listen), reads: num(g.reads, 50, DEF.reads), words: num(g.words, 500, DEF.words) };
  }
  function stats() { try { var s = window.LFStats && LFStats.get(); if (s && isObj(s.days)) return s.days; } catch (e) {} var s2 = rd('lf:stats', null); return s2 && isObj(s2.days) ? s2.days : {}; }
  function progress(k) {
    var d = stats()[k || dayKey()] || {};
    return { listen: (+d.listen || 0) / 60, reads: +d.reads || 0, words: +d.words || 0 };
  }
  function met(k) {
    var g = goals(), p = progress(k), on = false;
    for (var f in g) { if (g[f] > 0) { on = true; if (p[f] < g[f]) return false; } }
    return on;
  }
  function streak() {
    var k = dayKey(), n = 0; if (!met(k)) k = shift(k, -1);
    while (n < 4000 && met(k)) { n++; k = shift(k, -1); }
    return n;
  }
  function daily() { var v = rd(KD, null); v = isObj(v) ? v : {}; if (!isObj(v.done)) v.done = {}; return v; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(slugs, valid) {   /* valid: semua slug yang boleh (pilihan lama di luar daftar ini dibuang) */
    var v = daily(), t = dayKey();
    if (v.pick && v.pick.d === t && v.pick.slug && (!valid || valid.indexOf(v.pick.slug) >= 0)) return v.pick.slug;
    if (!slugs || !slugs.length) return '';
    var s = slugs[hash(t) % slugs.length];
    v.pick = { d: t, slug: s }; wr(KD, v); return s;
  }
  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function challengeDone(slug) {
    if (!slug) return false;
    var v = daily(), t = dayKey(), t0 = startOfToday();
    if (v.done[t] === slug) return true;
    var p = rd('lf:path', null), at = p && isObj(p.done) && p.done[slug] && +p.done[slug].at || 0;
    if (at >= t0) return true;
    var sd = stats()[t] || {};
    if (Array.isArray(sd.seen) && sd.seen.indexOf(slug) >= 0) return true;
    if ((+sd.listen || 0) >= LISTEN_MIN && window.LFC) {
      var h = LFC.history(); for (var i = 0; i < h.length; i++) if (h[i].s === slug && h[i].t >= t0) return true;
    }
    return false;
  }
  function markDone(slug) { var v = daily(), t = dayKey(); if (v.done[t] === slug) return; v.done[t] = slug; wr(KD, v); }
  function challengeStreak() {
    var v = daily(), k = dayKey(), n = 0; if (!v.done[k]) k = shift(k, -1);
    while (n < 4000 && v.done[k]) { n++; k = shift(k, -1); }
    return n;
  }

  window.LFG = {
    DEFAULTS: DEF, day: dayKey, goals: goals,
    setGoals: function (g) { g = g || {}; return wr(KG, { listen: num(g.listen, 600, DEF.listen), reads: num(g.reads, 50, DEF.reads), words: num(g.words, 500, DEF.words) }); },
    today: function () { return progress(); }, progress: progress, met: met, streak: streak,
    pick: pick, challengeDone: challengeDone, markDone: markDone, challengeStreak: challengeStreak
  };
})();

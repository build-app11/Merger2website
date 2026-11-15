/* Learning Fun: koleksi pribadi (suka, simpan untuk nanti, riwayat, playlist). Semua disimpan di localStorage dan ikut cadangan di akun.html.
   Pelajaran dikenali lewat slug (nama file di folder data tanpa .json), sama dengan parameter ?q= di semua pemutar.

   Kunci:
     lf:likes   { slug: waktu }
     lf:later   { slug: waktu }
     lf:hist    [ { s: slug, t: waktu } ]   terbaru di depan, satu entri per slug, maksimal 200
     lf:lists   [ { id, name, items: [slug], at } ]

   LFC.isLiked(s) / toggleLike(s)        LFC.isLater(s) / toggleLater(s)
   LFC.likes() / later()                 daftar slug, terbaru dulu
   LFC.record(s)                         catat pelajaran dibuka (pindah ke paling atas)
   LFC.history() / removeHistory(s) / clearHistory()
   LFC.lists() / createList(nama) / renameList(id, nama) / deleteList(id)
   LFC.inList(id, s) / addToList(id, s) / removeFromList(id, s) / listsOf(s)
   LFC.slug()                            slug dari ?q= di halaman ini ('' bila tidak ada)
   Setiap perubahan memicu window event 'lfc:change'. Semua fungsi aman dipanggil kapan saja. */
(function () {
  'use strict';
  var K = { like: 'lf:likes', later: 'lf:later', hist: 'lf:hist', lists: 'lf:lists' }, MAXH = 200;
  function rd(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return false; } try { window.dispatchEvent(new CustomEvent('lfc:change', { detail: { key: k } })); } catch (e) {} return true; }
  var isObj = function (v) { return v && typeof v === 'object' && !Array.isArray(v); };
  var map = function (k) { var v = rd(k, {}); return isObj(v) ? v : {}; };
  var byNew = function (m) { return Object.keys(m).sort(function (a, b) { return (+m[b] || 0) - (+m[a] || 0); }); };
  var okSlug = function (s) { return typeof s === 'string' && s.length > 0 && s.length < 300; };

  function flag(key) {
    return {
      is: function (s) { return !!map(key)[s]; },
      toggle: function (s) {
        if (!okSlug(s)) return false;
        var m = map(key), on = !m[s];
        if (on) m[s] = Date.now(); else delete m[s];
        wr(key, m); return on;
      },
      all: function () { return byNew(map(key)); }
    };
  }
  var L = flag(K.like), Q = flag(K.later);

  function hist() { var a = rd(K.hist, []); return Array.isArray(a) ? a.filter(function (x) { return x && okSlug(x.s); }) : []; }
  function lists() {
    var a = rd(K.lists, []);
    return Array.isArray(a) ? a.filter(function (x) { return x && x.id && typeof x.name === 'string'; }).map(function (x) { return { id: String(x.id), name: x.name, items: Array.isArray(x.items) ? x.items.filter(okSlug) : [], at: +x.at || 0 }; }) : [];
  }
  function saveLists(a) { return wr(K.lists, a); }
  var clean = function (n) { return String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, 60); };
  function uid() { return 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  window.LFC = {
    isLiked: L.is, toggleLike: L.toggle, likes: L.all,
    isLater: Q.is, toggleLater: Q.toggle, later: Q.all,
    record: function (s) {
      if (!okSlug(s)) return;
      var a = hist().filter(function (x) { return x.s !== s; });
      a.unshift({ s: s, t: Date.now() });
      wr(K.hist, a.slice(0, MAXH));
    },
    history: hist,
    removeHistory: function (s) { wr(K.hist, hist().filter(function (x) { return x.s !== s; })); },
    clearHistory: function () { wr(K.hist, []); },
    lists: lists,
    createList: function (name) {
      name = clean(name); if (!name) return null;
      var a = lists(), x = { id: uid(), name: name, items: [], at: Date.now() };
      a.push(x); saveLists(a); return x;
    },
    renameList: function (id, name) {
      name = clean(name); if (!name) return false;
      var a = lists(), x = a.filter(function (y) { return y.id === id; })[0]; if (!x) return false;
      x.name = name; return saveLists(a);
    },
    deleteList: function (id) { saveLists(lists().filter(function (y) { return y.id !== id; })); },
    inList: function (id, s) { var x = lists().filter(function (y) { return y.id === id; })[0]; return !!x && x.items.indexOf(s) >= 0; },
    addToList: function (id, s) {
      if (!okSlug(s)) return false;
      var a = lists(), x = a.filter(function (y) { return y.id === id; })[0]; if (!x) return false;
      if (x.items.indexOf(s) < 0) x.items.push(s);
      return saveLists(a);
    },
    removeFromList: function (id, s) {
      var a = lists(), x = a.filter(function (y) { return y.id === id; })[0]; if (!x) return false;
      x.items = x.items.filter(function (i) { return i !== s; }); return saveLists(a);
    },
    listsOf: function (s) { return lists().filter(function (y) { return y.items.indexOf(s) >= 0; }); },
    slug: function () { try { return (new URLSearchParams(location.search).get('q') || '').trim(); } catch (e) { return ''; } }
  };

  /* pemutar (video, audio, bacaan) memuat berkas ini lewat <script data-record>: pelajaran yang dibuka dicatat ke riwayat */
  try {
    var cs = document.currentScript;
    if (cs && cs.hasAttribute('data-record')) { var s = window.LFC.slug(); if (s) window.LFC.record(s); }
  } catch (e) {}
})();

/* i18n Learning Fun: lapisan terjemahan terpisah. Kode dan markup halaman TIDAK diubah.
   - Bahasa asli: Indonesia (id). Di bahasa id, skrip ini tidak melakukan apa-apa selain menyediakan menu bahasa.
   - Bahasa lain dibaca dari data/language.json  { "languages": [[kode, nama]], "strings": { kode: { key: teks } } }.
     Teks Indonesia (strings.id) dicocokkan dengan teks yang tampil di halaman, lalu diganti dengan teks bahasa terpilih
     pada teks di halaman, atribut (placeholder, aria-label, title, alt), judul, serta alert/confirm/prompt.
     Teks yang mengandung {n}, {a}, {b}, {q} dicocokkan sebagai pola. Teks tanpa terjemahan tetap Indonesia.
   - Pilih bahasa lewat menu <div data-lang-menu></div> atau ?lang=<kode> (tersimpan di localStorage "lf:lang"). */
(function () {
  'use strict';
  var lang = 'id', DATA = null;
  try { var q = new URLSearchParams(location.search).get('lang'); if (q) localStorage.setItem('lf:lang', q); lang = localStorage.getItem('lf:lang') || 'id'; } catch (e) {}
  if (!/^[a-zA-Z]{2,3}(-[A-Za-z0-9]+)?$/.test(lang)) lang = 'id';
  window.LANG = lang;

  function loadSync() {
    try {
      var x = new XMLHttpRequest(); x.open('GET', 'data/language.json', false); x.send();
      if (x.status === 200 || (x.status === 0 && x.responseText)) return JSON.parse(x.responseText);
    } catch (e) {}
    return null;
  }

  /* ---------- Penerjemah ---------- */
  var exact = Object.create(null), pats = [], cache = Object.create(null), active = false;
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function build() {
    var S = DATA.strings || {}, id = S.id || {}, tg = S[lang] || {};
    Object.keys(id).forEach(function (k) {
      var from = id[k], to = tg[k];
      if (typeof from !== 'string' || typeof to !== 'string' || !to || to === from) return;
      from = norm(from); if (from.length < 2 || /…/.test(from)) return;
      if (/\{[A-Za-z0-9_]+\}/.test(from)) {
        var names = [], re = '^' + from.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{([A-Za-z0-9_]+)\}/g, function (m, n) { names.push(n); return '(.+?)'; }) + '$';
        try { pats.push({ re: new RegExp(re), names: names, to: to }); } catch (e) {}
      } else if (!(from in exact)) exact[from] = to;
    });
    pats.sort(function (a, b) { return b.re.source.length - a.re.source.length; });
    active = Object.keys(exact).length + pats.length > 0;
  }
  function tr(s) {                                           // teks utuh -> terjemahan, atau null
    var n = norm(s); if (!n || n.length > 400) return null;
    if (n in cache) return cache[n];
    var r = exact[n];
    if (r == null) for (var i = 0; i < pats.length; i++) {
      var m = pats[i].re.exec(n);
      if (m) { r = pats[i].to.replace(/\{([A-Za-z0-9_]+)\}/g, function (x, name) { var j = pats[i].names.indexOf(name); return j >= 0 ? m[j + 1] : x; }); break; }
    }
    cache[n] = r == null ? null : r; return cache[n];
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 0, NOSCRIPT: 1 };
  function skipEl(el) { return !el || SKIP[el.nodeName] === 1 || (el.closest && el.closest('[translate=no],[data-no-i18n]')); }
  function doText(node) {
    var par = node.parentNode; if (!par || skipEl(par)) return;
    var v = node.data; if (node.__lf === v) return;
    var r = tr(v); if (r == null) return;
    var lead = /^\s*/.exec(v)[0], trail = /\s*$/.exec(v)[0]; var nv = lead + r + trail;
    node.__lf = nv; node.data = nv;
  }
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  function doEl(el) {
    if (skipEl(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]); if (!a) continue;
      var key = '__lf_' + ATTRS[i]; if (el[key] === a) continue;
      var r = tr(a); if (r != null) { el[key] = r; el.setAttribute(ATTRS[i], r); }
    }
    if (el.nodeName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type)) { var v = el.getAttribute('value'); if (v && el.__lf_value !== v) { var r2 = tr(v); if (r2 != null) { el.__lf_value = r2; el.setAttribute('value', r2); } } }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skipEl(root)) return; doEl(root); }
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function start() {
    var mo = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'childList') for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        else if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doEl(m.target);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['value']) });
    walk(document.documentElement);
    document.addEventListener('DOMContentLoaded', function () { walk(document.documentElement); });
  }
  ['alert', 'confirm', 'prompt'].forEach(function (n) {
    var o = window[n]; if (typeof o !== 'function') return;
    window[n] = function (m) { if (active && typeof m === 'string') { var r = tr(m); if (r != null) arguments[0] = r; } return o.apply(window, arguments); };
  });

  if (lang !== 'id') {
    DATA = loadSync();
    if (DATA && DATA.strings) {
      window.I18N_DATA = DATA; build();
      var rtl = /^(ar|he|fa|ur)(-|$)/i.test(lang);
      document.documentElement.lang = lang; document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      if (active) start();
    }
  }
  window.LFt = function (k, d) { var S = (DATA && DATA.strings) || {}; var v = (S[lang] || {})[k]; return v != null ? v : (d != null ? d : k); };

  /* ---------- Menu bahasa: <div data-lang-menu></div> ---------- */
  var css = '.lfl{position:relative}.lfl-btn{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 12px;border:2.5px solid var(--line,#14162B);border-radius:999px;background:var(--surface,#fff);color:inherit;font:inherit;font-weight:700;cursor:pointer;box-shadow:3px 3px 0 var(--shadow,#14162B)}'
    + '.lfl-btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--shadow,#14162B)}.lfl-btn svg{flex:none}.lfl-btn .car{font-size:.7rem;font-style:normal;transition:transform .15s}.lfl-btn[aria-expanded=true] .car{transform:rotate(180deg)}'
    + '.lfl-pop{position:absolute;top:calc(100% + 10px);right:0;z-index:60;width:min(340px,calc(100vw - 24px));max-height:min(70vh,520px);overflow:auto;padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:2px 4px;background:var(--surface,#fff);color:var(--ink,#14162B);border:2.5px solid var(--line,#14162B);border-radius:18px;box-shadow:6px 6px 0 var(--shadow,#14162B)}'
    + '.lfl-pop[hidden]{display:none}.lfl-it{display:flex;align-items:center;gap:10px;min-width:0;padding:10px;border:0;border-radius:12px;background:none;color:inherit;font:inherit;font-weight:600;text-align:start;cursor:pointer}'
    + '.lfl-it:hover,.lfl-it:focus-visible{background:var(--bg,#EEF2FF)}.lfl-it b{flex:none;width:2.2em;font-size:.72rem;letter-spacing:.04em;color:var(--muted,#4F5575)}.lfl-it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.lfl-it[aria-current=true]{background:var(--blue,#4C84FF);color:#fff}.lfl-it[aria-current=true] b{color:#fff}'
    + '[dir=rtl] .lfl-pop{right:auto;left:0}@media(max-width:420px){.lfl-pop{position:fixed;top:72px;left:12px;right:12px;width:auto}}';
  function mount(box) {
    var loaded = !!(DATA && DATA.languages), pop, btn;
    box.setAttribute('translate', 'no'); box.className = (box.className + ' lfl').trim();
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'lfl-btn'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Language / Bahasa');
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg><span></span><i class="car" aria-hidden="true">▲</i>';
    btn.querySelector('span').textContent = lang.split('-')[0].toUpperCase();
    pop = document.createElement('div'); pop.className = 'lfl-pop'; pop.hidden = true; pop.setAttribute('role', 'menu');
    box.append(btn, pop);
    function build2() {
      pop.textContent = '';
      ((DATA && DATA.languages) || [['id', 'Indonesia']]).forEach(function (l) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'lfl-it'; b.setAttribute('role', 'menuitem'); b.lang = l[0]; b.title = l[1];
        if (l[0].toLowerCase() === lang.toLowerCase()) b.setAttribute('aria-current', 'true');
        b.innerHTML = '<b></b><span></span>'; b.firstChild.textContent = l[0].split('-')[0].toUpperCase(); b.lastChild.textContent = l[1];
        b.addEventListener('click', function () {
          try { localStorage.setItem('lf:lang', l[0]); } catch (e) {}
          var u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.href;   // muat ulang: semua teks berganti
        });
        pop.appendChild(b);
      });
    }
    function open(v) { pop.hidden = !v; btn.setAttribute('aria-expanded', v ? 'true' : 'false'); if (v) { var c = pop.querySelector('[aria-current]') || pop.firstChild; c && c.focus(); } }
    btn.addEventListener('click', function () {
      if (!pop.hidden) return open(false);
      if (!loaded) {
        loaded = true;
        fetch('data/language.json').then(function (r) { return r.json(); }).then(function (j) { DATA = j; }).catch(function () {}).then(function () { build2(); if (!pop.hidden) open(true); });
      }
      build2(); open(true);
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) open(false); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { open(false); btn.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { var its = [].slice.call(pop.querySelectorAll('.lfl-it')), i = its.indexOf(document.activeElement); if (!pop.hidden && its.length) { e.preventDefault(); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length].focus(); } }
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var boxes = document.querySelectorAll('[data-lang-menu]'); if (!boxes.length) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    [].forEach.call(boxes, mount);
  });
})();

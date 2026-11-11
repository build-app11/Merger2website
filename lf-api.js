/* Klien kecil untuk server (server.js): dipakai reading-generator.html dan player-reading.html.
   - Halaman dibuka dari server ini  -> alamat relatif ("/api/...") dan fitur server langsung aktif.
   - Halaman di-host terpisah (mis. GitHub Pages) -> isi alamat server di panel "Server"; server perlu CORS_ORIGIN.
   - Server tidak terjangkau -> LF.up = false dan halaman memakai cadangan di browser. */
(function () {
  var KEY = 'lf:api', L = { base: '', up: false, version: '', ready: null };
  function lsGet() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function lsSet(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }
  function clean(u) {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { var x = new URL(u); return x.origin + x.pathname.replace(/\/+$/, ''); } catch (e) { return ''; }
  }
  function ping(base) {
    var ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 5000);
    return fetch(base + '/api/health', { signal: ac.signal, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && j.ok && j.app === 'learning-fun' ? j : null; })
      .catch(function () { return null; })
      .then(function (j) { clearTimeout(t); return j; });
  }
  L.url = function (p) { return L.base + p; };
  L.probe = function () {
    var saved = clean(lsGet()), cands = saved ? [saved, ''] : [''];
    if (location.protocol === 'file:') cands = saved ? [saved] : [];
    var i = 0;
    L.ready = (function next() {
      if (i >= cands.length) { L.up = false; L.base = ''; return Promise.resolve(L); }
      var b = cands[i++];
      return ping(b).then(function (j) { if (j) { L.up = true; L.base = b; L.version = j.version || ''; return L; } return next(); });
    })().then(function (x) { document.dispatchEvent(new CustomEvent('lf:server', { detail: { up: L.up, base: L.base } })); return x; });
    return L.ready;
  };
  L.setBase = function (v) { lsSet(clean(v)); return L.probe(); };
  function fail(r) {
    return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || ('Server membalas HTTP ' + r.status)); });
  }
  L.get = function (path, signal) {
    return fetch(L.url(path), { signal: signal }).then(function (r) { return r.ok ? r.json() : fail(r); });
  };
  L.post = function (path, body, signal) {
    return fetch(L.url(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal })
      .then(function (r) { return r.ok ? r.json() : fail(r); });
  };
  L.postBlob = function (path, body, signal) {
    return fetch(L.url(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal })
      .then(function (r) { return r.ok ? r.blob() : fail(r); });
  };
  L.upload = function (path, form, signal) {
    return fetch(L.url(path), { method: 'POST', body: form, signal: signal }).then(function (r) { return r.ok ? r.json() : fail(r); });
  };
  /* Aliran NDJSON (transkripsi): memanggil onMsg untuk tiap baris JSON */
  L.stream = function (path, body, onMsg, signal) {
    return fetch(L.url(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: signal }).then(function (r) {
      if (!r.ok) return fail(r);
      var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return rd.read().then(function (x) {
          if (x.done) { if (buf.trim()) { try { onMsg(JSON.parse(buf)); } catch (e) {} } return; }
          buf += dec.decode(x.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n')) >= 0) { var line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) { try { onMsg(JSON.parse(line)); } catch (e) {} } }
          return pump();
        });
      }
      return pump();
    });
  };
  /* Panel kecil "Server": status + kolom alamat. Dipasang ke elemen yang diberikan. */
  L.mountPanel = function (el) {
    el.innerHTML = '<details class="lfsrv"><summary><span class="dot"></span><span class="st">Server: memeriksa…</span></summary>' +
      '<div class="lfbody"><p class="hint">Fitur server (ekstraksi PDF/EPUB/DOCX, artikel, berita, transkripsi Whisper, suara Piper/Pocket/Supertonic, IPA, terjemahan) aktif bila halaman dibuka dari server proyek ini, atau bila alamat server diisi di bawah.</p>' +
      '<div class="lfrow"><input type="url" class="lfurl" placeholder="https://…-3000.app.github.dev" spellcheck="false" autocomplete="off" aria-label="Alamat server"><button type="button" class="sbtn lfgo">Hubungkan</button></div></div></details>';
    var st = el.querySelector('.st'), dot = el.querySelector('.dot'), inp = el.querySelector('.lfurl');
    function draw() {
      dot.className = 'dot ' + (L.up ? 'on' : 'off');
      st.textContent = L.up ? 'Server tersambung' + (L.base ? ' · ' + L.base.replace(/^https?:\/\//, '') : '') : 'Server tidak ada: memakai cadangan di browser';
      inp.value = lsGet();
    }
    el.querySelector('.lfgo').onclick = function () { st.textContent = 'Menghubungkan…'; L.setBase(inp.value).then(draw); };
    document.addEventListener('lf:server', draw);
    draw();
  };
  window.LF = L;
  L.probe();
})();

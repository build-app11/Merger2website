"use strict";
// npm run netsafe:test : menguji netsafe.js tanpa jaringan luar (server uji berjalan di 127.0.0.1).
const assert = require("assert");
const http = require("http");
const zlib = require("zlib");
const ns = require("./netsafe");

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("ok   " + name); } catch (e) { fail++; console.log("GAGAL " + name + "\n     " + (e && e.message)); }
}
const rejects = async (p, re) => { try { await p; } catch (e) { assert.match(String(e.message), re); return; } assert.fail("seharusnya ditolak"); };

(async () => {
  delete process.env.ALLOW_PRIVATE_URLS;

  await t("isPrivate: IPv4 lokal dan khusus", () => {
    ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "198.18.0.1", "224.0.0.1", "255.255.255.255"]
      .forEach((ip) => assert.strictEqual(ns.isPrivate(ip), true, ip));
  });
  await t("isPrivate: IPv6 lokal, mapped, NAT64", () => {
    ["::1", "::", "fe80::1", "fd00::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::1"]
      .forEach((ip) => assert.strictEqual(ns.isPrivate(ip), true, ip));
  });
  await t("isPrivate: alamat publik lolos, teks bukan IP ditolak", () => {
    ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"]
      .forEach((ip) => assert.strictEqual(ns.isPrivate(ip), false, ip));
    assert.strictEqual(ns.isPrivate("example.com"), true);
    assert.strictEqual(ns.isPrivate(""), true);
  });

  await t("safeFetch menolak alamat lokal dalam berbagai tulisan", async () => {
    for (const u of ["http://127.0.0.1:1/", "http://localhost:1/", "http://[::1]:1/", "http://[::ffff:127.0.0.1]:1/", "http://2130706433:1/", "http://0x7f.1:1/", "http://169.254.169.254/latest/meta-data/"])
      await rejects(ns.safeFetch(u, { signal: AbortSignal.timeout(3000) }), /Alamat tidak diizinkan/);
  });
  await t("safeFetch menolak skema selain http/https dan URL rusak", async () => {
    await rejects(ns.safeFetch("file:///etc/passwd"), /http atau https/);
    await rejects(ns.safeFetch("ftp://example.com/"), /http atau https/);
    await rejects(ns.safeFetch("bukan url"), /tidak valid/);
  });

  // server uji: /ok, /redir (ke /ok), /loop, /to-private (mengalihkan ke alamat lokal)
  let port, hops = 0;
  const srv = http.createServer((req, res) => {
    if (req.url === "/ok") { res.setHeader("Content-Type", "text/plain"); return res.end("halo"); }
    if (req.url === "/redir") { res.writeHead(302, { Location: "/ok" }); return res.end(); }
    if (req.url === "/loop") { hops++; res.writeHead(302, { Location: "/loop" }); return res.end(); }
    if (req.url === "/to-private") { process.env.ALLOW_PRIVATE_URLS = ""; res.writeHead(302, { Location: "http://127.0.0.1:" + port + "/ok" }); return res.end(); }
    if (req.url === "/gz") { res.writeHead(200, { "Content-Encoding": "gzip" }); return res.end(zlib.gzipSync("isi terkompresi")); }
    if (req.url === "/nocontent") { res.writeHead(204); return res.end(); }
    res.writeHead(404); res.end("tidak ada");
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  port = srv.address().port;
  const base = "http://127.0.0.1:" + port;

  await t("safeFetch (mode pengembangan) mengambil, mengikuti pengalihan, membaca isi", async () => {
    process.env.ALLOW_PRIVATE_URLS = "1";
    const r = await ns.safeFetch(base + "/redir", { signal: AbortSignal.timeout(3000) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(await r.text(), "halo");
    assert.strictEqual(r.finalUrl, base + "/ok");
    const n = await ns.safeFetch(base + "/nope", { signal: AbortSignal.timeout(3000) });
    assert.strictEqual(n.status, 404); assert.strictEqual(await n.text(), "tidak ada");
    const g = await ns.safeFetch(base + "/gz", { signal: AbortSignal.timeout(3000) });
    assert.strictEqual(await g.text(), "isi terkompresi");
    const e = await ns.safeFetch(base + "/nocontent", { signal: AbortSignal.timeout(3000) });
    assert.strictEqual(e.status, 204);
  });
  await t("safeFetch menolak pengalihan berantai tanpa akhir", async () => {
    process.env.ALLOW_PRIVATE_URLS = "1";
    await rejects(ns.safeFetch(base + "/loop", { signal: AbortSignal.timeout(5000) }), /Terlalu banyak pengalihan/);
  });
  await t("safeFetch memeriksa ulang alamat pada hop pengalihan", async () => {
    process.env.ALLOW_PRIVATE_URLS = "1";
    await rejects(ns.safeFetch(base + "/to-private", { signal: AbortSignal.timeout(3000) }), /Alamat tidak diizinkan/);
  });
  srv.close();
  delete process.env.ALLOW_PRIVATE_URLS;

  const mkRes = () => { const r = { code: 200, headers: {}, set(a, b) { if (typeof a === "object") Object.assign(r.headers, a); else r.headers[a] = b; return r; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
  await t("rateLimit: lewat batas jadi 429 dengan Retry-After, IP lain tidak terpengaruh", () => {
    const rl = ns.rateLimit({ max: 3, windowMs: 60000 });
    let passed = 0; const next = () => passed++;
    for (let i = 0; i < 5; i++) { const res = mkRes(); rl({ ip: "1.2.3.4" }, res, next); if (i >= 3) { assert.strictEqual(res.code, 429); assert.ok(res.headers["Retry-After"]); } }
    assert.strictEqual(passed, 3);
    const res2 = mkRes(); rl({ ip: "5.6.7.8" }, res2, next); assert.strictEqual(passed, 4);
  });
  await t("rateLimit: max 0 mematikan pembatas", () => {
    const rl = ns.rateLimit({ max: 0 }); let n = 0;
    for (let i = 0; i < 50; i++) rl({ ip: "9.9.9.9" }, mkRes(), () => n++);
    assert.strictEqual(n, 50);
  });
  await t("requireToken: tanpa token env terbuka; dengan token wajib cocok", () => {
    let ok = 0; const next = () => ok++;
    ns.requireToken("")({ get: () => "" }, mkRes(), next); assert.strictEqual(ok, 1);
    const mw = ns.requireToken("rahasia");
    const r1 = mkRes(); mw({ get: () => "" }, r1, next); assert.strictEqual(r1.code, 401);
    const r2 = mkRes(); mw({ get: (h) => (h === "x-admin-token" ? "salah!!" : "") }, r2, next); assert.strictEqual(r2.code, 401);
    mw({ get: (h) => (h === "x-admin-token" ? "rahasia" : "") }, mkRes(), next); assert.strictEqual(ok, 2);
    mw({ get: (h) => (h === "authorization" ? "Bearer rahasia" : "") }, mkRes(), next); assert.strictEqual(ok, 3);
  });

  console.log("\n" + pass + " lolos, " + fail + " gagal");
  process.exit(fail ? 1 : 0);
})();

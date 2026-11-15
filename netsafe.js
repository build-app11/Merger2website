"use strict";
/* Pengaman jaringan untuk server.js (hanya modul bawaan Node, jadi bisa dites tanpa npm install):
   - isPrivate(ip)     : true untuk alamat lokal/privat/khusus (IPv4, IPv6, dan IPv4-mapped IPv6)
   - safeFetch(url)    : fetch yang memeriksa SETIAP alamat tujuan, termasuk setiap pengalihan, lalu
                         menyambung ke alamat yang sudah diperiksa itu (menutup celah DNS rebinding)
   - rateLimit(opts)   : pembatas laju per IP di memori (middleware Express)
   - requireToken(tok) : middleware token opsional untuk endpoint yang mengubah data
   ALLOW_PRIVATE_URLS=1 mematikan blokir alamat privat. Hanya untuk pengembangan dan tes lokal. */
const dns = require("dns").promises;
const net = require("net");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const zlib = require("zlib");
const { Readable } = require("stream");

const allowPrivate = () => process.env.ALLOW_PRIVATE_URLS === "1";

const bl = new net.BlockList();
[
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
].forEach(([a, p]) => bl.addSubnet(a, p, "ipv4"));
[
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32],
  ["2001::", 32], ["2002::", 16], ["64:ff9b::", 96], ["100::", 64],
].forEach(([a, p]) => bl.addSubnet(a, p, "ipv6"));

function isPrivate(ip) {
  if (allowPrivate()) return false;
  ip = String(ip || "").trim().replace(/^\[|\]$/g, "").split("%")[0];
  const fam = net.isIP(ip);
  if (!fam) return true;                                   // bukan alamat IP yang sah: anggap tidak aman
  if (fam === 6) {
    let m = /^(?:0{0,4}:){2,5}ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip) || /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (m) return isPrivate(m[1]);
    m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
    if (m) { const a = parseInt(m[1], 16), b = parseInt(m[2], 16); return isPrivate([a >> 8, a & 255, b >> 8, b & 255].join(".")); }
    return bl.check(ip, "ipv6");
  }
  return bl.check(ip, "ipv4");
}

// Satu permintaan GET yang menyambung hanya ke alamat hasil pemeriksaan. Mengembalikan Response standar.
function pinnedGet(u, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const mod = u.protocol === "https:" ? https : http;
    const headers = Object.assign({}, opts.headers, { "Accept-Encoding": "identity" });
    const req = mod.request(u, {
      method: "GET", headers, signal: opts.signal,
      lookup(host, o, cb) {
        if (typeof o === "function") { cb = o; o = {}; }
        dns.lookup(host, { all: true }).then((list) => {
          if (!list.length || list.some((a) => isPrivate(a.address))) return cb(Object.assign(new Error("Alamat tidak diizinkan"), { code: "EBLOCKED" }));
          if (o && o.all) cb(null, list); else cb(null, list[0].address, list[0].family);
        }, cb);
      },
    }, (res) => {
      const h = new Headers();
      for (const [k, v] of Object.entries(res.headers)) {
        try { if (Array.isArray(v)) v.forEach((x) => h.append(k, x)); else if (v != null) h.set(k, String(v)); } catch (e) {}
      }
      let src = res;
      const enc = String(res.headers["content-encoding"] || "").toLowerCase();
      if (enc && enc !== "identity") {                       // sebagian server tetap mengompres walau diminta identity
        const z = enc === "gzip" || enc === "x-gzip" ? zlib.createGunzip() : enc === "deflate" ? zlib.createInflate() : enc === "br" ? zlib.createBrotliDecompress() : null;
        if (z) { src = res.pipe(z); res.on("error", (e) => z.destroy(e)); h.delete("content-encoding"); h.delete("content-length"); }
      }
      const body = [204, 205, 304].includes(res.statusCode) ? null : Readable.toWeb(src);
      if (!body) res.resume();
      resolve(new Response(body, { status: res.statusCode, statusText: res.statusMessage || "", headers: h }));
    });
    req.on("error", reject);
    req.end();
  });
}

// fetch yang memeriksa alamat tujuan di setiap pengalihan (podcast dan berita hampir selalu lewat redirect pelacak)
async function safeFetch(url, opts, hops = 5) {
  let u;
  try { u = new URL(String(url || "").trim()); } catch (e) { throw new Error("URL tidak valid"); }
  for (let i = 0; i <= hops; i++) {
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("URL harus http atau https");
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && isPrivate(host)) throw new Error("Alamat tidak diizinkan");
    const r = await pinnedGet(u, opts);
    const loc = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && loc) { try { await r.body.cancel(); } catch (e) {} u = new URL(loc, u); continue; }
    r.finalUrl = u.href;
    return r;
  }
  throw new Error("Terlalu banyak pengalihan");
}

// Pembatas laju per IP (jendela tetap). max <= 0 berarti dimatikan.
function rateLimit(o) {
  o = o || {};
  const windowMs = o.windowMs || 60000, max = o.max == null ? 60 : o.max, hits = new Map();
  const sweep = setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, windowMs);
  if (sweep.unref) sweep.unref();
  return function (req, res, next) {
    if (max <= 0) return next();
    const key = String(req.ip || (req.socket && req.socket.remoteAddress) || "?"), now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset <= now) {
      if (hits.size > 20000) hits.delete(hits.keys().next().value);   // jaga memori
      e = { n: 0, reset: now + windowMs }; hits.set(key, e);
    }
    e.n++;
    res.set({ "RateLimit-Limit": String(max), "RateLimit-Remaining": String(Math.max(0, max - e.n)) });
    if (e.n > max) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((e.reset - now) / 1000))));
      return res.status(429).json({ error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." });
    }
    next();
  };
}

// Bila token diisi (env ADMIN_TOKEN), permintaan harus membawa header X-Admin-Token atau Authorization: Bearer <token>.
function requireToken(token) {
  return function (req, res, next) {
    if (!token) return next();
    const given = String(req.get("x-admin-token") || (req.get("authorization") || "").replace(/^Bearer\s+/i, ""));
    const a = Buffer.from(given), b = Buffer.from(String(token));
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
    res.status(401).json({ error: "Perlu token admin untuk aksi ini." });
  };
}

module.exports = { isPrivate, safeFetch, pinnedGet, rateLimit, requireToken };

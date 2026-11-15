#!/usr/bin/env node
"use strict";
/* Pemeriksa data situs (tanpa dependensi):  node scripts/check-data.js     atau   npm run check:data
   GALAT (exit 1): JSON rusak, pelajaran di index.json tanpa file, file pelajaran yatim, slug dobel/tidak valid,
                   audio/gambar/feed memakai http:// (diblokir browser di halaman https), data/lang tidak sinkron.
   PERINGATAN    : kategori/tag/bahasa kosong, nomor bab loncat, terjemahan UI yang belum lengkap. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const root = path.join(__dirname, "..");
const D = path.join(root, "data");
const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { err(path.relative(root, f) + ": JSON tidak valid (" + e.message + ")"); return null; } };

const idx = readJson(path.join(D, "index.json"));
const lessons = (idx && idx.lessons) || [];
if (idx && !Array.isArray(idx.lessons)) err("index.json: field lessons harus berupa array");

const SPECIAL = new Set(["index", "card", "language"]);
const files = new Set(fs.readdirSync(D).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter((s) => !SPECIAL.has(s)));
const seen = new Set();
const SLUG = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const roman = (s) => { let n = 0; for (let i = 0; i < s.length; i++) { const v = ROMAN[s[i]], w = ROMAN[s[i + 1]]; n += w > v ? -v : v; } return n; };

for (const l of lessons) {
  const at = "index.json[" + l.slug + "]";
  if (!l.slug || !SLUG.test(l.slug)) { err(at + ": slug tidak valid"); continue; }
  if (seen.has(l.slug)) err(at + ": slug dobel");
  seen.add(l.slug);
  if (!files.has(l.slug)) err(at + ": file data/" + l.slug + ".json tidak ada");
  if (!l.title) err(at + ": title kosong");
  for (const k of ["audio", "image", "feed"]) if (typeof l[k] === "string" && /^http:\/\//i.test(l[k])) err(at + ": " + k + " memakai http:// (ganti https://): " + l[k].slice(0, 70));
  if (!l.category) warn(at + ": category kosong");
  if (!Array.isArray(l.tags) || !l.tags.length) warn(at + ": tags kosong");
  if (!l.lang) warn(at + ": lang kosong (dianggap en)"); else if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)?$/.test(l.lang)) err(at + ": lang tidak valid: " + l.lang);
  if (l.book && !Number(l.chapter)) err(at + ": punya book tetapi chapter bukan angka");
}
for (const s of files) if (!seen.has(s)) err("data/" + s + ".json tidak terdaftar di index.json (yatim). Jalankan index-builder atau hapus file.");

// isi file pelajaran: audio/rss http://, dan judul bab yang loncat
for (const s of files) {
  const f = path.join(D, s + ".json");
  const t = fs.readFileSync(f, "utf8");
  if (/"(?:audio|image|feed|rss)"\s*:\s*"http:\/\//.test(t)) err("data/" + s + ".json: berisi audio/gambar/feed http://");
  try { JSON.parse(t); } catch (e) { err("data/" + s + ".json: JSON tidak valid"); }
}
const books = {};
for (const l of lessons) if (l.book) (books[l.book] = books[l.book] || []).push(l);
for (const [b, ls] of Object.entries(books)) {
  const chaps = [];
  for (const l of ls) { const m = /^CHAPTER\s+([IVXLCDM]+)\b/i.exec(l.title || ""); if (m) chaps.push(roman(m[1].toUpperCase())); }
  chaps.sort((a, c) => a - c);
  for (let i = 1; i < chaps.length; i++) for (let n = chaps[i - 1] + 1; n < chaps[i]; n++) warn('buku "' + b + '": bab ' + n + " tidak ada di antara bab " + chaps[i - 1] + " dan " + chaps[i]);
  const dup = ls.map((l) => l.title).filter((t, i, a) => a.indexOf(t) !== i);
  if (dup.length) err('buku "' + b + '": judul bab dobel: ' + [...new Set(dup)].join("; "));
  const nums = ls.map((l) => Number(l.chapter)).sort((a, c) => a - c);
  nums.forEach((n, i) => { if (i && n === nums[i - 1]) err('buku "' + b + '": nomor bab dobel: ' + n); });
}

// card.json dan language.json
const card = readJson(path.join(D, "card.json"));
if (card && (!card.pages || typeof card.pages !== "object")) err("card.json: field pages hilang");
if (card) for (const p of Object.keys(card.pages || {})) if (!fs.existsSync(path.join(root, p))) warn("card.json: halaman " + p + " tidak ada di folder proyek");
const lang = readJson(path.join(D, "language.json"));
if (lang && lang.strings && lang.strings.id) {
  const KEEP = /^[\W\d_]*$|^[\w.\/-]*\.(?:json|zip|csv|txt|apkg|mp3)$|^data\/$|^(Learning Fun|PhraseClip|Sync Reader|IPA|JSON|Anki|Again|Hard|Good|Easy|OK|Redo|Wiktionary|Cloze|Card Browser|Audiobook Generator|Video Generator|Phonetic \(IPA\)|FreeDictionaryAPI\.com)$/;
  for (const [code] of (lang.languages || [])) {
    if (code === "id") continue;
    const tg = lang.strings[code] || {};
    const missing = Object.keys(lang.strings.id).filter((k) => !tg[k] && !KEEP.test(String(lang.strings.id[k]).trim()));
    if (missing.length) warn("language.json[" + code + "]: " + missing.length + " teks belum diterjemahkan (mis. " + missing.slice(0, 3).join(", ") + ")");
  }
}
const sp = spawnSync(process.execPath, [path.join(__dirname, "split-lang.js"), "--check"], { encoding: "utf8" });
if (sp.status !== 0) err("data/lang tidak sinkron dengan language.json. Jalankan: npm run build:lang");

warns.forEach((m) => console.log("peringatan: " + m));
errors.forEach((m) => console.log("GALAT:      " + m));
console.log("\n" + lessons.length + " pelajaran, " + files.size + " file pelajaran: " + errors.length + " galat, " + warns.length + " peringatan");
process.exit(errors.length ? 1 : 0);

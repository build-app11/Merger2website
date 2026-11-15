#!/usr/bin/env node
"use strict";
/* Memecah data/language.json (sumber utama, dipakai Language Builder) menjadi file kecil per bahasa:
     data/lang/<kode>.json   { languages, strings: { id: {...hanya key yang punya terjemahan}, <kode>: {...} } }
     data/lang/index.json    { languages, counts }   (hanya daftar bahasa, untuk menu bahasa)
   i18n.js memuat file bahasa yang dipilih saja, secara async, dan jatuh balik ke language.json bila file ini belum ada.
   Pakai:  node scripts/split-lang.js        (atau: npm run build:lang)      Cek tanpa menulis:  --check */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const src = path.join(root, "data", "language.json"), out = path.join(root, "data", "lang");
const check = process.argv.includes("--check");

const j = JSON.parse(fs.readFileSync(src, "utf8"));
if (!j.strings || !j.strings.id) throw new Error("language.json tidak punya strings.id");
const languages = (j.languages || []).filter((l) => Array.isArray(l) && l[0]);
const files = {};
const counts = {};
for (const [code] of languages) {
  counts[code] = Object.keys(j.strings[code] || {}).length;
  if (code === "id") continue;
  const tg = j.strings[code] || {}, id = {}, to = {};
  for (const k of Object.keys(tg)) {
    if (typeof tg[k] === "string" && tg[k] && typeof j.strings.id[k] === "string") { id[k] = j.strings.id[k]; to[k] = tg[k]; }
  }
  files[code] = { languages, strings: { id, [code]: to } };
}
files.index = { languages, counts };

let changed = 0;
if (!check) fs.mkdirSync(out, { recursive: true });
const wanted = new Set(Object.keys(files).map((c) => c + ".json"));
for (const [name, obj] of Object.entries(files)) {
  const file = path.join(out, name + ".json"), text = JSON.stringify(obj) + "\n";
  const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (cur !== text) { changed++; if (!check) fs.writeFileSync(file, text); console.log((check ? "berbeda: " : "tulis:   ") + path.relative(root, file) + " (" + Math.round(text.length / 1024) + " KB)"); }
}
if (fs.existsSync(out)) for (const f of fs.readdirSync(out)) if (/\.json$/.test(f) && !wanted.has(f)) { changed++; console.log((check ? "usang:   " : "hapus:   ") + "data/lang/" + f); if (!check) fs.unlinkSync(path.join(out, f)); }
console.log(changed ? (check ? changed + " file tidak sinkron dengan language.json. Jalankan: npm run build:lang" : changed + " file diperbarui.") : "data/lang sudah sinkron dengan language.json.");
process.exit(check && changed ? 1 : 0);

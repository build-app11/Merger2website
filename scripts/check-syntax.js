#!/usr/bin/env node
"use strict";
/* Memeriksa sintaks semua *.js di proyek (node --check) dan semua <script> inline di *.html. Tanpa dependensi. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const root = path.join(__dirname, "..");
let bad = 0, n = 0;
const skip = new Set(["node_modules", "models", ".git", "data"]);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => skip.has(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(root)) {
  const rel = path.relative(root, f);
  if (f.endsWith(".js")) {
    n++; const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    if (r.status) { bad++; console.log("GALAT " + rel + "\n" + r.stderr.split("\n").slice(0, 4).join("\n")); }
  } else if (f.endsWith(".html")) {
    const html = fs.readFileSync(f, "utf8"); let i = 0;
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(m[1]) || /type\s*=\s*["']?(?:application\/(?:ld\+)?json|text\/template|importmap)/i.test(m[1]) || !m[2].trim()) continue;
      const mod = /type\s*=\s*["']?module/i.test(m[1]); i++; n++;
      try { new vm.Script(mod ? "(async()=>{" + m[2].replace(/^\s*import\s[^\n]*\n/gm, "") + "\n})" : m[2], { filename: rel + "#script" + i }); }
      catch (e) { bad++; console.log("GALAT " + rel + " <script> #" + i + ": " + e.message); }
    }
    if (!/<!doctype html>/i.test(html.slice(0, 200))) { bad++; console.log("GALAT " + rel + ": tidak diawali <!doctype html>"); }
  }
}
console.log(n + " skrip diperiksa, " + bad + " galat");
process.exit(bad ? 1 : 0);

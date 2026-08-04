// AUDITORÍA DE TEXTOS
//
// Busca tres cosas que no se ven a simple vista y que rompen la app en
// silencio (sale la clave cruda en pantalla en vez del texto):
//   1. Claves repetidas dentro de un mismo idioma — la segunda pisa a la
//      primera sin avisar.
//   2. Claves que existen en un idioma y faltan en otro.
//   3. Claves usadas en el código que no existen en ningún idioma.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const i18nPath = path.join(ROOT, "constants/i18n.ts");
const src = fs.readFileSync(i18nPath, "utf8");
const lines = src.split(/\r?\n/);

// --- Trocear por idioma ---
const blocks = {};
let current = null;
lines.forEach((line, i) => {
  const open = line.match(/^  (es|en|pt): \{/);
  if (open) {
    current = open[1];
    blocks[current] = [];
    return;
  }
  if (/^  \},?$/.test(line)) {
    current = null;
    return;
  }
  if (current) {
    const key = line.match(/^\s*"([^"]+)":/);
    if (key) blocks[current].push({ key: key[1], line: i + 1 });
  }
});

let problemas = 0;

// --- 1. Repetidas dentro de un idioma ---
console.log("== Claves repetidas ==");
for (const [lang, entries] of Object.entries(blocks)) {
  const vistas = new Map();
  for (const { key, line } of entries) {
    if (vistas.has(key)) {
      console.log(`  REPETIDA  [${lang}] "${key}"  lineas ${vistas.get(key)} y ${line}`);
      problemas++;
    } else {
      vistas.set(key, line);
    }
  }
}
if (problemas === 0) console.log("  ninguna");

// --- 2. Faltantes entre idiomas ---
console.log("\n== Traducciones que faltan ==");
const sets = Object.fromEntries(
  Object.entries(blocks).map(([lang, e]) => [lang, new Set(e.map((x) => x.key))])
);
const todas = new Set(Object.values(sets).flatMap((s) => [...s]));
let faltantes = 0;
for (const key of [...todas].sort()) {
  const falta = Object.keys(sets).filter((l) => !sets[l].has(key));
  if (falta.length > 0) {
    console.log(`  FALTA  "${key}"  en: ${falta.join(", ")}`);
    faltantes++;
    problemas++;
  }
}
if (faltantes === 0) console.log("  ninguna");

// --- 3. Claves usadas en el código que no existen ---
console.log("\n== Claves usadas pero inexistentes ==");
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", ".expo", "android", "ios", "dist"].includes(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !full.includes("i18n.ts")) out.push(full);
  }
  return out;
}

const usadas = new Map();
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, "utf8");
  // t("clave") y t(`clave`) literales. Las dinámicas (t(`a.${x}`)) no se
  // pueden comprobar así y se revisan aparte.
  for (const m of text.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) {
    if (!usadas.has(m[1])) usadas.set(m[1], path.relative(ROOT, file));
  }
}

let inexistentes = 0;
for (const [key, file] of [...usadas].sort()) {
  if (!todas.has(key)) {
    console.log(`  NO EXISTE  "${key}"  usada en ${file}`);
    inexistentes++;
    problemas++;
  }
}
if (inexistentes === 0) console.log("  ninguna");

console.log(
  `\n${Object.entries(blocks).map(([l, e]) => `${l}: ${e.length}`).join(" · ")} claves · ${usadas.size} usadas en codigo`
);
console.log(problemas === 0 ? "\nSin problemas" : `\n${problemas} problemas`);
if (problemas) process.exitCode = 1;

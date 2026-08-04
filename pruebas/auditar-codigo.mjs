// AUDITORÍA 2
//   a) Claves de texto que se arman al vuelo (t(`algo.${x}`)) y que el
//      primer script no puede ver.
//   b) Cosas exportadas que ya nadie usa: código muerto que estorba al
//      leer y que confunde a quien venga después.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const i18n = fs.readFileSync(path.join(ROOT, "constants/i18n.ts"), "utf8");
const claves = new Set([...i18n.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));

let problemas = 0;
function check(nombre, ok, detalle = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${nombre.padEnd(46)} ${detalle}`);
  if (!ok) problemas++;
}

// --- a) Claves armadas al vuelo ---
console.log("== Claves que se arman al vuelo ==");

// Categorías: catInfo(id).label -> "category.<id>"
const cats = fs.readFileSync(path.join(ROOT, "constants/categories.ts"), "utf8");
const catLabels = [...cats.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
const catFaltan = catLabels.filter((k) => !claves.has(k));
check("etiquetas de categoria", catFaltan.length === 0, catFaltan.join(", ") || `${catLabels.length} revisadas`);

// Resultados del diagnostico de Yape: t(`autoCapture.result.${x}`)
const auto = fs.readFileSync(path.join(ROOT, "utils/autoCapture.ts"), "utf8");
const parser = fs.readFileSync(path.join(ROOT, "utils/notificationParser.ts"), "utf8");
const resultados = new Set(["added", "duplicate"]);
for (const m of parser.matchAll(/\|\s*"(notMoney|noAmount|noDirection)"/g)) resultados.add(m[1]);
const resFaltan = [...resultados].filter((r) => !claves.has(`autoCapture.result.${r}`));
check("resultados del diagnostico", resFaltan.length === 0, resFaltan.join(", ") || `${resultados.size} revisados`);

// Metodos de pago: PAYMENT_METHODS[].labelKey
const metodos = [...i18n.matchAll(/labelKey:\s*"([^"]+)"/g)].map((m) => m[1]);
const metFaltan = metodos.filter((k) => !claves.has(k));
check("metodos de pago", metFaltan.length === 0, metFaltan.join(", ") || `${metodos.length} revisados`);

// Dias de la semana: t(`weekday.${n}`) y t(`weekday.short.${n}`), que usa la
// exportacion programada. Se arman con un numero, asi que ningun buscador de
// texto los ve: si faltara el sabado, la pantalla diria "cada weekday.7 a las
// 9:00" y no se enteraria nadie hasta que alguien lo eligiera.
const dias = [];
for (let n = 1; n <= 7; n++) {
  if (!claves.has(`weekday.${n}`)) dias.push(`weekday.${n}`);
  if (!claves.has(`weekday.short.${n}`)) dias.push(`weekday.short.${n}`);
}
check("dias de la semana", dias.length === 0, dias.join(", ") || "14 revisadas");

// --- b) Codigo muerto ---
console.log("\n== Exportado pero sin usar ==");
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", ".expo", "android", "ios", "dist"].includes(name)) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const archivos = walk(ROOT);
const contenidos = new Map(archivos.map((f) => [f, fs.readFileSync(f, "utf8")]));

let muertos = 0;
for (const [file, text] of contenidos) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  // Solo utilidades y módulos; las pantallas exportan su componente por
  // defecto y el router los usa por convención, no por nombre.
  if (!/^(utils|modules|constants)\//.test(rel)) continue;

  for (const m of text.matchAll(/^export (?:async )?function (\w+)|^export const (\w+)|^export type (\w+)/gm)) {
    const nombre = m[1] || m[2] || m[3];
    let usos = 0;
    for (const [otro, texto] of contenidos) {
      if (otro === file) continue;
      if (new RegExp(`\\b${nombre}\\b`).test(texto)) usos++;
    }
    if (usos === 0) {
      console.log(`  SIN USAR  ${nombre}  en ${rel}`);
      muertos++;
    }
  }
}
if (muertos === 0) console.log("  ninguno");

console.log(problemas === 0 && muertos === 0 ? "\nSin problemas" : `\n${problemas} fallas · ${muertos} sin usar`);
if (problemas) process.exitCode = 1;

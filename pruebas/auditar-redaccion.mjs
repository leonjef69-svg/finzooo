// AUDITORÍA 3 — redacción de los textos que ve la persona.
// Busca los descuidos típicos: signos de apertura que faltan, espacios
// dobles, espacios colgando al final, y variables mal escritas.

import fs from "node:fs";

const ROOT = process.cwd();
const src = fs.readFileSync(`${ROOT}/constants/i18n.ts`, "utf8");
const lines = src.split(/\r?\n/);

let lang = null;
const problemas = [];
const porIdioma = {};

lines.forEach((line, i) => {
  const open = line.match(/^  (es|en|pt): \{/);
  if (open) {
    lang = open[1];
    porIdioma[lang] = [];
    return;
  }
  if (/^  \},?$/.test(line)) {
    lang = null;
    return;
  }
  if (!lang) return;

  const m = line.match(/^\s*"([^"]+)":\s*$/) || line.match(/^\s*"([^"]+)":\s*"(.*)",?\s*$/);
  if (!m) return;
  const key = m[1];
  const value = m[2];
  if (value == null) return; // texto en la línea siguiente, se revisa aparte
  porIdioma[lang].push({ key, value, line: i + 1 });

  const add = (tipo) => problemas.push({ tipo, lang, key, value, line: i + 1 });

  // Español: signos de apertura
  if (lang === "es") {
    if (value.includes("?") && !value.includes("¿")) add("falta ¿");
    if (value.includes("!") && !value.includes("¡")) add("falta ¡");
  }
  // Espacios dobles y colgantes (en cualquier idioma)
  if (/ {2,}/.test(value)) add("espacio doble");
  if (/^\s|\s$/.test(value)) add("espacio al borde");
  // Variables: deben ser {algo} sin espacios
  for (const v of value.matchAll(/\{([^}]*)\}/g)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(v[1])) add(`variable rara {${v[1]}}`);
  }
});

// Variables que existen en un idioma pero no en otro: si falta, el número
// simplemente no aparece y la frase queda coja.
console.log("== Variables que no coinciden entre idiomas ==");
const vars = (s) => [...s.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((m) => m[1]).sort().join(",");
const base = Object.fromEntries(porIdioma.es.map((e) => [e.key, e]));
let desiguales = 0;
for (const lg of ["en", "pt"]) {
  for (const e of porIdioma[lg]) {
    const ref = base[e.key];
    if (!ref) continue;
    if (vars(ref.value) !== vars(e.value)) {
      console.log(`  DISTINTO  "${e.key}"  es:{${vars(ref.value)}}  ${lg}:{${vars(e.value)}}`);
      desiguales++;
    }
  }
}
if (desiguales === 0) console.log("  ninguna");

console.log("\n== Redaccion ==");
if (problemas.length === 0) {
  console.log("  sin problemas");
} else {
  for (const p of problemas) {
    console.log(`  ${p.tipo.padEnd(18)} [${p.lang}] linea ${p.line}  "${p.key}"`);
    console.log(`      ${p.value}`);
  }
}

const total = problemas.length + desiguales;
console.log(`\n${porIdioma.es.length + porIdioma.en.length + porIdioma.pt.length} textos revisados`);
console.log(total === 0 ? "Sin problemas" : `${total} problemas`);
if (total) process.exitCode = 1;

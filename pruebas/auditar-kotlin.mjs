// COMPROBACION BASICA DEL CODIGO DE ANDROID, ANTES DE COMPILAR.
//
// Compilar un APK tarda quince minutos y solo entonces se sabe si el Kotlin
// esta bien. Dos veces seguidas se fue ese cuarto de hora por lo mismo: un
// script mio metio una cadena partida en dos lineas y unas barras que se
// perdieron por el camino.
//
// Esto no reemplaza al compilador. Solo caza los destrozos evidentes —comillas
// sin cerrar, llaves descuadradas— en un segundo, que es justo el tipo de
// fallo que introduce un reemplazo automatico.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const problemas = [];

function archivosKotlin(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivosKotlin(p, out);
    else if (e.name.endsWith(".kt")) out.push(p);
  }
  return out;
}

const archivos = archivosKotlin(path.join(RAIZ, "modules"));
console.log(`\n  ${archivos.length} archivos de Android`);

for (const f of archivos) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, "/");
  const lineas = fs.readFileSync(f, "utf8").split("\n");

  let dentroDeBloque = false;
  lineas.forEach((l, i) => {
    // Los comentarios de bloque se saltan enteros: llevan comillas sueltas a
    // propósito, en los ejemplos.
    if (l.includes("/**") || l.trimStart().startsWith("*")) dentroDeBloque = !l.includes("*/");
    if (dentroDeBloque || l.trimStart().startsWith("*")) return;

    // Se recorre la linea caracter a caracter, y no con expresiones.
    //
    // Dos intentos fallaron antes por lo mismo: quitar el comentario con
    // /\/\/.*$/ parte "file://..." por la mitad —ese "//" esta DENTRO de un
    // texto— y deja las comillas descuadradas. Y contar con /(^|[^\\])"/ se
    // come el caracter de delante, asi que en `return ""` veia una comilla en
    // vez de dos. Los dos daban por rotas lineas que estaban perfectas.
    let dentroDeTexto = false;
    for (let c = 0; c < l.length; c++) {
      if (l[c] === "\\") {
        c++; // lo que venga detras de una barra no cuenta
        continue;
      }
      if (l[c] === '"') {
        dentroDeTexto = !dentroDeTexto;
        continue;
      }
      // Un "//" FUERA de un texto empieza un comentario: se acaba la linea.
      if (!dentroDeTexto && l[c] === "/" && l[c + 1] === "/") break;
    }
    if (dentroDeTexto) {
      problemas.push(`${rel}:${i + 1} comilla sin cerrar: ${l.trim().slice(0, 60)}`);
    }
  });

  const txt = lineas.join("\n");
  for (const [abre, cierra, nombre] of [
    ["{", "}", "llaves"],
    ["(", ")", "parentesis"],
  ]) {
    const a = txt.split(abre).length - 1;
    const c = txt.split(cierra).length - 1;
    if (a !== c) problemas.push(`${rel}: ${nombre} descuadradas (${a} abren, ${c} cierran)`);
  }
}

console.log("\n=== RESULTADO ===");
if (problemas.length === 0) console.log("Sin problemas\n");
else {
  for (const p of problemas) console.log("  FALLA " + p);
  console.log(`\n${problemas.length} problemas\n`);
}
process.exit(problemas.length ? 1 : 0);

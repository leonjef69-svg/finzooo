/**
 * DOS COSAS QUE SE ARREGLAN EN UN SITIO Y SE ROMPEN EN LOS OTROS SESENTA (21/08/2026)
 *
 * Las dos salieron el mismo día, y son el mismo tipo de fallo: **una regla que se aplicó
 * donde se vio el problema y no en todos los sitios donde vale.**
 *
 *  1. *"Ahorita en registro automático le di rápido click y salió 2 pantallas."* La protección
 *     contra el doble toque —`irUnaVez`— existía desde el 19/08, pero solo se usaba en las 5
 *     llamadas del calendario, que fue donde él lo reportó la primera vez. Las otras 61 seguían
 *     con `router.push` a pelo.
 *
 *  2. *"Te faltó esa y de repente otras más."* La barra de pestañas se quedó azul con toda la
 *     app en carbón, porque su color estaba ESCRITO A MANO en vez de salir de la paleta.
 *
 * Esta prueba recorre la app entera. No hay forma de "acordarse" de esto en el archivo número
 * treinta; o lo vigila algo, o vuelve.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let fallos = 0;
function ok(condicion, texto) {
  if (condicion) console.log(`  ok    ${texto}`);
  else {
    console.log(`  FALLA ${texto}`);
    fallos++;
  }
}

const archivos = [];
const recorrer = (d) => {
  for (const e of fs.readdirSync(path.join(RAIZ, d), { withFileTypes: true })) {
    const rel = path.join(d, e.name);
    if (e.isDirectory()) recorrer(rel);
    else if (/\.tsx?$/.test(e.name)) archivos.push(rel);
  }
};
["screens", "components", "app"].forEach(recorrer);

console.log("\n--- NINGUNA PANTALLA SE ABRE CON router.push A PELO ---");
{
  /* `router.push` apila una pantalla por toque, y mientras la primera entra —la animación dura
     unos 300 ms— el botón sigue debajo del dedo. Los toques de más son impaciencia, no una
     orden de abrir tres veces lo mismo. `irUnaVez` los ignora durante medio segundo. */
  const malos = [];
  for (const rel of archivos) {
    const txt = fs.readFileSync(path.join(RAIZ, rel), "utf8");
    if (/\brouter\.push\(/.test(txt)) malos.push(rel);
  }
  ok(
    malos.length === 0,
    `nadie navega con router.push${malos.length ? " — lo hacen: " + malos.join(", ") : ""}`
  );

  // Y que la protección siga siendo de verdad: sin la pausa, `irUnaVez` seria un `push` con
  // otro nombre.
  const nav = fs.readFileSync(path.join(RAIZ, "utils/nav.ts"), "utf8");
  ok(/export function irUnaVez/.test(nav), "irUnaVez existe");
  ok(/ahora - ultimoViaje < 500/.test(nav), "y descarta los toques de los siguientes 500 ms");
  ok(
    /^let ultimoViaje = 0;/m.test(nav),
    "con la hora en una variable de modulo, no en un estado: un estado redibujaria la pantalla en cada toque"
  );
}

console.log("\n--- EL COLOR DEL MODO OSCURO SALE DE UN SOLO SITIO ---");
{
  /* Lo que no puede usar clases —la barra de pestañas, algunos StyleSheet— tiene que sacar el
     color de `NOCHE` en constants/style. Escribirlo a mano es lo que dejo la barra de abajo
     azul mientras el resto de la app pasaba a carbon. */
  const estilo = fs.readFileSync(path.join(RAIZ, "constants/style.ts"), "utf8");
  ok(/export const NOCHE = \{/.test(estilo), "hay un solo sitio con los colores del oscuro");

  const tw = fs.readFileSync(path.join(RAIZ, "tailwind.config.js"), "utf8");
  const deTw = /noche:\s*\{[\s\S]*?DEFAULT:\s*"(#[0-9a-fA-F]{6})"[\s\S]*?2:\s*"(#[0-9a-fA-F]{6})"[\s\S]*?3:\s*"(#[0-9a-fA-F]{6})"[\s\S]*?borde:\s*"(#[0-9a-fA-F]{6})"/.exec(tw);
  ok(deTw != null, "se leyo la paleta de tailwind");
  const deEstilo = /NOCHE = \{[\s\S]*?fondo:\s*"(#[0-9a-fA-F]{6})"[\s\S]*?tarjeta:\s*"(#[0-9a-fA-F]{6})"[\s\S]*?encima:\s*"(#[0-9a-fA-F]{6})"[\s\S]*?borde:\s*"(#[0-9a-fA-F]{6})"/.exec(estilo);
  ok(deEstilo != null, "y la de constants/style");
  if (deTw && deEstilo) {
    for (const [i, nombre] of ["fondo", "tarjeta", "encima", "borde"].entries()) {
      ok(
        deTw[i + 1].toLowerCase() === deEstilo[i + 1].toLowerCase(),
        `el ${nombre} coincide en los dos (${deTw[i + 1]})`
      );
    }
  }

  // La tarjeta TIENE que ser mas clara que el fondo: es la razon entera del cambio.
  if (deTw) {
    const claro = (h) => parseInt(h.slice(1), 16);
    ok(claro(deTw[2]) > claro(deTw[1]), "la tarjeta es mas clara que el fondo");
    ok(claro(deTw[3]) > claro(deTw[2]), "y lo que va encima, mas claro que la tarjeta");
  }

  /* Y que nadie vuelva a escribir el azul viejo como fondo DEL MODO OSCURO.
     Se mira que el azul este en la rama de oscuro, no en cualquier sitio: #0f172a sigue
     siendo el color correcto del TEXTO en modo claro, y de un punto que tiene que contrastar
     con un fondo claro. Sin esta precision, la prueba señalaba tres usos legitimos del
     calendario y habria acabado desactivada por pesada, que es como mueren las pruebas. */
  const conAzul = [];
  for (const rel of archivos) {
    const txt = fs.readFileSync(path.join(RAIZ, rel), "utf8");
    for (const m of txt.matchAll(
      /backgroundColor:[^,;\n]*(?:oscuro|isDark|=== "dark")\s*\?\s*"#0f172a"/gi
    )) {
      conAzul.push(rel);
    }
  }
  ok(
    conAzul.length === 0,
    `nadie pinta un fondo con el azul viejo${conAzul.length ? " — lo hacen: " + [...new Set(conAzul)].join(", ") : ""}`
  );
}

console.log(
  fallos ? `\n${fallos} con problemas` : "\nTodo bien: un toque abre una pantalla, y un solo oscuro"
);
process.exit(fallos ? 1 : 0);

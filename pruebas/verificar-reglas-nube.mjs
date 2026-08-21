/**
 * LAS REGLAS DE LA NUBE CONOCEN TODOS LOS CAMPOS QUE MANDA LA APP (21/08/2026)
 *
 * **Esta prueba nace de un fallo que costó semanas de respaldo.** Las reglas publicadas en
 * Firebase tenían una lista `hasOnly` con ONCE campos y la app ya mandaba DIECISÉIS.
 * `hasOnly` significa "el documento solo puede tener estas claves", así que al llegar
 * `pagosProgramados` —o las categorías propias, o los favoritos— Firestore rechazaba **la
 * escritura entera**, no el campo sobrante.
 *
 * O sea: cada función nueva que guardaba algo rompía la copia de seguridad de todo lo demás.
 * Y no se notaba, porque la subida se tragaba el error y la pantalla seguía diciendo "Tus
 * datos están respaldados". Se descubrió por casualidad, mirando el mensaje en inglés que
 * devolvía Firestore.
 *
 * Aquí se comparan las dos listas. Si alguien agrega un campo a `CloudData` y no lo agrega a
 * las reglas, esto falla antes de que llegue al celular de nadie.
 *
 * **OJO:** que esta prueba pase NO significa que las reglas estén publicadas. Este archivo no
 * hace nada estando en el proyecto; hay que pegarlo en la consola de Firebase. La prueba
 * garantiza que el texto es correcto, no que esté puesto.
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

const reglas = fs.readFileSync(path.join(RAIZ, "firestore.rules"), "utf8");
const cloud = fs.readFileSync(path.join(RAIZ, "utils/cloudSync.ts"), "utf8");

console.log("\n--- LOS CAMPOS DE LA APP Y LOS DE LAS REGLAS SON LOS MISMOS ---");
{
  const tipo = cloud.slice(
    cloud.indexOf("export type CloudData = {"),
    cloud.indexOf("};", cloud.indexOf("export type CloudData = {"))
  );
  const deLaApp = [...tipo.matchAll(/^ {2}([a-zA-Z]+)\??:/gm)].map((m) => m[1]);
  ok(deLaApp.length > 10, `se leyeron los campos de CloudData (${deLaApp.length})`);

  const lista = /hasOnly\(\[([\s\S]*?)\]\)/.exec(reglas)?.[1] ?? "";
  const deLasReglas = [...lista.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
  ok(deLasReglas.length > 10, `se leyó la lista de las reglas (${deLasReglas.length})`);

  const faltan = deLaApp.filter((c) => !deLasReglas.includes(c));
  ok(
    faltan.length === 0,
    `las reglas conocen TODOS los campos que manda la app${
      faltan.length ? " — Firestore rechazaria la copia entera por: " + faltan.join(", ") : ""
    }`
  );

  // Y al revés: un campo en las reglas que la app ya no manda no rompe nada, pero es basura
  // que confunde a quien lea esto dentro de un año.
  const sobran = deLasReglas.filter((c) => !deLaApp.includes(c));
  ok(
    sobran.length === 0,
    `y ninguno de mas${sobran.length ? " — ya no se mandan: " + sobran.join(", ") : ""}`
  );
}

console.log("\n--- EL SEGUNDO DOCUMENTO, EL DEL NEGOCIO, TIENE SU REGLA ---");
{
  /* El Modo Negocio guarda aparte, en "negocios/{uid}", porque sus ventas no caben en el
     documento personal. Sin regla propia cae en el "todo cerrado" del final y su copia no se
     hace NUNCA — que es lo que pasaba hasta hoy. */
  const donde = fs.readFileSync(path.join(RAIZ, "utils/cloudNegocio.ts"), "utf8");
  const coleccion = /doc\(db,\s*"([a-zA-Z]+)"/.exec(donde)?.[1] ?? "";
  ok(coleccion.length > 0, `el negocio guarda en la coleccion "${coleccion}"`);
  ok(
    reglas.includes(`match /${coleccion}/{userId}`),
    `y las reglas tienen un match para "${coleccion}"`
  );
}

console.log("\n--- Y LO DE SIEMPRE SIGUE CERRADO ---");
{
  ok(
    /match \/\{document=\*\*\} \{[\s\S]*?allow read, write: if false;/.test(reglas),
    "todo lo que no este nombrado queda cerrado"
  );
  const permisos = [...reglas.matchAll(/allow [a-z, ]+: if ([^;]+);/g)].map((m) => m[1]);
  const abiertos = permisos.filter(
    (p) => !p.includes("request.auth.uid == userId") && !p.includes("false")
  );
  ok(abiertos.length === 0, "ninguna regla deja escribir en el documento de otra persona");
  const sinCorreo = permisos.filter(
    (p) => p.includes("request.auth.uid == userId") && !p.includes("email_verified")
  );
  ok(sinCorreo.length === 0, "y todas exigen el correo confirmado");
}

console.log(
  fallos ? `\n${fallos} con problemas` : "\nTodo bien: las reglas y la app hablan de lo mismo"
);
process.exit(fallos ? 1 : 0);

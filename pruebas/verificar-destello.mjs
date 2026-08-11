// EL DESTELLO BLANCO AL GUARDAR UN MOVIMIENTO (10/08/2026)
//
// Reportado con la app en modo oscuro: "al darle guardar aparece por un momento una pantalla
// blanca y luego me manda a Inicio".
//
// Al guardar, "Nuevo movimiento" se cierra saltandose el panel de elegir tipo —dos pantallas
// de una vez— y se cae a Inicio. En ese salto, lo que se ve un instante NO es Inicio: Inicio
// todavia no ha pintado. Lo que se ve son los fondos que React Navigation trae de fabrica, y
// esos son blancos.
//
// LAS PANTALLAS MODALES YA TENIAN SU FONDO ARREGLADO desde hace tiempo. Lo que faltaba era
// todo lo de DEBAJO, que son cuatro capas distintas. Y el destello vuelve en cuanto se
// destapa una sola, asi que las cuatro tienen que seguir puestas.
//
// ESTA PRUEBA MIRA EL CODIGO y no las cuentas, porque aqui no hay cuenta ninguna: es que no
// se olvide una capa. No se puede comprobar de otra forma sin un Android delante.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
// Los comentarios se quitan porque las explicaciones de arriba nombran justo lo que se busca,
// y la prueba pasaria sola leyendose a si misma.
const raiz = sinComentarios(fs.readFileSync(path.join(RAIZ, "app/_layout.tsx"), "utf8"));
const pestanas = sinComentarios(fs.readFileSync(path.join(RAIZ, "app/(tabs)/_layout.tsx"), "utf8"));

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- LAS CUATRO CAPAS QUE PODIAN VERSE BLANCAS ---");

// 1. EL TEMA. Pinta el hueco entre pantallas. De fabrica es blanco siempre, incluso con la
//    app en modo oscuro, porque nadie le habia dicho cual era el modo.
ok(/ThemeProvider/.test(raiz), "1. el tema de navegacion esta puesto");
ok(/DarkTheme/.test(raiz), "   y distingue el modo oscuro");
ok(/background:\s*screenBg/.test(raiz), "   con el fondo de la app, no el de fabrica");

// 2. EL FONDO POR DEFECTO DE LAS PANTALLAS que no declaran el suyo. Inicio es una de ellas,
//    y es justo a donde se cae al guardar.
ok(
  /screenOptions=\{\{[^}]*contentStyle:\s*\{\s*backgroundColor:\s*screenBg/.test(raiz),
  "2. las pantallas sin fondo propio heredan el del tema"
);

// 3. LA VENTANA DE ANDROID, por debajo de todo lo demas.
ok(/SystemUI\.setBackgroundColorAsync/.test(raiz), "3. la ventana de Android lleva el color del tema");

// 4. EL FONDO DE LAS PESTAÑAS, por debajo de lo que pinta cada pantalla.
ok(/sceneStyle:\s*\{\s*backgroundColor:/.test(pestanas), "4. las pestañas tienen fondo propio");

console.log("\n--- Y LO QUE YA ESTABA, QUE NO SE PUEDE PERDER ---");
{
  // ESTO YA PASABA ANTES. Se deja escrito porque el arreglo de hoy toca el mismo bloque de
  // opciones, y borrar el contentStyle de las modales de un manotazo devolveria el destello
  // por el otro lado: el de la hoja ABRIENDOSE, que costo lo suyo en su dia.
  const modales = raiz.match(/presentation:\s*"modal"[^}]*\}/g) ?? [];
  ok(modales.length >= 2, `las dos pantallas modales siguen declaradas (${modales.length})`);
  ok(
    modales.every((m) => /backgroundColor:\s*screenBg/.test(m)),
    "y las dos siguen con el fondo del tema"
  );
}

console.log(fallos === 0 ? "\nTodo bien: ninguna capa se ve blanca" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);

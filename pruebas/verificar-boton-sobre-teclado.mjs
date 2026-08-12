// EL BOTON DE GUARDAR NO PUEDE QUEDAR DEBAJO DEL TECLADO (12/08/2026)
//
// Reportado con la pantalla en la mano, en "Presupuestos por categoria": al tocar una casilla,
// el teclado tapaba "Guardar cambios". Habia que escribir el monto, CERRAR el teclado a mano y
// recien entonces guardar. Quien no sepa ese paso piensa que el boton no esta — o guarda a
// medias creyendo que ya guardo.
//
// LO QUE VIGILA ESTA PRUEBA
//
// La regla: si una pantalla tiene una casilla para escribir Y una barra de botones pegada
// abajo, esa barra tiene que subir con el teclado. Y tiene que hacerlo con LA MISMA pieza que
// las demas —useKeyboardAnimatedPadding—, no con una copia.
//
// POR QUE LA MISMA PIEZA Y NO UNA COPIA. El alto del teclado se puede sacar de dos sitios: de
// los avisos de Android o de Reanimated. Los avisos llegan tarde y la pantalla da un salto; con
// Reanimated el hueco se abre a la vez que el teclado. Eso ya costo dos intentos fallidos en
// "Nuevo movimiento" (KeyboardAvoidingView y Keyboard.metrics), y estan documentados alli. Una
// copia nueva volveria a caer en lo mismo sin enterarse.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

/**
 * Lo mismo pero SIN COMENTARIOS.
 *
 * Hace falta para la parte de abajo, y la primera version de esta prueba se equivoco justo
 * ahi: "Nuevo movimiento" NOMBRA los dos caminos fallidos en un comentario largo que explica
 * por que se descartaron —que es exactamente la clase de comentario que hay que conservar— y
 * la prueba lo leyo como si los estuviera usando.
 */
const leerSinComentarios = (f) =>
  leer(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

// Las pantallas con casilla de escribir Y barra de botones abajo.
const PANTALLAS = [
  ["screens/AddSheet.tsx", "Nuevo movimiento"],
  ["screens/MoveMoneySheet.tsx", "Mover plata a una meta"],
  ["screens/CategoryBudgets.tsx", "Presupuestos por categoria"],
  ["screens/NuevaCategoria.tsx", "Nueva categoria"],
];

console.log("\n--- TODAS SUBEN SUS BOTONES CON EL TECLADO ---");
for (const [ruta, nombre] of PANTALLAS) {
  const txt = leer(ruta);
  // AddSheet usa useAnimatedKeyboard directamente —es donde se resolvio primero y de donde
  // salio el hook— asi que vale cualquiera de las dos.
  const tieneHueco = /useKeyboardAnimatedPadding|useAnimatedKeyboard/.test(txt);
  ok(tieneHueco, `${nombre} deja hueco para el teclado`);
  ok(/animatedPaddingStyle/.test(txt), `y ${nombre} lo aplica a su contenedor`);
}

console.log("\n--- Y NINGUNA VUELVE A LOS DOS CAMINOS QUE YA FALLARON ---");
for (const [ruta, nombre] of PANTALLAS) {
  const txt = leerSinComentarios(ruta);
  // KeyboardAvoidingView: el primer intento en "Nuevo movimiento". Por dentro depende de los
  // avisos de Android, que llegan tarde.
  ok(!/KeyboardAvoidingView/.test(txt), `${nombre} no usa KeyboardAvoidingView`);
  // Keyboard.metrics(): el segundo intento. Devuelve la medida de ANTES de que el teclado
  // termine de abrirse.
  ok(!/Keyboard\.metrics\(\)/.test(txt), `ni mide el teclado a mano en ${nombre}`);
}

console.log("\n--- EL CONTENEDOR TIENE QUE SER ANIMADO ---");
{
  // Un View normal con un estilo animado dentro no se mueve: Reanimated necesita su propia
  // vista para poder cambiarla sin volver a dibujar la pantalla entera.
  for (const [ruta, nombre] of PANTALLAS) {
    const txt = leer(ruta);
    ok(/<Animated\.View/.test(txt), `${nombre} envuelve todo en un contenedor animado`);
  }
}

console.log("\n--- Y NINGUNA HEREDA EL TECLADO DE LA ANTERIOR (12/08/2026) ---");
{
  // Reportado con la captura: entrar POR PRIMERA VEZ a "Presupuestos por categoria" y
  // encontrarse media pantalla vacia debajo del boton, sin haber tocado ningun teclado.
  //
  // El valor de useAnimatedKeyboard es COMPARTIDO por toda la app y sobrevive a que la pantalla
  // que lo usaba se cierre: la siguiente arranca con el ultimo valor conocido, que puede ser
  // "abierto, 341 px" sin ningun teclado en pantalla.
  //
  // ESTABA RESUELTO EN AddSheet, escrito a mano dentro de esa pantalla, y al sacar el mecanismo
  // a la pieza compartida el arreglo se quedo alli. Asi que "Nuevo movimiento" estaba a salvo y
  // las tres que vinieron despues, no. El fallo de siempre: la pieza se comparte y la leccion
  // se queda en la casa vieja.
  const hook = leerSinComentarios("utils/keyboard.ts");
  ok(/Keyboard\.isVisible\(\)/.test(hook), "la pieza compartida pregunta si hay un teclado de verdad");
  ok(/ignorarHeredado/.test(hook), "y descarta la altura heredada mientras no lo haya");
  // Solo OPENING, no OPEN: "abierto" es justo el estado en el que se queda grabado el valor
  // viejo, asi que confiar en el devolveria el hueco.
  ok(/KeyboardState\.OPENING/.test(hook), "y solo vuelve a confiar cuando el teclado se ABRE de verdad");

  // LA OTRA MITAD: cada pantalla cierra el teclado al salir, para no dejarselo puesto a la
  // siguiente. Las dos capas juntas son las que dejan el hueco en cero.
  for (const [ruta, nombre] of PANTALLAS) {
    const txt = leerSinComentarios(ruta);
    ok(/Keyboard\.dismiss\(\)/.test(txt), `${nombre} cierra el teclado al salir`);
  }
}

console.log(fallos === 0 ? "\nTodo bien: el boton de guardar siempre se alcanza" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);

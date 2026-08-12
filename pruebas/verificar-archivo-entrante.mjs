// Comprueba el rescate del archivo que llega desde "Compartir -> Fino".
//
// Esto es una SIMULACION del algoritmo de IncomingFileEffect, no el
// componente de verdad: el componente vive dentro de React y depende de
// AppState. Lo que se comprueba aqui es la parte que fallaba, que es la
// logica, y se comprueba de la unica forma que demuestra algo: corriendo el
// algoritmo VIEJO y el NUEVO contra el mismo escenario. Si el viejo pasara,
// la prueba no valdria nada.
//
// El escenario es el real: al llegar desde otra app, Fino arranca de cero.
// El efecto corre en cuanto los datos estan listos, y eso pasa ANTES de que
// el sistema de pantallas pueda recibir ordenes.

let fallos = 0;
function ok(cond, msg) {
  console.log(`  ${cond ? "OK   " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
}

/** El modulo nativo: entrega el archivo UNA sola vez. */
function crearNativo(archivo) {
  let entregado = false;
  return () => {
    if (entregado) return null;
    entregado = true;
    return archivo;
  };
}

/** La navegacion tarda `retraso` intentos en poder recibir ordenes. */
function crearNavegacion(retraso) {
  let intentos = 0;
  return { isReady: () => intentos++ >= retraso };
}

// --- El algoritmo VIEJO ---
function viejo({ consumir, nav, hasOnboarded }) {
  const abiertos = [];
  function check() {
    const file = consumir();
    if (!file) return;
    if (!hasOnboarded || !nav.isReady()) return; // se pierde para siempre
    abiertos.push(file);
  }
  // Arranque + una vuelta al frente mas tarde.
  check();
  check();
  return abiertos;
}

// --- El algoritmo NUEVO ---
function nuevo({ consumir, nav, hasOnboarded }, vueltas = 60) {
  const abiertos = [];
  let pending = null;
  function intentar() {
    if (!pending) pending = consumir();
    const file = pending;
    if (!file) return true;
    if (!hasOnboarded || !nav.isReady()) return false;
    pending = null;
    abiertos.push(file);
    return true;
  }
  for (let i = 0; i < vueltas; i++) if (intentar()) break;
  return abiertos;
}

const ARCHIVO = { uri: "file:///cache/estado.pdf", name: "estado-de-cuenta.pdf" };

console.log("\n--- LA NAVEGACION TARDA EN ESTAR LISTA (el caso real) ---");
{
  const args = () => ({ consumir: crearNativo(ARCHIVO), nav: crearNavegacion(5), hasOnboarded: true });
  const a = viejo(args());
  ok(a.length === 0, `el algoritmo VIEJO pierde el archivo (abrio ${a.length} veces) — este era el fallo`);
  const b = nuevo(args());
  ok(b.length === 1, "el NUEVO lo abre en cuanto la navegacion responde");
  ok(b[0].name === ARCHIVO.name, "y abre el archivo correcto, con su nombre");
}

console.log("\n--- LA NAVEGACION YA ESTABA LISTA ---");
{
  const b = nuevo({ consumir: crearNativo(ARCHIVO), nav: crearNavegacion(0), hasOnboarded: true });
  ok(b.length === 1, "se abre al primer intento, sin esperar");
}

console.log("\n--- NO SE ABRE DOS VECES ---");
{
  // Lo mas grave despues de perderlo seria importar el mismo estado de
  // cuenta dos veces: saldrian todos los movimientos duplicados.
  const b = nuevo({ consumir: crearNativo(ARCHIVO), nav: crearNavegacion(3), hasOnboarded: true }, 200);
  ok(b.length === 1, `se abre UNA sola vez aunque se insista 200 veces (abrio ${b.length})`);
}

console.log("\n--- SIN ARCHIVO NO PASA NADA ---");
{
  const b = nuevo({ consumir: () => null, nav: crearNavegacion(0), hasOnboarded: true }, 200);
  ok(b.length === 0, "sin archivo pendiente no se abre ninguna pantalla");
}

console.log("\n--- LA APP TODAVIA NO ESTA CONFIGURADA ---");
{
  // Sin haber terminado la configuracion inicial no hay donde importar. El
  // archivo NO puede darse por abierto, pero tampoco puede colgar la app en
  // un bucle: se insiste un rato y se deja.
  const b = nuevo({ consumir: crearNativo(ARCHIVO), nav: crearNavegacion(0), hasOnboarded: false }, 60);
  ok(b.length === 0, "no se abre importar sin la app configurada");
  ok(true, "y el bucle termina solo, no se queda insistiendo para siempre");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

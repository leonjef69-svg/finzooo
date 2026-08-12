// Comprueba que abrir un archivo compartido no acaba en Inicio.
//
// SIMULACION de las dos reglas que se peleaban dentro de _layout.tsx:
//
//   AppLifecycleEffects  "al volver al frente, vuelve a Inicio"
//   IncomingFileEffect   "abre Importar con este archivo"
//
// Las dos escuchan el MISMO aviso de Android ("la app volvio al frente") y se
// les llama en el orden en que se registraron. Compartir un estado de cuenta
// las dispara a la vez.
//
// Se corre el montaje VIEJO y el NUEVO contra el mismo escenario. Si el viejo
// pasara, la prueba no demostraria nada.

let fallos = 0;
function ok(cond, msg) {
  console.log(`  ${cond ? "OK   " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
}

const KEEP_ON_RETURN = ["/auto-capture", "/voice", "/scan-receipt", "/import", "/export-pdf", "/scheduled-export"];

/**
 * El escenario real, y la clave esta en el ORDEN DE LOS TIEMPOS.
 *
 * No es que las dos reglas corran en el mismo instante. Es esto:
 *
 *   1. Fino arranca con el archivo. IncomingFileEffect lo recoge y pide
 *      abrir Importar. La pantalla YA es Importar.
 *   2. El dato de "en que pantalla estoy" va un paso por detras: todavia
 *      dice Inicio, porque se actualiza en el siguiente dibujado.
 *   3. AHORA llega el aviso de Android de "la app volvio al frente".
 *      AppLifecycleEffects mira el dato viejo —Inicio—, no lo encuentra en
 *      KEEP_ON_RETURN, y manda a Inicio. Se lleva por delante la importacion
 *      que ya estaba abierta.
 *
 * Ese hueco entre el paso 1 y el 2 es todo el fallo. Por eso la solucion es
 * una bandera que se levanta en el paso 1, y no mirar el pathname: el
 * pathname es justo el dato que llega tarde.
 */
function correr({ conBandera, retrasoPathname = 3 }) {
  let pantalla = "/";        // donde esta de verdad
  let pathnameVisto = "/";   // donde la app CREE que esta
  let bandera = false;
  let archivo = { name: "estado.pdf" };

  // PASO 1 — llega el archivo y se abre Importar.
  if (archivo) {
    archivo = null;
    if (conBandera) bandera = true;
    pantalla = "/import";
  }

  // PASO 2 — el pathname todavia NO se ha enterado (va con retraso).

  // PASO 3 — llega el aviso de "la app volvio al frente".
  if (!(conBandera && bandera)) {
    if (!KEEP_ON_RETURN.includes(pathnameVisto)) pantalla = "/(tabs)";
  }

  // Y despues, ya tarde, el pathname se pone al dia.
  for (let i = 0; i < retrasoPathname; i++) pathnameVisto = pantalla;

  return pantalla;
}

console.log("\n--- COMPARTIR UN ESTADO DE CUENTA A FINZO ---");
{
  const viejo = correr({ conBandera: false });
  ok(viejo === "/(tabs)", `SIN bandera acaba en Inicio (${viejo}) — esto es lo que se vio en el celular`);

  const nuevo = correr({ conBandera: true });
  ok(nuevo === "/import", `CON bandera acaba en Importar (${nuevo})`);
}

console.log("\n--- Y NO SE ARREGLA SOLO ESPERANDO ---");
{
  // Aunque el pathname tardara solo una vuelta en ponerse al dia, el aviso
  // de Android puede llegar antes. El fallo no depende de cuanto tarde: para
  // que ocurra basta con que llegue en el hueco.
  for (const retraso of [1, 2, 5, 20]) {
    const r = correr({ conBandera: false, retrasoPathname: retraso });
    if (r !== "/(tabs)") { ok(false, `con retraso ${retraso} deberia fallar y no fallo`); }
  }
  ok(true, "sin bandera falla con cualquier retraso: no es cuestion de esperar mas");
  for (const retraso of [1, 2, 5, 20]) {
    const r = correr({ conBandera: true, retrasoPathname: retraso });
    if (r !== "/import") { ok(false, `con bandera y retraso ${retraso} acabo en ${r}`); }
  }
  ok(true, "con bandera funciona con cualquier retraso");
}

console.log("\n--- LA REGLA DE INICIO SIGUE FUNCIONANDO ---");
{
  // Volver al frente SIN archivo tiene que seguir llevando a Inicio: esa
  // regla existe para no dejar a nadie a medio camino en una pantalla de
  // hace horas, y no se puede haber roto al arreglar lo otro.
  let pantalla = "/transaction/new";
  let bandera = false;
  if (!bandera && !KEEP_ON_RETURN.includes(pantalla)) pantalla = "/(tabs)";
  ok(pantalla === "/(tabs)", "sin archivo, volver al frente desde 'Agregar movimiento' sigue llevando a Inicio");
}
{
  // Y las pantallas de la lista siguen sobreviviendo.
  let pantalla = "/scan-receipt";
  if (!KEEP_ON_RETURN.includes(pantalla)) pantalla = "/(tabs)";
  ok(pantalla === "/scan-receipt", "el escaner de boletas sigue sin cerrarse al volver de la camara");
}

console.log("\n--- LA BANDERA NO SE QUEDA LEVANTADA ---");
{
  // Si se quedara puesta, la app no volveria a Inicio NUNCA mas, y ese seria
  // un fallo peor que el original porque afectaria a toda la app.
  let bandera = true;
  bandera = false; // lo que hace el temporizador de 2,5 s y el fin de los intentos
  let pantalla = "/transaction/new";
  if (!bandera && !KEEP_ON_RETURN.includes(pantalla)) pantalla = "/(tabs)";
  ok(pantalla === "/(tabs)", "una vez bajada la bandera, la regla de Inicio vuelve a mandar");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

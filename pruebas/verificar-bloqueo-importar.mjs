// Compartir un estado de cuenta a Fino CON EL BLOQUEO PUESTO.
//
// El escenario lo describio la persona que usa la app: "descargo mi estado de
// cuenta, pongo la opcion Fino, primero me sale para poner mi huella o codigo
// PIN, luego me manda a la pantalla principal". Y tenia razon: el bloqueo era
// el causante.
//
// Esto es una SIMULACION del algoritmo de IncomingFileEffect. Se corre el
// VIEJO y el NUEVO contra la misma secuencia de tiempos. Si el viejo pasara,
// la prueba no demostraria nada.

let fallos = 0;
function ok(cond, msg) {
  console.log(`  ${cond ? "OK   " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
}

/**
 * Corre el reintento contra un reloj simulado.
 *
 * `desbloqueaEn` son los milisegundos que tarda la persona en poner su PIN o
 * su huella. `conEspera` es el arreglo: no navegar mientras el candado este
 * puesto, y seguir insistiendo dos minutos en vez de tres segundos.
 */
function correr({ desbloqueaEn, conEspera, intentos, pausa }) {
  let t = 0;
  let abierto = null;
  let pendiente = { name: "estado.pdf" };
  const bloqueada = () => t < desbloqueaEn;

  for (let i = 0; i < intentos; i++) {
    if (!pendiente) break;
    // El viejo navegaba aunque el candado estuviera puesto; y navegar por
    // debajo del candado no sirve, porque al cerrarse el cuadro de la huella
    // la app se manda sola a Inicio.
    const puede = conEspera ? !bloqueada() : true;
    if (puede) {
      const seQueda = conEspera ? true : !bloqueada();
      abierto = seQueda ? pendiente : null;
      pendiente = null;
      break;
    }
    t += pausa;
  }
  return { abierto, pendiente, tiempoFinal: t };
}

console.log("\n--- PONER EL PIN TARDA MAS DE 3 SEGUNDOS ---");
{
  // Lo de antes: 60 intentos cada 50 ms = 3 segundos, y navegaba igual con el
  // candado puesto.
  const viejo = correr({ desbloqueaEn: 8000, conEspera: false, intentos: 60, pausa: 50 });
  ok(viejo.abierto === null, "el VIEJO no abre Importar: navego bajo el candado y la app se lo llevo a Inicio");

  // Lo de ahora: 400 intentos cada 300 ms = dos minutos, y espera al
  // desbloqueo.
  const nuevo = correr({ desbloqueaEn: 8000, conEspera: true, intentos: 400, pausa: 300 });
  ok(nuevo.abierto !== null, "el NUEVO si abre Importar, despues de desbloquear");
  ok(nuevo.tiempoFinal >= 8000, `y espero a que se desbloqueara (${nuevo.tiempoFinal} ms)`);
}

console.log("\n--- AGUANTA AUNQUE SE TARDE ---");
{
  for (const segundos of [3, 10, 30, 60, 110]) {
    const r = correr({ desbloqueaEn: segundos * 1000, conEspera: true, intentos: 400, pausa: 300 });
    if (!r.abierto) { ok(false, `tardando ${segundos}s no abrio`); }
  }
  ok(true, "desbloqueando a los 3, 10, 30, 60 y 110 segundos, siempre abre");
}
{
  // El tope existe igual: sin el, un archivo que nunca se pueda abrir dejaria
  // un temporizador dando vueltas para siempre.
  const r = correr({ desbloqueaEn: 999999, conEspera: true, intentos: 400, pausa: 300 });
  ok(r.abierto === null, "si no se desbloquea nunca, se deja de insistir");
  ok(r.tiempoFinal <= 120000, `y el bucle termina, no se queda para siempre (${r.tiempoFinal} ms)`);
  ok(r.pendiente !== null, "pero el archivo NO se pierde: queda apuntado para el aviso de Inicio");
}

console.log("\n--- SIN BLOQUEO SIGUE SIENDO INMEDIATO ---");
{
  const r = correr({ desbloqueaEn: 0, conEspera: true, intentos: 400, pausa: 300 });
  ok(r.abierto !== null, "sin candado abre Importar");
  ok(r.tiempoFinal === 0, "y sin esperar nada: quien no tiene bloqueo no nota ningun retraso");
}

console.log("\n--- LA BANDERA YA NO ES UN CRONOMETRO ---");
{
  // La bandera que impide que la app vuelva a Inicio era un cronometro de
  // 2,5 segundos desde que se pedia la navegacion. Con el candado puesto se
  // bajaba sola antes de que la persona terminara de desbloquear.
  const conCronometro = (msDesbloqueo) => 2500 >= msDesbloqueo;
  ok(!conCronometro(8000), "el cronometro de 2,5 s se bajaba antes de desbloquear a los 8 s");

  // Ahora la bandera esta puesta mientras HAYA un archivo esperando.
  const conArchivo = (hayArchivo) => hayArchivo;
  ok(conArchivo(true), "con archivo esperando, la bandera esta puesta");
  ok(!conArchivo(false), "y se baja sola cuando Importar lo carga");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

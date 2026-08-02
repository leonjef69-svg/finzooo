// Comprueba CUANDO se bloquea la app y cuando no.
//
// Los dos errores posibles son opuestos y los dos son graves:
//  · bloquear de mas → volver de la camara pide la huella otra vez y la
//    funcion estorba hasta que se apaga.
//  · bloquear de menos → el telefono se queda solo y cualquiera entra.
//
// Aqui se reproduce la maquina de estados de components/AppLockGate.tsx y se
// le pasan las secuencias reales que hace Android.

const GRACE_MS = 30_000;

function crearGuardian({ enabled }) {
  const estado = {
    enabled,
    locked: enabled, // al arrancar, si esta puesto, arranca bloqueado
    prompting: false,
    leftAt: null,
    ahora: 0,
  };

  return {
    estado,
    avanzar(ms) {
      estado.ahora += ms;
    },
    // Empieza el cuadro de huella del sistema
    abrirHuella() {
      estado.prompting = true;
    },
    cerrarHuella(exito) {
      estado.prompting = false;
      if (exito) estado.locked = false;
    },
    // Mismo escuchador de AppState que el componente
    appState(next) {
      if (!estado.enabled) return;
      if (next === "background" || next === "inactive") {
        if (!estado.prompting && estado.leftAt === null) estado.leftAt = estado.ahora;
        return;
      }
      if (next === "active") {
        const since = estado.leftAt;
        estado.leftAt = null;
        if (!estado.prompting && since !== null && estado.ahora - since > GRACE_MS) {
          estado.locked = true;
        }
      }
    },
    desbloquearConPin() {
      estado.locked = false;
    },
  };
}

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(56)} ${d}`);
  if (!ok) fallos++;
}

console.log("Con el bloqueo APAGADO nunca molesta");
{
  const g = crearGuardian({ enabled: false });
  check("arranca desbloqueada", g.estado.locked === false);
  g.appState("background");
  g.avanzar(10 * 60_000);
  g.appState("active");
  check("ni despues de diez minutos fuera", g.estado.locked === false);
}

console.log("\nCon el bloqueo PUESTO");
{
  const g = crearGuardian({ enabled: true });
  check("arranca bloqueada", g.estado.locked === true);
  g.desbloquearConPin();
  check("se abre con el PIN", g.estado.locked === false);

  // El telefono se queda solo
  g.appState("background");
  g.avanzar(5 * 60_000);
  g.appState("active");
  check("cinco minutos fuera: vuelve a bloquear", g.estado.locked === true);
}

console.log("\nLos rebotes de Android NO deben bloquear");
{
  // Escanear una boleta: la camara toma el control unos segundos
  const g = crearGuardian({ enabled: true });
  g.desbloquearConPin();
  g.appState("inactive");
  g.avanzar(8_000);
  g.appState("active");
  check("volver de la camara (8s)", g.estado.locked === false);

  // Dictar por voz: el servicio de Google toma el foco
  g.appState("inactive");
  g.avanzar(20_000);
  g.appState("active");
  check("volver del microfono (20s)", g.estado.locked === false);

  // Elegir un archivo al importar
  g.appState("background");
  g.avanzar(29_000);
  g.appState("active");
  check("volver del selector de archivos (29s)", g.estado.locked === false);

  // Justo pasado el margen
  g.appState("background");
  g.avanzar(31_000);
  g.appState("active");
  check("pero a los 31s si bloquea", g.estado.locked === true);
}

console.log("\nEl cuadro de la huella no se cuenta como salir de la app");
{
  // Sin esta proteccion habria un bucle: el cuadro manda la app a
  // "inactive", al cerrarse vuelve a "active", y eso volveria a bloquear,
  // que abre el cuadro otra vez.
  const g = crearGuardian({ enabled: true });
  check("arranca bloqueada", g.estado.locked === true);

  g.abrirHuella();
  g.appState("inactive");
  g.avanzar(45_000); // la persona tarda en poner el dedo
  g.appState("active");
  g.cerrarHuella(true);
  check("huella correcta: queda abierta", g.estado.locked === false);
  check("y no quedo ninguna salida a medias", g.estado.leftAt === null);

  // Y si la cancela, sigue bloqueada pero sin bucle
  const g2 = crearGuardian({ enabled: true });
  g2.abrirHuella();
  g2.appState("inactive");
  g2.avanzar(60_000);
  g2.appState("active");
  g2.cerrarHuella(false);
  check("huella cancelada: sigue bloqueada", g2.estado.locked === true);
  check("sin bucle: no hay salida pendiente", g2.estado.leftAt === null);
}

console.log("\nSalidas encadenadas");
{
  const g = crearGuardian({ enabled: true });
  g.desbloquearConPin();
  // Android puede mandar "inactive" y luego "background" seguidos. El
  // momento de salida debe ser el PRIMERO, no el ultimo, o el margen se
  // reiniciaria solo y nunca llegaria a bloquear.
  g.appState("inactive");
  g.avanzar(1_000);
  g.appState("background");
  g.avanzar(35_000);
  g.appState("active");
  check("inactive + background seguidos: cuenta desde el primero", g.estado.locked === true);
}

console.log("\nVolver sin haber salido");
{
  const g = crearGuardian({ enabled: true });
  g.desbloquearConPin();
  // Algunos fabricantes mandan "active" repetido sin un "background" antes.
  g.appState("active");
  g.appState("active");
  check("dos 'active' seguidos no bloquean", g.estado.locked === false);
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;

// TRES YAPES IGUALES EL MISMO DIA SON TRES MOVIMIENTOS.
//
// Fallo real y reportado: se yapeo S/ 1 de la misma persona tres veces. El
// primero se registro; los otros dos salieron como "Ya lo tenias" y no
// aparecieron nunca. Dinero que entro y la app decidio que no.
//
// La regla anti-repetidos existe para no duplicar lo que ya escribiste a mano
// o lo que entro al importar el estado de cuenta. Contra otro movimiento que
// vino de una notificacion no sirve: los avisos ya vienen sin repetir del
// servicio de Android, que descarta el mismo aviso reenviado con su hora al
// segundo.
import { processCaptured } from "@/utils/autoCapture";
import type { Transaction } from "@/types";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

const t = (k: string) => k;
const HOY = new Date(2026, 7, 2, 12, 0).getTime();

/** Un aviso de Yape tal cual lo manda la app. */
function yape(minutos: number, monto: number, de = "JEFFERSON GIOVANNI LEON CARLOS") {
  return {
    package: "com.bcp.innovacxion.yapeapp",
    title: "Confirmación de Pago",
    text: `Yape! ${de} te envió un pago por S/ ${monto}`,
    postedAt: HOY - minutos * 60000,
  };
}

console.log("\n--- EL CASO QUE FALLO: TRES YAPES DE S/ 1 ---");
{
  const { toAdd } = processCaptured([yape(60, 1), yape(30, 1), yape(5, 1)], [], {}, t, HOY);
  ok(toAdd.length === 3, `entran los tres (${toAdd.length})`);
  ok(toAdd.every((m) => m.amount === 1), "los tres de S/ 1");
  ok(toAdd.every((m) => m.type === "income"), "y los tres como ingreso");
}

console.log("\n--- Y SI YA HABIA UNO REGISTRADO ANTES, EL NUEVO TAMBIEN ENTRA ---");
{
  // Este es exactamente el caso reportado: el yape de las 02:28 ya estaba
  // guardado, y el de las 03:31 salio como "Ya lo tenias".
  const yaGuardado: Transaction[] = [
    {
      id: 1,
      type: "income",
      amount: 1,
      category: "otro_ingreso",
      date: "2026-08-02",
      method: "yape",
      description: "JEFFERSON GIOVANNI LEON CARLOS",
      notes: "",
      origin: "auto",
    },
  ];
  const { toAdd, log } = processCaptured([yape(5, 1)], yaGuardado, {}, t, HOY);
  ok(toAdd.length === 1, "el yape nuevo entra igual");
  ok(!log.some((l) => l.result === "duplicate"), "y no se marca como repetido");
}

console.log("\n--- LO ESCRITO A MANO SI FRENA AL AVISO ---");
{
  // Aqui la regla SI tiene sentido: se anoto a mano al instante y ademas
  // llego la notificacion. Sin esto, el movimiento saldria dos veces.
  const aMano: Transaction[] = [
    {
      id: 1,
      type: "income",
      amount: 1,
      category: "otro_ingreso",
      date: "2026-08-02",
      method: "yape",
      description: "JEFFERSON GIOVANNI LEON CARLOS",
      notes: "",
      origin: "manual",
    },
  ];
  const { toAdd, log } = processCaptured([yape(5, 1)], aMano, {}, t, HOY);
  ok(toAdd.length === 0, "no se duplica lo que ya se escribio a mano");
  ok(log.some((l) => l.result === "duplicate"), "y se dice que era repetido");
}

console.log("\n--- MONTOS DISTINTOS, SIN DUDA ---");
{
  const { toAdd } = processCaptured([yape(20, 1), yape(10, 50), yape(2, 1)], [], {}, t, HOY);
  ok(toAdd.length === 3, "los tres entran");
  ok(toAdd.filter((m) => m.amount === 1).length === 2, "los dos de S/ 1");
  ok(toAdd.filter((m) => m.amount === 50).length === 1, "y el de S/ 50");
}

console.log("\n--- LA HORA ES LA DEL YAPEO, NO LA DE AHORA ---");
{
  // Si el trabajo de fondo corre horas despues —o la app estuvo cerrada dos
  // dias— la hora buena es la del aviso. Poner la de ahora haria que un yapeo
  // de la mañana apareciera como de la noche.
  const haceTresHoras = 180;
  const { toAdd } = processCaptured([yape(haceTresHoras, 25)], [], {}, t, HOY);
  ok(toAdd.length === 1, "entra el movimiento");
  const esperada = new Date(HOY - haceTresHoras * 60000);
  // La misma cuenta que horaDe: 12 horas con a.m./p.m., y la medianoche son
  // las 12 a.m., no las 0.
  const h24 = esperada.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const hhmm = h12 + ":" + String(esperada.getMinutes()).padStart(2, "0") + (h24 < 12 ? " a.m." : " p.m.");
  ok(toAdd[0].time === hhmm, `con la hora del aviso (${toAdd[0].time}, esperada ${hhmm})`);
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

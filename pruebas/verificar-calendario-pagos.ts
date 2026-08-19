// EL CALENDARIO DE PAGOS — las cuentas (18/08/2026)
//
// Lo pidió así: *"un calendario para que la gente pueda poner en una fecha el monto —mi
// suscripción de Netflix, el recibo del agua o la luz— y pueda personalizar qué día y a qué
// hora me avise para pagarlo"*.
//
// Se comprueba con números lo que no se puede comprobar esperando: el día 31 en febrero, el
// aviso que cae en el mes anterior, el salto de año y el pago único que no debe repetirse.
// Los cuatro son errores de una línea que solo aparecen en una fecha concreta del calendario,
// y para entonces ya se le prometió a alguien que le íbamos a avisar de su recibo.
import {
  cuandoAvisar,
  cuentaPorEstado,
  estadoEn,
  faltaPorPagar,
  fechaEnElMes,
  hayVariosTipos,
  marcarPagado,
  mesSiguiente,
  movimientoDelPago,
  pagosDelMes,
  proximoPago,
  primerAviso,
  validarPago,
  type PagoProgramado,
} from "@/utils/calendarioPagos";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const base = {
  repite: "mensual" as const,
  avisoDiasAntes: 2,
  avisoHora: "09:00",
  pagados: [] as string[],
  creado: 0,
};
const pago = (extra: Partial<PagoProgramado>): PagoProgramado => ({
  id: "x",
  nombre: "Luz",
  tipo: "pago",
  monto: 90,
  dia: 18,
  ...base,
  ...extra,
});

// El 16 de agosto de 2026, que es el día en que se pidió esto.
const HOY = new Date(2026, 7, 16);

// ---------------------------------------------------------------------------
console.log("\nEl día 31 en los meses que no lo tienen");

const treintaYUno = pago({ dia: 31, nombre: "Alquiler" });
ok(fechaEnElMes(treintaYUno, "2026-01") === "2026-01-31", "en enero cae el 31");
ok(
  fechaEnElMes(treintaYUno, "2026-02") === "2026-02-28",
  "en febrero cae el 28 y NO se escapa a marzo: quien paga el 31 no deja de pagar en febrero"
);
ok(fechaEnElMes(treintaYUno, "2028-02") === "2028-02-29", "y en un febrero bisiesto, el 29");
ok(fechaEnElMes(treintaYUno, "2026-04") === "2026-04-30", "en abril, que tiene 30, cae el 30");

// ---------------------------------------------------------------------------
console.log("\nPagado, pendiente o vencido");

ok(estadoEn(pago({ dia: 18 }), "2026-08", HOY) === "pendiente", "el 18 visto el 16 está pendiente");
ok(estadoEn(pago({ dia: 5 }), "2026-08", HOY) === "vencido", "el 5 visto el 16 está vencido");
ok(
  estadoEn(pago({ dia: 16 }), "2026-08", HOY) === "pendiente",
  "y el de HOY no está vencido: quien paga el 16 paga el 16"
);
ok(
  estadoEn(pago({ dia: 5, pagados: ["2026-08"] }), "2026-08", HOY) === "pagado",
  "marcado como pagado gana sobre la fecha"
);
ok(
  estadoEn(pago({ dia: 5, pagados: ["2026-07"] }), "2026-08", HOY) === "vencido",
  "y pagar julio NO deja pagado agosto: cada mes se marca por separado"
);

const marcado = marcarPagado(pago({}), "2026-08", true);
ok(marcado.pagados.includes("2026-08"), "marcar añade el mes");
ok(!marcarPagado(marcado, "2026-08", false).pagados.includes("2026-08"), "y desmarcar lo quita");
ok(
  marcarPagado(marcado, "2026-08", true).pagados.length === 1,
  "marcar dos veces no lo mete dos veces"
);

// ---------------------------------------------------------------------------
console.log("\nEl pago único no se repite");

const unico = pago({ repite: "unica", mesUnico: "2026-08", nombre: "Matrícula" });
ok(fechaEnElMes(unico, "2026-08") !== "", "sale en su mes");
ok(fechaEnElMes(unico, "2026-09") === "", "y NO sale en el siguiente");
ok(pagosDelMes([unico], "2026-09").length === 0, "así que la lista de septiembre no lo trae");

// ---------------------------------------------------------------------------
console.log("\nCuándo suena el aviso");

const avisoLuz = cuandoAvisar(pago({ dia: 18, avisoDiasAntes: 2, avisoHora: "09:00" }), "2026-08");
ok(avisoLuz?.getDate() === 16 && avisoLuz.getMonth() === 7, "dos días antes del 18 es el 16 de agosto");
ok(avisoLuz?.getHours() === 9 && avisoLuz.getMinutes() === 0, "a las 9:00 en punto, la hora elegida");

const avisoCruzado = cuandoAvisar(pago({ dia: 2, avisoDiasAntes: 5, avisoHora: "08:00" }), "2026-08");
ok(
  avisoCruzado?.getMonth() === 6 && avisoCruzado.getDate() === 28,
  "un aviso con 5 días para el 2 de agosto cae en JULIO, y eso es correcto"
);

const mismoDia = cuandoAvisar(pago({ dia: 10, avisoDiasAntes: 0, avisoHora: "20:30" }), "2026-08");
ok(
  mismoDia?.getDate() === 10 && mismoDia.getHours() === 20 && mismoDia.getMinutes() === 30,
  "con cero días avisa el mismo día, a su hora"
);

ok(mesSiguiente("2026-12") === "2027-01", "el mes siguiente a diciembre es enero del año que viene");
ok(mesSiguiente("2026-08") === "2026-09", "y dentro del año, el de al lado");

// ---------------------------------------------------------------------------
console.log("\nLo que te falta este mes");

const mes = [
  pago({ id: "1", nombre: "Agua", dia: 5, monto: 35 }),
  pago({ id: "2", nombre: "Luz", dia: 18, monto: 90 }),
  pago({ id: "3", nombre: "Netflix", dia: 15, monto: 44, pagados: ["2026-08"] }),
  pago({ id: "4", nombre: "Sueldo", dia: 30, monto: 1200, tipo: "ingreso" }),
  pago({ id: "5", nombre: "Llamar al banco", dia: 22, monto: undefined, tipo: "recordatorio" }),
];

ok(faltaPorPagar(mes, "2026-08", HOY) === 125, "35 del agua + 90 de la luz = 125");
ok(
  faltaPorPagar(mes, "2026-08", HOY) !== 1325,
  "el sueldo NO entra: lo que vas a cobrar no es algo que te falte pagar"
);

const cuenta = cuentaPorEstado(mes, "2026-08", HOY);
ok(cuenta.vencido === 1, "un vencido (el agua)");
ok(cuenta.pendiente === 3, "tres pendientes (luz, sueldo y el recordatorio)");
ok(cuenta.pagado === 1, "y uno pagado (Netflix)");

ok(hayVariosTipos(mes, "2026-08"), "con pagos, un ingreso y un recordatorio, la fila de tipos sale");
ok(
  !hayVariosTipos([mes[0], mes[1]], "2026-08"),
  "y con solo pagos NO sale: tres botones que no pueden cambiar nada son tres estorbos"
);

// ---------------------------------------------------------------------------
console.log("\nEl de arriba en grande");

const siguiente = proximoPago(mes, HOY);
ok(
  siguiente?.pago.nombre === "Agua",
  "manda lo VENCIDO sobre lo que viene: el agua del 5 antes que la luz del 18"
);

const sinVencidos = [pago({ id: "2", nombre: "Luz", dia: 18 }), pago({ id: "6", nombre: "Cable", dia: 25 })];
ok(proximoPago(sinVencidos, HOY)?.pago.nombre === "Luz", "sin vencidos, el más cercano");

// El día 29 lo que viene ya no está en este mes: si solo se mirara el mes actual, la tarjeta
// de arriba se quedaría vacía justo los días en que más sirve.
const finDeMes = new Date(2026, 7, 29);
const soloDia5 = [pago({ id: "1", nombre: "Agua", dia: 5, pagados: ["2026-08"] })];
ok(
  proximoPago(soloDia5, finDeMes)?.mes === "2026-09",
  "el día 29, con lo de agosto pagado, ya enseña lo de septiembre"
);
ok(proximoPago([], HOY) === null, "y sin nada que pagar, no hay tarjeta");

// ---------------------------------------------------------------------------
console.log("\nQué se puede guardar");

ok(validarPago("", "pago", 50, 5).ok === false, "sin nombre no se guarda");
ok(validarPago("Luz", "pago", undefined, 5).ok === false, "un pago sin monto tampoco");
ok(validarPago("Luz", "pago", 0, 5).ok === false, "ni con monto cero");
ok(validarPago("Llamar", "recordatorio", undefined, 5).ok === true, "un recordatorio SIN monto sí");
ok(validarPago("Luz", "pago", 90, 0).ok === false, "el día 0 no existe");
ok(validarPago("Luz", "pago", 90, 32).ok === false, "ni el 32");
ok(validarPago("Luz", "pago", 90, 31).ok === true, "el 31 sí, y ya se recorta solo en febrero");

// ---------------------------------------------------------------------------
console.log("\nEl movimiento que se crea al marcarlo pagado");

const movLuz = movimientoDelPago(pago({ dia: 18, monto: 90 }), "2026-08");
ok(movLuz?.type === "expense" && movLuz.amount === 90, "un pago crea un gasto por su monto");
ok(
  movLuz?.date === "2026-08-18",
  "con la fecha DEL PAGO y no la de hoy: marcarlo tarde no lo muda de mes"
);
ok(
  movimientoDelPago(pago({ tipo: "ingreso", monto: 1200, dia: 30 }), "2026-08")?.type === "income",
  "un ingreso crea un ingreso"
);
ok(
  movimientoDelPago(pago({ tipo: "recordatorio", monto: undefined }), "2026-08") === null,
  "y un recordatorio NO crea nada: no tiene monto y no puede tocar las cuentas"
);

// ---------------------------------------------------------------------------
// EL PRIMER AVISO QUE VA A SONAR DE VERDAD
//
// Es el caso que le confundio a el: elegir HOY con "1 dia antes" pide un aviso de AYER, que
// no se programa -Android lo disparia al instante-. Sin decirlo, la pantalla promete algo
// que no va a llegar.
console.log("\nCuando suena el primer aviso");

// Son las 10:00 del 18 de agosto.
const AHORA = new Date(2026, 7, 18, 10, 0);

const hoyTarde = primerAviso(pago({ dia: 18, avisoDiasAntes: 0, avisoHora: "15:55" }), AHORA);
ok(
  hoyTarde?.getDate() === 18 && hoyTarde.getMonth() === 7,
  "hoy a las 15:55, con cero dias de antelacion, suena HOY"
);

const yaPaso = primerAviso(pago({ dia: 18, avisoDiasAntes: 1, avisoHora: "09:00" }), AHORA);
ok(
  yaPaso?.getMonth() === 8,
  "hoy con UN dia de antelacion pedia el aviso de ayer: el primero que suena es el del mes que viene"
);

const unicoPasado = primerAviso(
  pago({ dia: 5, repite: "unica", mesUnico: "2026-08", avisoDiasAntes: 0 }),
  AHORA
);
ok(unicoPasado === null, "y un pago de una sola vez cuya fecha ya paso no avisa nunca");

console.log(
  fallos === 0
    ? "\nTodo bien: el calendario cuenta los días y el dinero\n"
    : `\n${fallos} fallas\n`
);
process.exit(fallos === 0 ? 0 : 1);

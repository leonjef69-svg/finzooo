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
  cuandoTexto,
  iconoSugerido,
  soloMonto,
  primerAviso,
  textoDeRepeticion,
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

// LA REGLA CAMBIO EL 19/08/2026, Y SE CAMBIA CON SU MOTIVO ESCRITO.
//
// Antes esta prueba exigia lo contrario: que el dia 29, con agosto pagado, la tarjeta pasara
// a enseñar lo de septiembre para no quedarse vacia. La razon era buena y aun asi el
// resultado era peor, porque con un pago MENSUAL el de septiembre es el mismo recibo: al
// pagar la luz de agosto salia otra vez "Luz, S/ 90, Pagar", identico, y parecia que el
// toque no habia hecho nada. El lo reporto dos veces como "tengo que dar 2 toques", y el
// segundo toque no repetia: pagaba septiembre por adelantado sin decirlo.
//
// Ahora la tarjeta solo habla de ESTE mes. Cuando no queda nada, la pantalla dice que se
// esta al dia — que es la verdad y ademas contesta algo.
const finDeMes = new Date(2026, 7, 29);
const soloDia5 = [pago({ id: "1", nombre: "Agua", dia: 5, pagados: ["2026-08"] })];
ok(
  proximoPago(soloDia5, finDeMes) === null,
  "con todo lo del mes pagado NO se adelanta al mes siguiente: pagar dos veces el mismo recibo era demasiado facil"
);
ok(
  proximoPago([pago({ id: "7", nombre: "Cable", dia: 30 })], finDeMes)?.mes === "2026-08",
  "y lo que aun queda de este mes sigue saliendo"
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

// ---------------------------------------------------------------------------
// EL DIBUJO QUE SE SUGIERE SOLO
//
// Es lo que hace que agregar un pago sean cero toques de mas: se escribe "Luz" y el rayo
// aparece. Si esto falla no se rompe nada -sale el dibujo por defecto- pero se pierde justo
// la parte que hacia la pantalla agradable.
console.log("\nEl dibujo que sale solo");

ok(iconoSugerido("Luz", "pago") === "Zap", "«Luz» trae el rayo");
ok(iconoSugerido("LUZ", "pago") === "Zap", "y da igual en mayusculas");
ok(iconoSugerido("Recibo de luz", "pago") === "Zap", "y dentro de una frase");
ok(iconoSugerido("Agua", "pago") === "Droplet", "«Agua» trae la gota");
ok(iconoSugerido("Água", "pago") === "Droplet", "con tilde tambien: se comparan sin tildes");
ok(iconoSugerido("Internet", "pago") === "Wifi", "«Internet» trae el wifi");
ok(iconoSugerido("Spotify", "pago") === "marca:spotify", "una marca trae su logo");
ok(iconoSugerido("Mi sueldo", "ingreso") === "Wallet", "«sueldo» trae la billetera");
ok(iconoSugerido("Cualquier cosa", "pago") === "Wallet", "sin coincidencia, el de los pagos");
ok(iconoSugerido("Cualquier cosa", "ingreso") === "TrendingUp", "el de los ingresos");
ok(iconoSugerido("Cualquier cosa", "recordatorio") === "Bell", "y el de los recordatorios");
// Nunca puede devolver vacio: la fila se quedaria sin dibujo y con un hueco.
for (const t of ["pago", "ingreso", "recordatorio"] as const) {
  ok(iconoSugerido("", t).length > 0, `nunca devuelve vacio (${t})`);
}

// ---------------------------------------------------------------------------
// EL RENGLON DE DEBAJO DEL NOMBRE
//
// Decia "el 19" y "se paso el 5", y el lo corto: "no tiene sentido esas letras". Un numero
// suelto obliga a mirar el calendario y restar.
console.log("\nQue dice debajo del nombre");

const HOY19 = new Date(2026, 7, 19);
ok(cuandoTexto(pago({ dia: 19 }), "2026-08", HOY19).clave === "calendario.cuando.hoy.pago", "el de hoy dice HOY");
ok(cuandoTexto(pago({ dia: 20 }), "2026-08", HOY19).clave === "calendario.cuando.manana.pago", "el de mañana dice MAÑANA");
const enTres = cuandoTexto(pago({ dia: 22 }), "2026-08", HOY19);
ok(enTres.clave === "calendario.cuando.enDias.pago" && enTres.dias === 3, "el del 22 dice EN 3 DIAS");
ok(
  cuandoTexto(pago({ dia: 30 }), "2026-08", HOY19).clave === "calendario.cuando.fecha.pago",
  "y a mas de una semana ya se dice la fecha, que contar once dias no lo hace nadie"
);
const vencio = cuandoTexto(pago({ dia: 5 }), "2026-08", HOY19);
ok(vencio.clave === "calendario.cuando.vencio" && vencio.dias === 14, "lo vencido dice cuantos dias hace");
ok(
  cuandoTexto(pago({ dia: 5, pagados: ["2026-08"] }), "2026-08", HOY19).clave === "calendario.cuando.pagado.pago",
  "y lo pagado lo dice, sin importar la fecha"
);
// EL VERBO CAMBIA CON EL TIPO: un sueldo no "vence", llega.
ok(
  cuandoTexto(pago({ dia: 19, tipo: "ingreso" }), "2026-08", HOY19).clave === "calendario.cuando.hoy.ingreso",
  "un ingreso usa su propio verbo: no vence, llega"
);
ok(
  cuandoTexto(pago({ dia: 19, tipo: "recordatorio" }), "2026-08", HOY19).clave === "calendario.cuando.hoy.recordatorio",
  "y un recordatorio el suyo"
);

// ---------------------------------------------------------------------------
// COMO SE CUENTA LA REPETICION
console.log("\nComo se cuenta que se repite");

ok(textoDeRepeticion(25, true).clave === "calendario.repite.cadaMes", "el 25 se repite el 25");
ok(
  textoDeRepeticion(31, true).clave === "calendario.repite.ultimoDia",
  "el 31 se llama «el ultimo dia», que es lo que es: asi la nota al pie del recorte sobra"
);
ok(textoDeRepeticion(30, true).clave === "calendario.repite.casiUltimo", "el 30 si necesita su aclaracion");
ok(textoDeRepeticion(25, false).clave === "calendario.repite.unaVez", "y sin repetir, se dice que es una sola vez");

// ---------------------------------------------------------------------------
// EL MONTO QUE NO ES UN NUMERO
//
// Escribio "#" en el monto y esas letras llegaron hasta la pantalla de Inicio, entre el
// dinero de verdad. La causa: Number("#") da NaN, y NaN <= 0 es FALSE, asi que la
// comprobacion lo dejaba pasar. Es de los fallos peores que hay en una app de dinero, porque
// no da ningun error: se guarda, se suma, y ensucia los totales.
console.log("\nUn monto que no es un numero");

ok(validarPago("Luz", "pago", Number("#"), 5).ok === false, "un monto NaN NO se guarda");
ok(validarPago("Luz", "pago", NaN, 5).ok === false, "dicho de otra forma: NaN se rechaza");
ok(validarPago("Luz", "pago", Infinity, 5).ok === false, "e infinito tampoco es un monto");
ok(validarPago("Luz", "pago", 90, 5).ok === true, "y un numero de verdad si");

ok(soloMonto("12#") === "12", "el # se cae al escribir");
ok(soloMonto("abc") === "", "y las letras tambien");
ok(soloMonto("12,50") === "12.50", "la coma vale como el punto: en Peru se escribe de las dos formas");
ok(soloMonto("12.5.7") === "12.57", "dos puntos no hacen dos decimales: solo hay una parte decimal");
ok(soloMonto("12.555") === "12.55", "y como mucho dos decimales, que los centimos no tienen tres cifras");
ok(soloMonto("12.") === "12.", "se puede quedar a medias mientras se escribe, sin saltar bajo el dedo");
ok(Number.isFinite(Number(soloMonto("12,50"))), "lo que sale de aqui siempre se puede convertir a numero");

// ---------------------------------------------------------------------------
// EL MOVIMIENTO QUE SE CREA LLEVA CATEGORIA DE VERDAD
//
// "Al agregarle un icono en agregar pago no viaja a las pantallas de inicio e historial".
// Y no podia: en Inicio el dibujo de un movimiento sale de su CATEGORIA, no de un icono
// propio, y todos se creaban en "Otros". El nombre es lo unico que hay para clasificarlo, y
// es lo que se usa -el mismo clasificador que los yapes-.
console.log("\nEl movimiento que se crea al pagar");

const movNetflix = movimientoDelPago(pago({ nombre: "Netflix", monto: 44, dia: 15 }), "2026-08");
ok(movNetflix?.description === "Netflix", "el movimiento se llama como el pago");
ok(
  movNetflix?.description !== "" && movNetflix?.description != null,
  "y nunca llega sin nombre: sin el, el clasificador no tendria por donde empezar"
);

console.log(
  fallos === 0
    ? "\nTodo bien: el calendario cuenta los días y el dinero\n"
    : `\n${fallos} fallas\n`
);
process.exit(fallos === 0 ? 0 : 1);

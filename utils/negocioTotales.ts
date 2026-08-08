// LAS CUENTAS DEL PANEL DEL NEGOCIO (V1, paso 4, 08/08/2026)
//
// POR QUÉ ESTÁN AQUÍ Y NO DENTRO DE LA PANTALLA
//
// Porque son dinero, y el dinero hay que poder comprobarlo con números. Escritas dentro de
// la pantalla, la única forma de saber si el saldo está bien sería abrir la app, registrar
// ventas a mano y leer el resultado. Aquí se les pasan tres ventas y un gasto y se exige un
// número exacto — que es lo que hace una prueba de verdad.
//
// Es la misma razón por la que las cuentas personales viven en utils/finances.ts y no en la
// pantalla de Inicio.
//
// EL DOBLE CONTEO DE LA V1, DICHO AQUÍ ARRIBA PORQUE ES LO ÚNICO RARO DE ESTE ARCHIVO
//
// Una venta cobrada por Yape puede acabar contada DOS veces: una como venta, y otra como
// ingreso automático cuando llegue la captura de Yape al negocio (paso 5). Él lo aceptó
// sabiéndolo —vincular el Yape con su venta es justo lo que se hace en V2— pero el panel
// tiene que **advertirlo en pantalla**, o los números parecerán equivocados.
//
// Aquí no se intenta adivinar cuál Yape corresponde a cuál venta. Adivinarlo es exactamente
// lo que él prohibió para la V1: *"NO quiero que el sistema diga: recibiste S/15, entonces
// vendiste un Broster"*.

import { type MetodoDeVenta, type MovimientoNegocio, type Venta } from "@/utils/negocio";

/**
 * QUÉ TROZO DE TIEMPO SE ESTÁ MIRANDO (V2, 08/08/2026).
 *
 * En la V1 el panel sumaba todo lo registrado desde el primer día, y se decía en la pantalla
 * para que nadie lo tomara por un fallo. Pero un negocio no se lleva así: lo que se pregunta
 * al cerrar es *"¿cuánto hice hoy?"*, y a fin de mes *"¿cuánto hice este mes?"*.
 */
export type PeriodoDelPanel = "hoy" | "mes" | "todo";

/**
 * ¿Esta fecha entra en el trozo que se está mirando?
 *
 * SE COMPARA EL TEXTO DE LA FECHA, no se hacen cuentas con días. Las fechas se guardan
 * "AAAA-MM-DD", así que el mes es comparar los siete primeros caracteres y el día son los
 * diez. Restar días con Date es de donde salen los errores de "el día 1 del mes" y los saltos
 * de hora: aquí no hay nada de eso porque no hay ninguna resta.
 */
export function enElPeriodo(fecha: string, periodo: PeriodoDelPanel, hoy: string): boolean {
  if (periodo === "todo") return true;
  if (periodo === "hoy") return fecha === hoy;
  return fecha.slice(0, 7) === hoy.slice(0, 7);
}

/**
 * Se queda con lo del trozo de tiempo elegido.
 *
 * Sirve igual para ventas y para movimientos porque lo único que mira es su fecha. Filtrar
 * ANTES de sumar —y no dentro de cada cuenta— es lo que hace que el saldo, el número de
 * ventas y el historial no puedan acabar hablando de periodos distintos.
 */
export function filtrarPorPeriodo<T extends { fecha: string }>(
  items: T[],
  periodo: PeriodoDelPanel,
  hoy: string
): T[] {
  if (periodo === "todo") return items;
  return items.filter((i) => enElPeriodo(i.fecha, periodo, hoy));
}

/**
 * Todo lo que enseña el panel, en números.
 *
 * Las cinco líneas que pidió —ventas, ingresos automáticos, gastos, saldo y cuántas ventas—
 * más los ingresos anotados a mano, que existen porque el tipo los admite: un ingreso que
 * está guardado y no sale en ninguna línea es plata que desaparece de la vista sin que nadie
 * pueda explicarlo.
 */
export type TotalesDelNegocio = {
  /** La suma de todas las ventas registradas. */
  ventas: number;
  /** Cuántas ventas son. Es una cuenta, no una suma de dinero. */
  cantidadVentas: number;
  /** Lo que entró por captura automática (los Yapes que se manden al negocio, paso 5). */
  ingresosAutomaticos: number;
  /** Lo que se anotó a mano como entrada de plata. */
  ingresosManuales: number;
  /** Lo que salió: insumos, gas, alquiler… */
  gastos: number;
  /** Ventas + todo lo que entró − lo que salió. */
  saldo: number;
};

/**
 * A céntimos, y en un solo sitio.
 *
 * Sumar decimales en coma flotante da colas: 0.1 + 0.2 son 0.30000000000000004, y ese número
 * acaba impreso en un total. Se redondea al terminar cada suma, no en la pantalla: con dos
 * sitios redondeando, uno de los dos se olvida.
 */
function aCentimos(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Las cuentas de UN negocio.
 *
 * FILTRA POR NEGOCIO AQUÍ DENTRO, aunque la pantalla ya podría pasarle solo los suyos. Es a
 * propósito: si el filtro vive en la pantalla, basta que una pantalla nueva se olvide para
 * que la pollería sume las ventas de la bodega. Filtrando aquí, olvidarse es imposible.
 */
export function totalesDelNegocio(
  negocioId: string,
  ventas: Venta[],
  movimientos: MovimientoNegocio[]
): TotalesDelNegocio {
  const mias = ventas.filter((v) => v.negocioId === negocioId);
  const mios = movimientos.filter((m) => m.negocioId === negocioId);

  const totalVentas = aCentimos(mias.reduce((t, v) => t + v.total, 0));
  const suma = (tipo: "ingreso" | "gasto", origen?: "manual" | "automatico") =>
    aCentimos(
      mios
        .filter((m) => m.tipo === tipo && (origen ? m.origen === origen : true))
        .reduce((t, m) => t + m.monto, 0)
    );

  const ingresosAutomaticos = suma("ingreso", "automatico");
  const ingresosManuales = suma("ingreso", "manual");
  const gastos = suma("gasto");

  return {
    ventas: totalVentas,
    cantidadVentas: mias.length,
    ingresosAutomaticos,
    ingresosManuales,
    gastos,
    // EL SALDO SUMA LAS VENTAS **Y** LOS INGRESOS AUTOMÁTICOS, y ahí está el doble conteo de
    // la V1 explicado arriba. No se resta ni se descuenta nada por si acaso: descontar a ojo
    // sería adivinar qué Yape era de qué venta, que es lo que él prohibió hasta la V2.
    saldo: aCentimos(totalVentas + ingresosAutomaticos + ingresosManuales - gastos),
  };
}

/**
 * Una línea del historial del negocio: una venta o un movimiento, ya listos para pintar.
 *
 * Las dos cosas se mezclan en una sola lista y con la misma forma porque en el mostrador
 * pasan mezcladas: se vende, se compra pollo, se vende. Dos listas separadas obligarían a ir
 * y venir para saber qué pasó en la tarde.
 */
export type FilaDelHistorial = {
  id: string;
  /** Venta, plata que entró o plata que salió. Decide el color y el signo. */
  clase: "venta" | "ingreso" | "gasto";
  /** "AAAA-MM-DD" */
  fecha: string;
  /** "HH:MM", para poder ordenar. Lo que se enseña sale de horaVisible(). */
  hora: string;
  /** "2 × Broster · 1 × Gaseosa", o lo que se escribió en el gasto. */
  detalle: string;
  monto: number;
  metodo: MetodoDeVenta;
  /** Si lo registró la app sola (captura de Yape). Se marca en la fila. */
  automatico: boolean;
};

/**
 * Lo que dice una venta en una línea: "2 × Broster · 1 × Gaseosa".
 *
 * SALE DE LO COPIADO EN LA VENTA, no de la lista de productos de hoy. Si el Broster subió de
 * 15 a 18, o si se borró de la carta, la venta de ayer sigue diciendo lo que se vendió ayer.
 */
function detalleDeVenta(venta: Venta): string {
  return venta.lineas.map((l) => `${l.cantidad} × ${l.nombre}`).join(" · ");
}

/**
 * El historial de un negocio: sus ventas y sus movimientos, lo último arriba.
 *
 * SE ORDENA POR FECHA Y HORA, NO POR CUÁNDO SE GUARDÓ. Una venta que se anota tarde —se
 * cobró a las 7 y se registró a las 9— tiene que caer en su sitio, o el historial deja de
 * poder leerse como el día de trabajo que fue.
 */
export function historialDelNegocio(
  negocioId: string,
  ventas: Venta[],
  movimientos: MovimientoNegocio[]
): FilaDelHistorial[] {
  const filas: FilaDelHistorial[] = [
    ...ventas
      .filter((v) => v.negocioId === negocioId)
      .map((v) => ({
        id: v.id,
        clase: "venta" as const,
        fecha: v.fecha,
        hora: v.hora,
        detalle: detalleDeVenta(v),
        monto: v.total,
        metodo: v.metodo,
        automatico: false,
      })),
    ...movimientos
      .filter((m) => m.negocioId === negocioId)
      .map((m) => ({
        id: m.id,
        clase: m.tipo === "ingreso" ? ("ingreso" as const) : ("gasto" as const),
        fecha: m.fecha,
        hora: m.hora,
        detalle: m.descripcion,
        monto: m.monto,
        metodo: m.metodo,
        automatico: m.origen === "automatico",
      })),
  ];
  // La hora se guarda "HH:MM" con el cero delante justamente para poder comparar los textos
  // tal cual. Con "9:05" el orden sería el del diccionario y las nueve de la mañana caerían
  // después de las siete de la tarde.
  return filas.sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`));
}

/**
 * La hora como se lee en Perú: "19:30" → "7:30 p.m.".
 *
 * SE GUARDA EN 24 HORAS Y SE ENSEÑA EN 12, y las dos mitades hacen falta. En 24 horas los
 * textos se ordenan solos (ver arriba); en 12 es como se dice la hora aquí — "19:30" obliga
 * a hacer la resta mentalmente. Es la misma regla que ya usa horaDe() en utils/format.
 */
export function horaVisible(hhmm: string): string {
  const texto = String(hhmm ?? "");
  const [h, m] = texto.split(":");
  // Si la hora viniera dañada se enseña tal cual en vez de tumbar la pantalla: es un dato ya
  // guardado, así que reventar aquí reventaría en cada arranque.
  //
  // Se comprueba el TEXTO y no el número: Number("") es cero, no es "no es un número", así que
  // una hora vacía habría salido como "12:00 a.m." — un dato inventado con toda la pinta de
  // ser verdad, que es peor que un hueco.
  if (!/^\d{1,2}$/.test(h ?? "") || !/^\d{2}$/.test(m ?? "")) return texto;
  const hora = Number(h);
  const minutos = m;
  if (hora > 23 || Number(minutos) > 59) return texto;
  // Las doce de la noche son las 12 a.m., no las 0 a.m.: nadie dice "0:15 a.m.".
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${h12}:${minutos} ${hora < 12 ? "a.m." : "p.m."}`;
}

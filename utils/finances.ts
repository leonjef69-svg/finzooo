// Las cuentas del mes, en un solo sitio.
//
// POR QUÉ ESTE ARCHIVO EXISTE
//
// El saldo disponible se calculaba dentro de Inicio, en una línea suelta:
//
//     const available = budget + prevBalance + income - spent;
//
// Mientras solo lo enseñara Inicio, daba igual dónde estuviera. Pero en
// cuanto una segunda pantalla enseña "Disponible", esa línea tiene que
// existir UNA sola vez. Copiada en dos sitios, basta con que alguien toque
// una para que Inicio y Reportes muestren dos saldos distintos del mismo mes
// — y no habría forma de saber cuál es el bueno.
//
// Aquí no se inventa ni se estima nada: todo sale de los movimientos y los
// presupuestos que ya están guardados. Las funciones de este archivo no
// tienen acceso a nada más.

export type MonthFigures = {
  /** Presupuesto puesto para ese mes. 0 si no se puso ninguno. */
  budget: number;
  /** Suma de los gastos del mes. */
  spent: number;
  /** Suma de los ingresos del mes. */
  income: number;
  /** Lo que sobró o faltó de todos los meses anteriores. */
  prevBalance: number;
};

/**
 * El saldo disponible: lo mismo que enseña Inicio en grande.
 *
 * Incluye el arrastre de meses anteriores (prevBalance) a propósito, porque
 * es lo que Inicio incluye. Sin él, un mes con arrastre daría dos cifras
 * distintas en dos pantallas de la misma app.
 */
export function availableBalance(f: MonthFigures): number {
  return f.budget + f.prevBalance + f.income - f.spent;
}

/** Qué parte del presupuesto se lleva gastada, de 0 a 1. Sin presupuesto, 0. */
export function budgetUsed(f: MonthFigures): number {
  if (f.budget <= 0) return 0;
  return f.spent / f.budget;
}

/**
 * Lo que queda del presupuesto del mes.
 *
 * Ojo: NO es lo mismo que el disponible. El disponible suma los ingresos y el
 * arrastre; esto mira solo el presupuesto de este mes contra lo gastado este
 * mes. Son dos preguntas distintas —"cuánto tengo" y "cuánto me queda de lo
 * que me propuse gastar"— y mezclarlas fue justo lo que hubo que separar.
 *
 * Puede salir negativo: pasarse del presupuesto es algo que ocurre y hay que
 * poder decirlo.
 */
export function budgetLeft(f: MonthFigures): number {
  if (f.budget <= 0) return 0;
  return f.budget - f.spent;
}

export type Health = "good" | "tight" | "over" | "unknown";

/**
 * Cómo va el mes. Es una lectura de los números, no una opinión.
 *
 * "unknown" cuando no hay presupuesto puesto: sin un objetivo contra el que
 * medir, decir que la salud es buena o mala sería inventarlo. Es preferible
 * no decir nada a decir algo que no se sostiene.
 */
export function health(f: MonthFigures): Health {
  if (f.budget <= 0) return "unknown";
  const used = budgetUsed(f);
  if (used > 1) return "over";
  if (used >= 0.85) return "tight";
  return "good";
}

/**
 * Cuánto cambió una cifra respecto al mes pasado, de 0.15 = +15%.
 *
 * Devuelve null —y no cero, ni un 100%— cuando el mes pasado fue cero. No es
 * un detalle: pasar de 0 a 300 no es "un 100% más", es una comparación que no
 * existe. Enseñar "+100%" ahí sería exactamente el tipo de número inventado
 * que no debe salir en pantalla. Quien llame a esto tiene que estar
 * preparado para no enseñar nada.
 */
export function changeVsPrevious(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

/**
 * Suma por día del mes, para la línea de tendencia.
 *
 * Devuelve una posición por día —del 1 al último— con lo que se movió ese
 * día. Los días sin movimientos valen cero, que es su valor de verdad: no se
 * rellenan ni se suavizan.
 */
export function dailyTotals(
  txs: { date: string; type: "expense" | "income"; amount: number }[],
  monthKey: string,
  type: "expense" | "income",
  daysInMonth: number
): number[] {
  const out = new Array(daysInMonth).fill(0);
  for (const tx of txs) {
    if (tx.type !== type) continue;
    if (!tx.date.startsWith(monthKey)) continue;
    const day = Number(tx.date.slice(8, 10));
    if (!Number.isFinite(day) || day < 1 || day > daysInMonth) continue;
    out[day - 1] += tx.amount;
  }
  return out;
}

/** Totales de un mes cualquiera, sacados de los movimientos guardados. */
export function totalsForMonth(
  txs: { date: string; type: "expense" | "income"; amount: number }[],
  monthKey: string
): { spent: number; income: number } {
  let spent = 0;
  let income = 0;
  for (const tx of txs) {
    if (!tx.date.startsWith(monthKey)) continue;
    if (tx.type === "expense") spent += tx.amount;
    else income += tx.amount;
  }
  return { spent, income };
}

/** "2026-07" → "2026-06". Con el cambio de año incluido. */
export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * El tramo del mes que vale la pena dibujar.
 *
 * POR QUÉ ESTO EXISTE
 *
 * La línea de tendencia cubría los 31 días del mes SIEMPRE. Con los
 * movimientos en los últimos días —que es lo normal a fin de mes, o al
 * empezar a usar la app— salía una raya pegada al suelo durante 29 días y un
 * salto al final. Correcta y muerta: el 95% del ancho para días en los que no
 * pasó nada, y el trozo con información aplastado contra el borde.
 *
 * Es el mismo problema que ya se resolvió en el gráfico de barras diarias
 * dibujando solo los días con gasto. Aquí no se pueden saltar días sueltos
 * —una línea acumulada necesita continuidad— pero sí recortar por los dos
 * extremos:
 *
 *   Por delante: hasta el primer día con movimiento. Lo de antes eran ceros,
 *   y quitarlos no cambia el acumulado ni una unidad.
 *
 *   Por detrás: hasta hoy, en el mes en curso. Los días que aún no han
 *   llegado dibujaban una raya plana que parecía "aquí dejaste de gastar",
 *   cuando en realidad todavía no ha pasado.
 *
 * Lo que queda usa el ancho entero y todo lo que se ve ocurrió de verdad.
 */
export function visibleRange(
  values: number[],
  lastDay: number
): { from: number; to: number } {
  const fin = Math.max(0, Math.min(values.length - 1, lastDay - 1));
  const primero = values.findIndex((v) => v > 0);
  // Sin ningún movimiento no hay nada que recortar: se enseña plano desde el
  // día 1 hasta hoy, que es la verdad.
  if (primero < 0 || primero > fin) return { from: 0, to: fin };
  return { from: primero, to: fin };
}

/** Días que tiene el mes. El día 0 del siguiente es el último de este. */
export function daysInMonthOf(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

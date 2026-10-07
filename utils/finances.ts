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

import { presupuestoDelMes } from "@/utils/presupuestoMensual";
import { saldoAnteriorDe, type MovimientoDelSaldo } from "@/utils/saldoAnterior";

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

export type PersonalMonthFigures = MonthFigures & {
  /** Dinero enviado durante el mes a Familia o Cajas. */
  transfersOut: number;
  /** Dinero devuelto durante el mes desde Familia o Cajas. */
  transfersIn: number;
};

/**
 * Saldo real de Personal, incluyendo el dinero que ahora está en otro espacio.
 *
 * Los envíos internos no son consumo y las devoluciones no son ingresos nuevos,
 * pero ambos sí cambian cuánto dinero queda disponible en Personal. Esta cuenta
 * debe ser única para que Inicio, el contexto y Telegram no diverjan.
 */
export function availablePersonalBalance(f: PersonalMonthFigures): number {
  return availableBalance(f) - f.transfersOut + f.transfersIn;
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
 * Totales reales de Personal para un mes.
 *
 * Una transferencia interna cambia el saldo disponible, pero no es consumo
 * ni dinero nuevo. Mantener las cuatro cifras juntas evita que otra pantalla
 * vuelva a clasificar un envío como gasto o una devolución como ingreso.
 */
export function totalsForMonth(
  txs: {
    date: string;
    type: "expense" | "income";
    amount: number;
    internalTransfer?: unknown;
  }[],
  monthKey: string
): { spent: number; income: number; transfersOut: number; transfersIn: number } {
  let spent = 0;
  let income = 0;
  let transfersOut = 0;
  let transfersIn = 0;
  for (const tx of txs) {
    if (!tx.date.startsWith(monthKey)) continue;
    if (tx.internalTransfer) {
      if (tx.type === "expense") transfersOut += tx.amount;
      else transfersIn += tx.amount;
    } else if (tx.type === "expense") {
      spent += tx.amount;
    } else {
      income += tx.amount;
    }
  }
  return { spent, income, transfersOut, transfersIn };
}

/** Saldo de Personal en el mes de una operación, no en el mes abierto en Inicio. */
export function disponiblePersonalEnFecha(
  fecha: string,
  budgets: Record<string, number>,
  transactions: (MovimientoDelSaldo & { internalTransfer?: unknown })[],
  carryoverCleared: string[]
): number {
  const mes = fecha.slice(0, 7);
  const { spent, income, transfersOut, transfersIn } = totalsForMonth(transactions, mes);
  return availablePersonalBalance({
    budget: presupuestoDelMes(budgets, mes),
    prevBalance: saldoAnteriorDe(mes, budgets, transactions, carryoverCleared),
    spent, income, transfersOut, transfersIn,
  });
}

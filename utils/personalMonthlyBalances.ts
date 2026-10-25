import { availablePersonalBalance, totalsForMonth } from "@/utils/finances";
import { moneyFromUnits, moneyUnits } from "@/utils/moneyPrecision";
import { presupuestoDelMes } from "@/utils/presupuestoMensual";
import type { MovimientoDelSaldo } from "@/utils/saldoAnterior";

/**
 * Calcula la lista de meses con una lectura del historial completo.
 * Cada grupo usa los mismos totales de Personal. El arrastre recorre meses y
 * cortes en orden, incluidos los meses vacíos que cierran la entrada del saldo.
 */
export function personalMonthlyBalances(
  months: readonly string[],
  budgets: Record<string, number>,
  transactions: readonly MovimientoDelSaldo[],
  carryoverCleared: readonly string[],
): Record<string, number> {
  const grouped = new Map(months.map(month => [month, [] as MovimientoDelSaldo[]]));
  const net = new Map<string, bigint>();
  for (const [month, amount] of Object.entries(budgets)) {
    if (/^\d{4}-\d{2}$/.test(month)) net.set(month, moneyUnits(amount || 0));
  }
  for (const transaction of transactions) {
    if (transaction.internalTransfer === "goal") continue;
    const month = transaction.date.slice(0, 7);
    grouped.get(month)?.push(transaction);
    net.set(month, (net.get(month) ?? 0n) + moneyUnits(
      transaction.type === "income" ? transaction.amount : -transaction.amount,
    ));
  }
  const cuts = new Set(carryoverCleared);
  const chronology = [...new Set([...net.keys(), ...carryoverCleared, ...months])].sort();
  const balances: Record<string, number> = {};
  let carried = 0n;
  for (const month of chronology) {
    if (cuts.has(month)) carried = 0n;
    const rows = grouped.get(month);
    if (rows) {
      balances[month] = availablePersonalBalance({
        budget: presupuestoDelMes(budgets, month),
        prevBalance: moneyFromUnits(carried),
        ...totalsForMonth(rows, month),
      });
    }
    carried += net.get(month) ?? 0n;
  }
  return balances;
}

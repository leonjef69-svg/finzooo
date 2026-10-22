import type { Transaction } from "@/types";
import { compactPersonalTransferRows } from "@/utils/linkedTransfers";
import { movementRowsByDay } from "@/utils/movementDates";
import { visiblePersonalMovement } from "@/utils/personalHistory";
import { showInPersonalRecent } from "@/utils/recentMovementFilters";

/** Las filas que Personal realmente enseña: sin registros ocultos ni recibos de metas. */
export function personalMovementRowsByDay(items: readonly Transaction[]) {
  const visible = items.filter(row => showInPersonalRecent(row) && visiblePersonalMovement(row));
  return movementRowsByDay(visible, row => row.date, dayItems => compactPersonalTransferRows(dayItems));
}

/** Cuenta tarjetas visibles por mes, conservando la agrupación diaria de Personal. */
export function personalMonthlyMovementCounts(
  transactions: readonly Transaction[],
  months: readonly string[],
): Record<string, number> {
  const grouped = new Map(months.map(month => [month, [] as Transaction[]]));
  for (const transaction of transactions) {
    const month = transaction.date.slice(0, 7);
    const rows = grouped.get(month);
    if (!rows || !showInPersonalRecent(transaction) || !visiblePersonalMovement(transaction)) continue;
    rows.push(transaction);
  }
  return Object.fromEntries(months.map(month => [month, personalMovementRowsByDay(grouped.get(month) ?? []).length]));
}

import type { Month, Transaction } from "@/types";

export type DailyCalendarTotal = {
  day: number;
  income: number;
  expense: number;
};

/** Agrupa los ingresos y gastos visibles en Reportes sin contar transferencias internas. */
export function dailyCalendarTotals(
  transactions: readonly Pick<Transaction, "date" | "type" | "amount" | "internalTransfer">[],
  month: Month,
): DailyCalendarTotal[] {
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    income: 0,
    expense: 0,
  }));
  const prefix = `${month.y}-${String(month.m + 1).padStart(2, "0")}-`;

  for (const transaction of transactions) {
    if (transaction.internalTransfer || !transaction.date.startsWith(prefix)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) continue;

    const day = Number(transaction.date.slice(8, 10));
    if (day < 1 || day > daysInMonth) continue;

    days[day - 1][transaction.type] += transaction.amount;
  }

  return days;
}

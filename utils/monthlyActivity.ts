import type { Transaction } from "@/types";

export type MonthlyActivityTotals = { income: number; expense: number };

/** Totales reales por mes del año, sin transferencias internas. */
export function monthlyActivityTotals(
  transactions: readonly Pick<Transaction, "date" | "type" | "internalTransfer" | "amount">[],
  year: number,
): MonthlyActivityTotals[] {
  const totals = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));

  for (const transaction of transactions) {
    if (transaction.internalTransfer || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) continue;
    const [transactionYear, month] = transaction.date.split("-").map(Number);
    if (transactionYear !== year || month < 1 || month > 12) continue;

    const total = totals[month - 1];
    if (transaction.type === "income") total.income += transaction.amount;
    else if (transaction.type === "expense") total.expense += transaction.amount;
  }

  return totals;
}

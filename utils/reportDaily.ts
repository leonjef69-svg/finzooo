import { monthKey } from "@/utils/format";
import type { Month, Transaction } from "@/types";

type DailyMovement = Pick<Transaction, "type" | "internalTransfer" | "date" | "amount">;

/** Datos exactos que Reportes entrega al gráfico de gasto diario. */
export function dailySpendBars(
  transactions: readonly DailyMovement[],
  month: Month,
  now = new Date(),
): { bars: { day: number; amount: number }[]; today: number } {
  const mk = monthKey(month.y, month.m);
  const porDia = new Map<number, number>();
  for (const tx of transactions) {
    if (tx.type !== "expense" || tx.internalTransfer || !tx.date.startsWith(mk)) continue;
    const day = Number(tx.date.slice(8, 10));
    porDia.set(day, (porDia.get(day) ?? 0) + tx.amount);
  }
  const bars = [...porDia.entries()]
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => a.day - b.day);
  const isCurrentMonth = month.y === now.getFullYear() && month.m === now.getMonth();
  return { bars, today: isCurrentMonth ? now.getDate() : 0 };
}

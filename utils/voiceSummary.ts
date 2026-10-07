import type { Transaction } from "@/types";

type SummaryMovement = Pick<Transaction, "date" | "amount" | "type" | "category" | "internalTransfer">;

/** El resumen exacto que Voz muestra para un día o un mes. */
export function voiceSummary<T extends SummaryMovement>(
  transactions: readonly T[],
  summaryMk: string,
  summaryDay: number,
  summaryFocus: "expense" | "income" | "all",
  summaryCategory: string,
  monthNames: readonly string[],
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const prefix = summaryDay > 0 ? `${summaryMk}-${String(summaryDay).padStart(2, "0")}` : summaryMk;
  const monthTx = transactions.filter((tx) => tx.date.startsWith(prefix));
  const wantsIncome = summaryFocus === "income";
  const all = monthTx.filter((tx) => !tx.internalTransfer && (wantsIncome ? tx.type === "income" : tx.type === "expense"));
  const other = monthTx.filter((tx) => !tx.internalTransfer && (wantsIncome ? tx.type === "expense" : tx.type === "income"));
  const main = summaryCategory ? all.filter((tx) => tx.category === summaryCategory) : all;
  const byCategory = new Map<string, number>();
  for (const tx of main) byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
  const [y, m] = summaryMk.split("-").map(Number);

  return {
    label: summaryDay > 0
      ? t("voice.summaryDayLabel", { day: summaryDay, month: monthNames[m - 1], year: y })
      : `${monthNames[m - 1]} ${y}`,
    isIncome: wantsIncome,
    isDay: summaryDay > 0,
    category: summaryCategory,
    emptyKey: summaryCategory
      ? summaryDay > 0
        ? "voice.summaryEmptyCategoryDay"
        : "voice.summaryEmptyCategory"
      : summaryDay > 0
        ? wantsIncome
          ? "voice.summaryEmptyIncomeDay"
          : "voice.summaryEmptyDay"
        : wantsIncome
          ? "voice.summaryEmptyIncome"
          : "voice.summaryEmpty",
    total: main.reduce((s, tx) => s + tx.amount, 0),
    otherTotal: other.reduce((s, tx) => s + tx.amount, 0),
    count: main.length,
    top: Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4),
    items: [...main].sort((a, b) => b.amount - a.amount).slice(0, summaryDay > 0 ? 10 : 6),
  };
}

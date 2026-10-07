import type { Transaction } from "@/types";

type VoiceMovement = Pick<Transaction, "type" | "internalTransfer" | "date" | "amount">;
type MonthTotals = { expense: number; income: number };

/** Lo que salió y lo que entró en cada mes con movimientos normales. */
export function voiceMonthlyTotals(transactions: readonly VoiceMovement[]): Map<string, MonthTotals> {
  const map = new Map<string, MonthTotals>();
  for (const tx of transactions) {
    if (tx.internalTransfer) continue;
    const key = tx.date.slice(0, 7);
    const acc = map.get(key) ?? { expense: 0, income: 0 };
    if (tx.type === "income") acc.income += tx.amount;
    else acc.expense += tx.amount;
    map.set(key, acc);
  }
  return map;
}

/** Respuesta a "¿en qué mes gasté/recibí más o menos?". */
export function voiceTopMonth(
  totals: ReadonlyMap<string, MonthTotals>,
  focus: "expense" | "income",
  direction: "most" | "least",
) {
  const lista = [...totals.entries()]
    .map(([key, t]) => ({ key, value: focus === "income" ? t.income : t.expense }))
    .filter((m) => m.value > 0)
    .sort((a, b) => (direction === "least" ? a.value - b.value : b.value - a.value));

  if (lista.length === 0) return { empty: true, winner: null, others: [], max: 0 };
  return {
    empty: false,
    winner: lista[0],
    others: lista.slice(1, 6),
    max: Math.max(...lista.map((m) => m.value)),
  };
}

/** Respuesta a "compara junio con mayo". Sin foco explícito, compara gastos. */
export function voiceCompareMonths(
  totals: ReadonlyMap<string, MonthTotals>,
  months: readonly [string, string],
  focus: "expense" | "income" | "all",
) {
  const vacio = { expense: 0, income: 0 };
  const a = { key: months[0], ...(totals.get(months[0]) ?? vacio) };
  const b = { key: months[1], ...(totals.get(months[1]) ?? vacio) };
  const porIngresos = focus === "income";
  const va = porIngresos ? a.income : a.expense;
  const vb = porIngresos ? b.income : b.expense;
  const diff = va - vb;
  const mayor = Math.max(va, vb);
  const casiIgual = mayor === 0 || Math.abs(diff) / mayor < 0.05;
  return {
    a,
    b,
    empty: a.expense + a.income + b.expense + b.income === 0,
    casiIgual,
    diff: Math.abs(diff),
    mesConMas: diff >= 0 ? a.key : b.key,
    subeLaFrase: diff >= 0,
    porIngresos,
  };
}

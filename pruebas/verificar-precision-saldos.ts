import assert from "node:assert/strict";
import { availablePersonalBalance, totalsForMonth } from "@/utils/finances";
import { saldoAnteriorDe } from "@/utils/saldoAnterior";

const movements = [
  { date: "2026-10-01", type: "expense" as const, amount: 9_000_000_000_000 },
  ...Array.from({ length: 44 }, (_, i) => ({
    date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
    type: "expense" as const,
    amount: 50.15,
  })),
  ...Array.from({ length: 45 }, (_, i) => ({
    date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
    type: "income" as const,
    amount: 30.45,
  })),
  { date: "2026-10-14", type: "expense" as const, amount: 2.15, internalTransfer: true },
  { date: "2026-10-14", type: "income" as const, amount: 0.1, internalTransfer: true },
];
const carry = saldoAnteriorDe("2026-10", { "2026-09": 310.25 }, [], []);
const totals = totalsForMonth(movements, "2026-10");
const available = availablePersonalBalance({
  budget: 1_999_202_020.75,
  prevBalance: carry,
  ...totals,
});
const twoDecimals = (amount: number) => Number(amount.toFixed(2));

assert.equal(carry, 310.25, "el arrastre conserva sus céntimos");
assert.equal(twoDecimals(totals.spent), 9_000_000_002_206.6, "Inicio suma los gastos sin perder céntimos");
assert.equal(twoDecimals(totals.income), 1_370.25, "Inicio suma los ingresos sin perder céntimos");
assert.equal(twoDecimals(totals.transfersOut), 2.15, "las salidas a otros espacios conservan sus céntimos");
assert.equal(twoDecimals(totals.transfersIn), 0.1, "las devoluciones conservan sus céntimos");
assert.equal(twoDecimals(available), -8_998_000_798_507.4, "el saldo disponible une presupuesto, arrastre y transferencias una sola vez");

console.log("Saldos, arrastre y transferencias conservan los céntimos en común.");

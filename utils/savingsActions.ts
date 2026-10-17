import type { Goal, Transaction } from "@/types";
import { goalWithFundingChange } from "@/utils/goalFunding";
import { identityForExplicitEdit } from "@/utils/recordOrigin";
import { metaConEstadoActual, totalApartado } from "@/utils/ahorro";
import { isSafeMoneyAmount } from "@/utils/amount";
import { moneyFromUnits, moneyUnits } from "@/utils/moneyPrecision";

export type SavingsAction =
  | { kind: "create" | "edit"; goal: Goal; initial?: number; saved?: number; expectedSaved?: number }
  | { kind: "add" | "withdraw"; goalId: number; amount: number }
  | { kind: "delete"; goalId: number }
  | { kind: "use"; goalId: number; transaction: Transaction }
  | { kind: "expense"; transaction: Transaction; allocations: { goalId: number; amount: number }[] };
export function isSavingsMovement(row: Pick<Transaction, "internalTransfer">): boolean { return row.internalTransfer === "goal"; }
export type PersonalMovementFilter = "all" | "expense" | "income" | "transfer" | "savings";
export function matchesPersonalMovementFilter(row: Transaction, filter: PersonalMovementFilter): boolean {
  if (filter === "all") return true;
  if (filter === "savings") return isSavingsMovement(row) || Boolean(row.goalFundingAllocations?.length);
  if (filter === "transfer") return Boolean(row.internalTransfer) && !isSavingsMovement(row);
  return !row.internalTransfer && row.type === filter;
}
export function expenseSavingsNeeded(amount: number, total: number, goals: Goal[]): number {
  const free = moneyUnits(total) - moneyUnits(totalApartado(goals));
  const missing = moneyUnits(amount) - (free > 0n ? free : 0n);
  return moneyFromUnits(missing > 0n ? missing : 0n);
}
const fail = () => { throw new Error("savings-invalid-action"); };
const validAmount = (amount: number) => isSafeMoneyAmount(amount) && amount > 0;

/** Un plan para el lote local: no escribe ni modifica sus fuentes.
 * Los recibos se conservan aunque se elimine una meta. No crean efectivo,
 * gastos, ingresos ni una segunda reserva en los cálculos de saldo. */
export function prepareSavingsAction(goals: Goal[], action: SavingsAction, personalTotal: number,
  movement: (goal: Goal, delta: number) => Transaction) {
  let next = goals.map(goal => ({ ...goal }));
  if (!Number.isFinite(personalTotal)) return fail();
  if ((action.kind === "create" || action.kind === "edit") && action.initial !== undefined
    && (!isSafeMoneyAmount(action.initial) || action.initial < 0)) return fail();
  const upserts: Transaction[] = [], removed: Goal[] = [];
  const change = (id: number, delta: number, visibleReceipt = true) => {
    const goal = next.find(item => item.id === id);
    if (!goal || !validAmount(Math.abs(delta))) return fail();
    const cap = delta > 0 ? personalTotal - totalApartado(next) : goal.saved;
    if (moneyUnits(Math.abs(delta)) > moneyUnits(Math.max(0, cap))) return fail();
    const row = movement(goal, delta);
    if (!isSavingsMovement(row) || !row.creationId || !row.internalTransferLink
      || row.internalTransferSpaceId !== String(id) || row.amount !== Math.abs(delta)
      || row.type !== (delta > 0 ? "expense" : "income")) return fail();
    const updated = goalWithFundingChange(goal, delta, row.internalTransferLink);
    next = next.map(item => item.id === id ? updated : item);
    if (visibleReceipt) upserts.push(row);
    return { goalId: id, name: goal.name, amount: Math.abs(delta), operationId: row.internalTransferLink };
  };
  if (action.kind === "create" || action.kind === "edit") {
    const source = action.goal, existing = next.find(goal => goal.id === source.id);
    if (!source.name.trim() || !validAmount(source.target) || (action.kind === "create" ? Boolean(existing) : !existing)) return fail();
    if (existing) {
      const updated = metaConEstadoActual(identityForExplicitEdit(existing, { ...existing, name: source.name.trim(), target: source.target }));
      next = next.map(goal => goal.id === source.id ? updated : goal);
      if (action.saved !== undefined) {
        if (!isSafeMoneyAmount(action.saved) || action.saved < 0 || action.expectedSaved !== existing.saved) return fail();
        const delta = moneyFromUnits(moneyUnits(action.saved) - moneyUnits(existing.saved));
        if (delta) change(source.id, delta);
      }
    } else {
      if (!source.creationId) return fail();
      next.unshift(metaConEstadoActual({ ...source, name: source.name.trim(), saved: 0, funding: { format: 1, base: 0, changes: {} } }));
      if (action.initial) change(source.id, action.initial);
    }
  } else if (action.kind === "add" || action.kind === "withdraw") {
    if (!validAmount(action.amount)) return fail();
    change(action.goalId, action.kind === "add" ? action.amount : -action.amount);
  } else if (action.kind === "delete") {
    const goal = next.find(item => item.id === action.goalId); if (!goal) return fail();
    if (goal.saved > 0) change(goal.id, -goal.saved);
    // La lápida se basa en el original vigente, no en una edición que ya no
    // se guardará. El retiro final sí queda en el historial de Personal.
    removed.push(goals.find(item => item.id === goal.id)!);
    next = next.filter(item => item.id !== goal.id);
  } else if (action.kind === "expense" || action.kind === "use") {
    const expense = action.transaction;
    const allocations = action.kind === "use" ? [{ goalId: action.goalId, amount: expense.amount }] : action.allocations;
    if (expense.type !== "expense" || expense.internalTransfer || !validAmount(expense.amount)
      || new Set(allocations.map(item => item.goalId)).size !== allocations.length) return fail();
    if (allocations.some(item => !validAmount(item.amount))) return fail();
    const needed = action.kind === "use" ? expense.amount : expenseSavingsNeeded(expense.amount, personalTotal, next);
    const released = allocations.reduce((sum, item) => sum + moneyUnits(item.amount), 0n);
    if (released !== moneyUnits(needed)) return fail();
    const funding = allocations.map(item => change(item.goalId, -item.amount, false));
    upserts.push({ ...expense, goalFundingAllocations: funding });
  }
  return { goals: next, upserts, removed, reserved: moneyFromUnits(next.reduce((sum, goal) => sum + moneyUnits(goal.saved), 0n)) };
}

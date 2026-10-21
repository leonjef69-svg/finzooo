import type { Goal } from "@/types";
import { identityForExplicitEdit } from "@/utils/recordOrigin";

export type GoalFundingChangeType = "contribution" | "return" | "expense";
type FundingLedger = { format: 1; base: number; changes: Record<string, number>; changeTypes: Record<string, GoalFundingChangeType>; cancelledExpenses: Record<string, true> };

const failure = () => new Error("record-origin-conflict");
function units(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw failure();
  const result = Math.round(value * 1000);
  if (!Number.isSafeInteger(result) || Math.abs(result / 1000 - value) > 0.0000001) throw failure();
  return result;
}
function ledger(goal: Goal): FundingLedger {
  if (units(goal.saved) < 0) throw failure();
  if (goal.funding === undefined) return { format: 1, base: goal.saved, changes: {}, changeTypes: {}, cancelledExpenses: {} };
  const source = goal.funding;
  if (!source || source.format !== 1 || !source.changes || typeof source.changes !== "object" || Array.isArray(source.changes)
    || units(source.base) < 0) throw failure();
  const changes = { ...source.changes };
  for (const [id, delta] of Object.entries(changes)) if (!id || units(delta) === 0) throw failure();
  const changeTypes = source.changeTypes ?? {};
  if (!changeTypes || typeof changeTypes !== "object" || Array.isArray(changeTypes)) throw failure();
  for (const [id, type] of Object.entries(changeTypes)) {
    const delta = changes[id];
    if (!(id in changes) || !["contribution", "return", "expense"].includes(type)
      || type === "contribution" && delta <= 0 || type !== "contribution" && delta >= 0) throw failure();
  }
  const cancelledExpenses = source.cancelledExpenses ?? {};
  if (!cancelledExpenses || typeof cancelledExpenses !== "object" || Array.isArray(cancelledExpenses)) throw failure();
  for (const [id, cancelled] of Object.entries(cancelledExpenses)) {
    if (cancelled !== true || !(id in changes) || changes[id] >= 0 || changeTypes[id] && changeTypes[id] !== "expense") throw failure();
  }
  const next = { format: 1 as const, base: source.base, changes, changeTypes: { ...changeTypes }, cancelledExpenses: { ...cancelledExpenses } };
  if (units(total(next)) !== units(goal.saved)) throw failure();
  return next;
}

export function assertGoalFunding(goal: Goal): void { if (goal.funding !== undefined) ledger(goal); }
function total(source: NonNullable<Goal["funding"]>): number {
  let value = units(source.base);
  for (const delta of Object.values(source.changes)) {
    value += units(delta);
    if (!Number.isSafeInteger(value)) throw failure();
  }
  // Dos retiros simultáneos no inventan saldo cero ni escogen uno a ciegas.
  if (value < 0) throw failure();
  return value / 1000;
}

/** Operación intencional sobre la meta vigente, no una inferencia al leer. */
export function goalWithFundingChange(goal: Goal, delta: number, operationId: string,
  changeType: GoalFundingChangeType = delta > 0 ? "contribution" : "return"): Goal {
  if (!operationId || typeof operationId !== "string" || !units(delta)) throw failure();
  const previous = ledger(goal);
  if (operationId in previous.changes) throw failure();
  const funding: FundingLedger = { ...previous, changes: { ...previous.changes, [operationId]: delta } };
  funding.changeTypes[operationId] = changeType;
  const saved = total(funding);
  return identityForExplicitEdit(goal, { ...goal, funding, saved, completed: saved >= goal.target });
}

/** Anular una compra libera su importe a Personal; no es otro aporte ni cambia saved. */
export function goalWithCancelledExpense(goal: Goal, operationId: string, amount: number): Goal {
  const funding = ledger(goal);
  if (!operationId || units(amount) <= 0 || !(operationId in funding.changes)
    || units(funding.changes[operationId]) !== -units(amount)
    || funding.changeTypes[operationId] && funding.changeTypes[operationId] !== "expense") throw failure();
  if (funding.cancelledExpenses[operationId]) return goal;
  funding.changeTypes[operationId] = "expense";
  funding.cancelledExpenses[operationId] = true;
  return identityForExplicitEdit(goal, { ...goal, funding });
}

/** Suma operaciones distintas y reconoce la misma operación en dos copias.
 * Una cifra antigua diferente no dice qué operaciones faltan: se conserva
 * la fuente interrumpiendo la unión, sin sumarla dos veces ni sobrescribirla. */
export function mergeGoalFunding(local: Goal, remote: Goal): Goal {
  if (!local.funding && !remote.funding) {
    if (units(local.saved) !== units(remote.saved)) throw failure();
    return local;
  }
  const a = ledger(local), b = ledger(remote);
  if (units(a.base) !== units(b.base)) throw failure();
  const changes = { ...b.changes };
  for (const [id, delta] of Object.entries(a.changes)) {
    if (id in changes && units(changes[id]) !== units(delta)) throw failure();
    changes[id] = delta;
  }
  const changeTypes = { ...b.changeTypes };
  for (const [id, type] of Object.entries(a.changeTypes)) {
    if (id in changeTypes && changeTypes[id] !== type) throw failure();
    changeTypes[id] = type;
  }
  const funding = { format: 1 as const, base: a.base, changes, changeTypes,
    cancelledExpenses: { ...b.cancelledExpenses, ...a.cancelledExpenses } };
  const saved = total(funding);
  return { ...local, funding, saved, completed: saved >= local.target };
}

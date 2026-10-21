import type { Goal, Transaction } from "@/types";
import { moneyFromUnits, moneyUnits } from "@/utils/moneyPrecision";

export type GoalFundingSummary = { received: number; returned: number };

type Totals = { received: bigint; returned: bigint; receiptOperations: Set<string>; hasReceipts: boolean };

/** Resumen de las operaciones ya guardadas, sin crear movimientos financieros. */
export function summarizeGoalFunding(goals: readonly Goal[], transactions: readonly Transaction[]): Map<number, GoalFundingSummary> {
  const totals = new Map<number, Totals>();
  const expenseOperations = new Map<number, Set<string>>();
  for (const goal of goals) totals.set(goal.id, { received: 0n, returned: 0n, receiptOperations: new Set(), hasReceipts: false });

  for (const transaction of transactions) {
    if (transaction.internalTransfer === "goal") {
      const goalId = Number(transaction.internalTransferSpaceId);
      const current = totals.get(goalId);
      if (current && Number.isFinite(transaction.amount) && transaction.amount > 0) {
        const units = moneyUnits(transaction.amount);
        if (transaction.type === "expense") current.received += units;
        else current.returned += units;
        current.hasReceipts = true;
        if (transaction.internalTransferLink) current.receiptOperations.add(transaction.internalTransferLink);
      }
    }
    for (const allocation of transaction.goalFundingAllocations ?? []) {
      if (!allocation.operationId || !totals.has(allocation.goalId)) continue;
      const operations = expenseOperations.get(allocation.goalId) ?? new Set<string>();
      operations.add(allocation.operationId);
      expenseOperations.set(allocation.goalId, operations);
    }
  }

  const result = new Map<number, GoalFundingSummary>();
  for (const goal of goals) {
    const current = totals.get(goal.id)!;
    const funding = goal.funding;
    if (funding) {
      // El saldo anterior a la libreta de operaciones es el único dato que queda
      // para metas antiguas sin recibos de Personal.
      if (!current.hasReceipts) current.received += moneyUnits(funding.base);
      const spentOperations = expenseOperations.get(goal.id) ?? new Set<string>();
      for (const [operationId, delta] of Object.entries(funding.changes)) {
        if (current.receiptOperations.has(operationId)) continue;
        const units = moneyUnits(Math.abs(delta));
        if (delta > 0) current.received += units;
        else if (funding.cancelledExpenses?.[operationId] === true && !spentOperations.has(operationId) || funding.changeTypes?.[operationId] === "return" ||
          (!funding.changeTypes?.[operationId] && !spentOperations.has(operationId))) current.returned += units;
      }
    } else if (!current.hasReceipts) {
      // Antes de guardar el detalle de operaciones solo existía el saldo actual.
      current.received = moneyUnits(goal.saved);
    }
    result.set(goal.id, { received: moneyFromUnits(current.received), returned: moneyFromUnits(current.returned) });
  }
  return result;
}

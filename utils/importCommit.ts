import type { Transaction } from "@/types";
import { assertNoIdentifiedDeletionOverlap, assertSameTransactionOrigin } from "@/utils/mergeTransactions";

/** Preparar el lote completo antes de cambiar la lista: un conflicto no
 * guarda solo algunos movimientos ni vuelve a crear un movimiento borrado. */
export function applyImportedTransactions(
  current: Transaction[],
  toAdd: Transaction[],
  toReplace: Transaction[],
  deletedIds: number[],
  now = Date.now(),
): { transactions: Transaction[]; count: number } {
  assertNoIdentifiedDeletionOverlap([...toAdd, ...toReplace], deletedIds);
  const deleted = new Set(deletedIds);
  const known = new Map(current.map(tx => [tx.id, tx]));
  const replacements = new Map<number, Transaction>();
  for (const replacement of toReplace) {
    const existing = known.get(replacement.id);
    if (existing) assertSameTransactionOrigin(existing, replacement);
    if (!existing || deleted.has(replacement.id) || existing.internalTransfer ||
      (existing.updatedAt ?? 0) > (replacement.updatedAt ?? 0)) {
      throw new Error("import-source-changed");
    }
    replacements.set(replacement.id, {
      ...replacement,
      updatedAt: Math.max(now, (existing.updatedAt ?? 0) + 1),
    });
  }
  const added: Transaction[] = [];
  for (const tx of toAdd) {
    const existing = known.get(tx.id);
    if (existing) assertSameTransactionOrigin(existing, tx);
    if (known.has(tx.id) || deleted.has(tx.id)) continue;
    known.set(tx.id, tx);
    added.push({ ...tx, updatedAt: Math.max(now, tx.updatedAt ?? 0) });
  }
  const count = added.length + replacements.size;
  return {
    transactions: count === 0 ? current : [...added, ...current.map(tx => replacements.get(tx.id) ?? tx)],
    count,
  };
}

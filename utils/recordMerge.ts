import type { Goal, Transaction } from "@/types";
import { assertSameCreation, assertSameTransactionOrigin, mergeGoals, mergeTransactions } from "@/utils/mergeTransactions";
import { recordOriginOf, sameLegacyContents, identityForExplicitEdit } from "@/utils/recordOrigin";
import { reconcileRecordCopies, rememberDeletion, rememberRestoration, rememberRebinding, mutationInfo, metadataForRecord, metadataByRecord, mergeMutationMetadata, mutationKey } from "../functions/src/record-mutations-shared.js";

export function assertSameGoalOrigin(a: Goal, b: Goal): void {
  assertSameCreation(a, b);
  if (!a.creationId && !b.creationId && !sameLegacyContents(a, b)) throw new Error("record-origin-conflict");
}
export function mergeTransactionCopies(local: Transaction[], remote: Transaction[], localDeleted: number[] = [], remoteDeleted: number[] = [],
  localMeta: Record<string, number> = {}, remoteMeta: Record<string, number> = {}) {
  const ordinary = (rows: Transaction[]) => rows.filter(row => row.method !== "credit-card-payment");
  const cards = (rows: Transaction[]) => rows.filter(row => row.method === "credit-card-payment");
  const result = reconcileRecordCopies(ordinary(local), ordinary(remote), localDeleted, remoteDeleted, localMeta, remoteMeta,
    "transaction", recordOriginOf, assertSameTransactionOrigin, mergeTransactions);
  const deleted = new Set(result.deletedIds);
  return { transactions: mergeTransactions(result.records, mergeTransactions(cards(local), cards(remote)).filter(row => !deleted.has(row.id))),
    deletedIds: result.deletedIds, metadata: result.metadata };
}
export function mergeGoalCopies(local: Goal[], remote: Goal[], localDeleted: number[] = [], remoteDeleted: number[] = [],
  localMeta: Record<string, number> = {}, remoteMeta: Record<string, number> = {}) {
  const result = reconcileRecordCopies(local, remote, localDeleted, remoteDeleted, localMeta, remoteMeta, "goal", recordOriginOf, assertSameGoalOrigin, mergeGoals);
  return { goals: result.records, deletedIds: result.deletedIds, metadata: result.metadata };
}
export function rememberTransactionDeletion(metadata: Record<string, number>, rows: Transaction[]) {
  return rememberDeletion(metadata, "transaction", rows.filter(row => row.method !== "credit-card-payment"), recordOriginOf);
}
export function restoreKnownTransaction(metadata: Record<string, number>, record: Transaction, nonce: string) {
  const state = mutationInfo(metadata, "transaction").get(record.id);
  if (!state) throw new Error("record-origin-conflict");
  // Un UUID guardado puede reconstruirse, pero solo con el mismo vínculo
  // inmutable. Nunca se adjudica un aporte a un movimiento ordinario eliminado.
  let candidate = record;
  if (!record.creationId && state.origin.startsWith("creation:")) {
    const boundary = state.origin.lastIndexOf(":");
    const creationId = state.origin.slice("creation:".length, boundary);
    if (!creationId || !/^[a-f0-9]{64}$/.test(state.origin.slice(boundary + 1))) throw new Error("record-origin-conflict");
    candidate = { ...record, creationId };
  }
  return rememberRestoration(metadata, "transaction", candidate, recordOriginOf, nonce);
}
/** Solo después de validar la conversión y ambas mitades del aporte. No es
 * una operación de edición/importación ni adjudica referencias por número. */
export function rebindVerifiedTransaction(metadata: Record<string, number>, before: Transaction, after: Transaction, nonce: string) {
  const next = identityForExplicitEdit(before, after);
  return rememberRebinding(metadata, "transaction", before, next, recordOriginOf, assertSameCreation, nonce);
}
/** Prepara un lote completo; no modifica las fuentes ni adjudica marcas antiguas. */
export function prepareTransactionMutation(rows: Transaction[], deleted: number[], metadata: Record<string, number>,
  upserts: Transaction[], deleteIds: number[], nonce: () => string, creationForNew: (id: number) => string | undefined,
  allowVerifiedRebinding: boolean | ((before: Transaction, after: Transaction) => boolean) = false) {
  const remove = new Set(deleteIds), replacements = new Map<number, Transaction>();
  if (remove.size !== deleteIds.length || new Set(upserts.map(row => row.id)).size !== upserts.length
    || upserts.some(row => remove.has(row.id))) throw new Error("record-origin-conflict");
  const source = mergeTransactionCopies(rows, [], deleted, [], metadata, {});
  let nextMeta = rememberTransactionDeletion(source.metadata, source.transactions.filter(row => remove.has(row.id)));
  const known = new Map(source.transactions.map(row => [row.id, row]));
  const marked = new Set(source.deletedIds);
  for (const candidate of upserts) {
    const prior = known.get(candidate.id);
    let next = candidate;
    if (prior) {
      if (prior.internalTransferSettled && !candidate.internalTransferSettled) next = prior;
      else {
        next = identityForExplicitEdit(prior, { ...prior, ...candidate });
        const verified = typeof allowVerifiedRebinding === "function" ? allowVerifiedRebinding(prior, next) : allowVerifiedRebinding;
        if (recordOriginOf(prior) !== recordOriginOf(next) && verified) {
          const rebound = rebindVerifiedTransaction(nextMeta, prior, next, nonce());
          next = rebound.record; nextMeta = rebound.metadata;
        } else assertSameTransactionOrigin(prior, next);
      }
    } else if (marked.has(candidate.id)) {
      const restored = restoreKnownTransaction(nextMeta, candidate, nonce());
      next = restored.record; nextMeta = restored.metadata;
    } else {
      const creationId = candidate.creationId ?? creationForNew(candidate.id);
      next = { ...candidate, ...(creationId ? { creationId } : {}) };
    }
    replacements.set(next.id, { ...next, updatedAt: Math.max(Date.now(), (prior?.updatedAt ?? 0) + 1, next.updatedAt ?? 0) });
  }
  const nextRows = [...source.transactions.filter(row => !remove.has(row.id)).map(row => replacements.get(row.id) ?? row),
    ...[...replacements.values()].filter(row => !known.has(row.id))];
  const nextDeleted = [...new Set([...source.deletedIds.filter(id => !replacements.has(id)), ...deleteIds])];
  return mergeTransactionCopies(nextRows, [], nextDeleted, [], nextMeta, {});
}
export { rememberDeletion, mutationInfo, metadataForRecord, metadataByRecord, mergeMutationMetadata, mutationKey };

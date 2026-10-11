"use strict";

const { compatibleRecordCreation, canAnchorLegacy, legacyCanonical, recordOriginOf, recordDeletionIdentity } = require("./record-origin");
const { reconcileRecordCopies, mutationInfo, mutationKey, metadataForRecord, metadataByRecord, mergeMutationMetadata } = require("./record-mutations-shared");

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function assertSameOrigin(a, b) {
  if (!compatibleRecordCreation(a, b)
    || (a.captureId || "") !== (b.captureId || "")
    || (a.internalTransferLink || b.internalTransferLink) && ((a.internalTransferLink || "") !== (b.internalTransferLink || "")
      || (a.internalTransfer || "") !== (b.internalTransfer || "") || (a.internalTransferSpaceId || "") !== (b.internalTransferSpaceId || ""))
    || canAnchorLegacy(a) && canAnchorLegacy(b) && legacyCanonical(a) !== legacyCanonical(b)) throw new Error("HISTORY_ORIGIN_CONFLICT");
}
function assertRecordFormat(data) {
  if (data?.recordIdentityFormat !== undefined && ![1, 2].includes(data.recordIdentityFormat)) throw new Error("HISTORY_FORMAT_UNSUPPORTED");
  if (!data || !Number.isSafeInteger(data.id) || typeof data.deleted !== "boolean"
    || data.deleted === false && (!data.transaction || data.transaction.id !== data.id)
    || data.origin !== undefined && (data.deleted !== true || typeof data.origin !== "string" || !data.origin)) throw new Error("HISTORY_ORIGIN_CONFLICT");
}
function historyLists(entries) {
  const transactions = [], deletedIds = [], syncUpdatedAt = {};
  for (const entry of entries) {
    assertRecordFormat(entry);
    let metadata = entry.mutationMeta || {};
    if (Object.keys(metadataForRecord(metadata, "transaction", entry.id)).length !== Object.keys(metadata).length) throw new Error("HISTORY_ORIGIN_CONFLICT");
    const state = mutationInfo(metadata, "transaction").get(entry.id);
    if (entry.recordIdentity && (!entry.deleted || typeof entry.recordIdentity !== "object" || Array.isArray(entry.recordIdentity)
      || Object.keys(entry.recordIdentity).some(key => !["creationId", "captureId", "internalTransferLink", "internalTransfer", "internalTransferSpaceId", "restorationId", "restorationParent"].includes(key))
      || Object.values(entry.recordIdentity).some(value => typeof value !== "string")
      || !entry.origin || recordOriginOf({ id: entry.id, ...entry.recordIdentity }) !== entry.origin
      || state && (entry.recordIdentity.restorationId || "") !== state.generation)) throw new Error("HISTORY_ORIGIN_CONFLICT");
    if (entry.deleted && state && (!state.deleted || entry.origin !== undefined && state.origin !== entry.origin)) throw new Error("HISTORY_ORIGIN_CONFLICT");
    if (entry.deleted && entry.origin && !state) metadata = { ...metadata, [mutationKey("transaction", "delete", entry.id, entry.origin, "")]: 0 };
    for (const [key, value] of Object.entries(metadata)) syncUpdatedAt[key] = Math.max(syncUpdatedAt[key] || 0, value);
    if (entry.deleted) deletedIds.push(entry.id); else transactions.push(entry.transaction);
  }
  return { transactions, deletedIds, syncUpdatedAt: mergeMutationMetadata(syncUpdatedAt) };
}
function entriesForCopies(a, b = { transactions: [], deletedIds: [], syncUpdatedAt: {} }) {
  let result;
  try {
    result = reconcileRecordCopies(a.transactions, b.transactions, a.deletedIds, b.deletedIds, a.syncUpdatedAt || {}, b.syncUpdatedAt || {},
      "transaction", recordOriginOf, assertSameOrigin, (local, remote) => {
        const records = new Map();
        for (const record of [...local, ...remote]) {
          const previous = records.get(record.id);
          if (previous) {
            assertSameOrigin(previous, record);
            if ((previous.updatedAt || 0) === (record.updatedAt || 0) && canonical(previous) !== canonical(record)) throw new Error("HISTORY_EDIT_CONFLICT");
          }
          if (!previous || (record.updatedAt || 0) > (previous.updatedAt || 0)) records.set(record.id, record);
        }
        return [...records.values()];
      });
  } catch (error) {
    if (error.message === "record-origin-conflict") throw new Error("HISTORY_ORIGIN_CONFLICT");
    throw error;
  }
  const info = mutationInfo(result.metadata, "transaction"), groups = metadataByRecord(result.metadata, "transaction");
  const rows = result.records.map(transaction => ({ id: transaction.id, deleted: false, transaction,
    ...(info.has(transaction.id) ? { mutationMeta: groups.get(transaction.id) } : {}) }));
  rows.push(...result.deletedIds.map(id => ({ id, deleted: true,
    ...(info.has(id) ? { origin: info.get(id).origin, mutationMeta: groups.get(id) } : {}) })));
  return rows.sort((a, b) => a.id - b.id);
}
function rootEntries(data) {
  if (data.recordIdentityFormat !== undefined && ![1, 2].includes(data.recordIdentityFormat)) throw new Error("HISTORY_FORMAT_UNSUPPORTED");
  return entriesForCopies({ transactions: data.transactions || [], deletedIds: data.deletedTransactionIds || [], syncUpdatedAt: data.syncUpdatedAt || {} });
}
function mergeEntries(existing, incoming) {
  const result = entriesForCopies(historyLists(existing), historyLists(incoming));
  const byId = new Map(result.map(row => [row.id, row]));
  for (const entry of [...existing, ...incoming]) {
    const target = byId.get(entry.id);
    if (!target?.deleted || !target.origin) continue;
    const state = mutationInfo(target.mutationMeta, "transaction").get(entry.id);
    const identity = entry.deleted ? entry.recordIdentity : recordDeletionIdentity(entry.transaction);
    if (identity && recordOriginOf({ id: entry.id, ...identity }) === target.origin && (identity.restorationId || "") === state.generation) target.recordIdentity = identity;
  }
  return result;
}
function coversEntry(stored, source) {
  if (!stored) return false;
  const merged = mergeEntries([stored], [source])[0];
  return canonical(merged) === canonical(mergeEntries([], [stored])[0]);
}
module.exports = { canonical, assertSameOrigin, assertRecordFormat, historyLists, entriesForCopies, rootEntries, mergeEntries, coversEntry };

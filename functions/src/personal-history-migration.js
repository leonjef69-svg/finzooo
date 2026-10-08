"use strict";

const { FieldValue } = require("firebase-admin/firestore");

function validId(id) {
  if (!Number.isSafeInteger(id)) throw new Error("INVALID_HISTORY_ID");
  return String(id);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function legacyEntries(data) {
  const byId = new Map();
  for (const transaction of Array.isArray(data.transactions) ? data.transactions : []) {
    validId(transaction.id);
    const old = byId.get(transaction.id);
    const next = { id: transaction.id, deleted: false, transaction };
    if (old && canonical(old) !== canonical(next)) throw new Error("DUPLICATE_HISTORY_ID");
    byId.set(transaction.id, next);
  }
  for (const id of Array.isArray(data.deletedTransactionIds) ? data.deletedTransactionIds : []) {
    validId(id);
    byId.set(id, { id, deleted: true });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function chooseEntry(old, incoming) {
  if (!old) return incoming;
  if (old.deleted) return old;
  if (incoming.deleted) return incoming;
  assertSameOrigin(old.transaction, incoming.transaction);
  const a = old.transaction.updatedAt ?? 0;
  const b = incoming.transaction.updatedAt ?? 0;
  if (a === b && canonical(old.transaction) !== canonical(incoming.transaction)) {
    throw new Error("HISTORY_EDIT_CONFLICT");
  }
  return b > a ? incoming : old;
}

function covers(stored, source) {
  if (!stored) return false;
  if (stored.deleted) return true;
  if (source.deleted) return false;
  assertSameOrigin(stored.transaction, source.transaction);
  const oldTime = source.transaction.updatedAt ?? 0;
  const newTime = stored.transaction.updatedAt ?? 0;
  return newTime > oldTime || (newTime === oldTime && canonical(stored.transaction) === canonical(source.transaction));
}

function assertSameOrigin(a, b) {
  if ((a.creationId || b.creationId) && a.creationId !== b.creationId
    || a.captureId && b.captureId && a.captureId !== b.captureId
    || a.internalTransferLink && b.internalTransferLink &&
      (a.internalTransferLink !== b.internalTransferLink || a.internalTransfer !== b.internalTransfer
        || a.internalTransferSpaceId !== b.internalTransferSpaceId)) {
    throw new Error("HISTORY_ORIGIN_CONFLICT");
  }
}

function sameRevision(a, b) {
  return !!a && !!b && (typeof a.isEqual === "function" ? a.isEqual(b) : String(a) === String(b));
}

/** Solo para el proceso administrativo, jamás desde un cliente antiguo.
 * Es reanudable: un fallo conserva la lista raíz y vuelve a comprobar todo.
 */
async function migratePersonalHistory(db, uid, options = {}) {
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("INVALID_UID");
  const root = db.collection("users").doc(uid);
  const history = root.collection("history");
  for (let attempt = 0; attempt < (options.maxAttempts ?? 5); attempt++) {
    const first = await root.get();
    if (!first.exists || first.data().hasOnboarded !== true) throw new Error("ACCOUNT_NOT_FOUND");
    if (first.data().historyFormat === 2) return { alreadyMigrated: true };
    if (first.data().historyFormat != null && first.data().historyFormat !== 1) throw new Error("UNKNOWN_HISTORY_FORMAT");
    const source = legacyEntries(first.data());
    for (let start = 0; start < source.length; start += 200) {
      const batchEntries = source.slice(start, start + 200);
      const refs = batchEntries.map(entry => history.doc(validId(entry.id)));
      const existing = await db.getAll(...refs);
      const batch = db.batch();
      let changed = false;
      for (let index = 0; index < batchEntries.length; index++) {
        const incoming = batchEntries[index];
        const old = existing[index].exists ? existing[index].data() : null;
        const merged = chooseEntry(old, incoming);
        if (!covers(old, incoming)) {
          batch.set(refs[index], { ...merged, syncAt: FieldValue.serverTimestamp() });
          changed = true;
        }
      }
      if (changed) await batch.commit();
      if (options.afterBatch) await options.afterBatch(start / 200);
    }
    const latest = await root.get();
    if (!sameRevision(first.updateTime, latest.updateTime)) continue;
    const shadow = await history.get();
    const byId = new Map(shadow.docs.map(row => [Number(row.id), row.data()]));
    if (source.some(entry => !covers(byId.get(entry.id), entry))) throw new Error("HISTORY_SHADOW_INCOMPLETE");
    try {
      await db.runTransaction(async tx => {
        const now = await tx.get(root);
        if (!now.exists || !sameRevision(first.updateTime, now.updateTime) || now.data().historyFormat === 2) {
          throw new Error("LEGACY_CHANGED");
        }
        tx.update(root, {
          historyFormat: 2,
          transactions: FieldValue.delete(),
          deletedTransactionIds: FieldValue.delete(),
        });
      });
      return { alreadyMigrated: false, copied: source.length };
    } catch (error) {
      if (error.message !== "LEGACY_CHANGED") throw error;
    }
  }
  throw new Error("LEGACY_CHANGED_TOO_OFTEN");
}

module.exports = { legacyEntries, chooseEntry, covers, migratePersonalHistory };

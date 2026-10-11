"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { rootEntries, mergeEntries, coversEntry } = require("./record-history");

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
  return rootEntries(data);
}

function chooseEntry(old, incoming) {
  return mergeEntries(old ? [old] : [], [incoming])[0];
}

function covers(stored, source) {
  return coversEntry(stored, source);
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
    if (first.data().recordIdentityFormat !== undefined && ![1, 2].includes(first.data().recordIdentityFormat)) throw new Error("HISTORY_FORMAT_UNSUPPORTED");
    if (first.data().historyFormat === 2) return { alreadyMigrated: true };
    if (first.data().historyFormat != null && first.data().historyFormat !== 1) throw new Error("UNKNOWN_HISTORY_FORMAT");
    const source = legacyEntries(first.data());
    for (let start = 0; start < source.length; start += 200) {
      const batchEntries = source.slice(start, start + 200);
      for (const incoming of batchEntries) {
        const ref = history.doc(validId(incoming.id));
        // Releer y fusionar dentro de la misma transacción: getAll + batch
        // podía pisar una edición llegada entre esa lectura y el commit.
        await db.runTransaction(async tx => {
          const snapshot = await tx.get(ref);
          const old = snapshot.exists ? snapshot.data() : null;
          const merged = chooseEntry(old, incoming);
          if (!covers(old, incoming)) tx.set(ref, { ...merged, recordIdentityFormat: 2,
            recordMutationAt: FieldValue.serverTimestamp(), syncAt: FieldValue.serverTimestamp() });
        });
      }
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
        const finalShadow = await tx.get(history);
        const persisted = new Map(finalShadow.docs.map(row => [Number(row.id), row.data()]));
        if (source.some(entry => !covers(persisted.get(entry.id), entry))) throw new Error("HISTORY_SHADOW_INCOMPLETE");
        tx.update(root, {
          historyFormat: 2,
          recordIdentityFormat: 2,
          recordSyncAt: FieldValue.serverTimestamp(),
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

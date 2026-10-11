"use strict";

// Misma representación en Android/Node. Orden binario, no localeCompare;
// no guarda el original ni lo cambia. Solo fecha de edición/identidad quedan
// fuera de la huella de la versión antigua elegida explícitamente al editar.
function canonicalValue(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalValue(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function legacyCanonical(record) {
  return canonicalValue(Object.fromEntries(Object.entries(record)
    .filter(([key]) => !["creationId", "updatedAt", "restorationId", "restorationParent"].includes(key))));
}

function canAnchorLegacy(record) {
  return !record.creationId && !record.captureId && !record.internalTransferLink
    && !record.internalTransfer && record.method !== "credit-card-payment";
}

function compatibleCreation(a, b, legacyId) {
  if (!a.creationId && !b.creationId) return true;
  if (a.creationId === b.creationId) return true;
  if (a.creationId && !b.creationId && /^legacy:[a-f0-9]{64}$/.test(a.creationId)) return a.creationId === legacyId(b);
  if (b.creationId && !a.creationId && /^legacy:[a-f0-9]{64}$/.test(b.creationId)) return b.creationId === legacyId(a);
  return false;
}

function explicitEditIdentity(original, candidate, legacyId) {
  if (original.id !== candidate.id) throw new Error("record-origin-conflict");
  const creationId = candidate.creationId ?? original.creationId
    ?? (canAnchorLegacy(original) && candidate.method !== "credit-card-payment" ? legacyId(original) : undefined);
  const identity = creationId ? { creationId } : {};
  for (const key of ["captureId", "internalTransferLink", "internalTransfer", "internalTransferSpaceId", "restorationId", "restorationParent"]) {
    if (original[key] !== undefined && candidate[key] == null) identity[key] = original[key];
  }
  return { ...candidate, ...identity };
}

function originForRecord(record, legacyId) {
  if (typeof record.creationId === "string" && /^legacy:[a-f0-9]{64}$/.test(record.creationId)) return record.creationId;
  const fingerprint = legacyId({ reference: [record.captureId || "", record.internalTransferLink || "", record.internalTransfer || "", record.internalTransferSpaceId || ""] }).slice(7);
  if (record.creationId) return `creation:${record.creationId}:${fingerprint}`;
  if (record.captureId) return `capture:${fingerprint}`;
  if (record.internalTransferLink) return `transfer:${fingerprint}`;
  return legacyId(record);
}

// Solo referencias inmutables necesarias para no restaurar otro aviso/aporte.
// No conserva montos, notas, nombres ni fotos del movimiento eliminado.
function deletionIdentity(record, legacyId) {
  const identity = {};
  for (const key of ["creationId", "captureId", "internalTransferLink", "internalTransfer", "internalTransferSpaceId", "restorationId", "restorationParent"]) {
    if (record[key] != null) {
      if (typeof record[key] !== "string") throw new Error("record-origin-conflict");
      identity[key] = record[key];
    }
  }
  if (!record.creationId && !record.captureId && !record.internalTransferLink) identity.creationId = legacyId(record);
  return identity;
}

module.exports = { canonicalValue, legacyCanonical, canAnchorLegacy, compatibleCreation, explicitEditIdentity, originForRecord, deletionIdentity };

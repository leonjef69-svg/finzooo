"use strict";

const crypto = require("node:crypto");
const { units } = require("./money-units");
const { premiumForUser } = require("./premium-entitlement");
const { assertLegalAcceptance, assertLegalAccountOpen } = require("./legal-acceptance");
const fail = reason => { throw Object.assign(new Error(reason), { reason }); };
const id = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);

function validateMovement(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !["tipo", "monto", "descripcion", "fecha", "method", "category", "notes", "personalTransactionId", "personalOwnerUid"].includes(key))
    || !["ingreso", "gasto"].includes(value.tipo) || !Number.isFinite(value.monto) || value.monto <= 0
    || typeof value.descripcion !== "string" || value.descripcion.length > 120
    || typeof value.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.fecha)
    || !Number.isFinite(Date.parse(`${value.fecha}T00:00:00Z`))
    || new Date(`${value.fecha}T00:00:00Z`).toISOString().slice(0, 10) !== value.fecha) fail("shared-invalid-request");
  for (const [key, max] of [["method", 40], ["category", 50], ["notes", 300]]) {
    if (key in value && (typeof value[key] !== "string" || value[key].length > max)) fail("shared-invalid-request");
  }
  const linked = "personalTransactionId" in value || "personalOwnerUid" in value;
  if (linked && (value.tipo !== "ingreso" || value.method !== "transfer"
    || !Number.isSafeInteger(value.personalTransactionId) || value.personalTransactionId <= 0
    || typeof value.personalOwnerUid !== "string")) fail("shared-invalid-request");
  return value;
}

/** La raíz serializa gastos, devoluciones y cambios de aportes de todo el grupo.
 * Se suma desde el historial, no desde una cifra enviada por el teléfono.
 * El recibo sin textos/importes impide repetir o resucitar una orden confirmada.
 */
async function mutateSharedMovement(db, uid, input, now = Date.now()) {
  const { kind, spaceId, movementId, action } = input || {};
  if (typeof uid !== "string" || !uid || uid.includes("/") || !["family", "box"].includes(kind)
    || !id(spaceId) || !id(movementId) || !["create", "delete"].includes(action)) fail("shared-invalid-request");
  const movement = action === "create" ? validateMovement(input.movement) : null;
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ action, movement })).digest("hex");
  const operationId = crypto.createHash("sha256").update(`${uid}:${action}:${movementId}`).digest("hex");
  const root = db.doc(`${kind === "family" ? "familySpaces" : "boxSpaces"}/${spaceId}`);
  const ref = root.collection("movements").doc(movementId);
  const receiptRef = root.collection("moneyOperations").doc(operationId);
  return db.runTransaction(async tx => {
    if (action === "create") await assertLegalAcceptance(tx, db, uid);
    else await assertLegalAccountOpen(tx, db, uid);
    const [space, member, receipt, current] = await Promise.all([
      tx.get(root), tx.get(root.collection("members").doc(uid)), tx.get(receiptRef), tx.get(ref),
    ]);
    if (!space.exists || !member.exists) fail("shared-permission-denied");
    if (receipt.exists) {
      if (receipt.data().fingerprint !== fingerprint) fail("shared-conflict");
      // Confirmar una alta ya anulada no debe producir un nuevo débito local.
      if (action === "create" && !current.exists) fail("shared-conflict");
      return { movementId, createdAt: receipt.data().createdAt };
    }
    const data = space.data();
    if ([data.closed, data.closing, data.deleting].includes(true) || data.migrationComplete === false) fail("shared-space-closed");
    const [owner] = await tx.getAll(db.doc(`users/${data.ownerUid}`), {
      fieldMask: ["isPremium", "premiumTrialStartedAt", "accountDeletionPending"],
    });
    if (action === "create" && !await premiumForUser(db, data.ownerUid, owner.data() || {}, tx)) fail("shared-premium-required");
    if (action === "create" && current.exists) fail("shared-conflict");
    if (movement?.personalOwnerUid != null && (movement.personalOwnerUid !== uid || data.ownerUid !== uid)) fail("shared-permission-denied");
    const currency = data.currency || "PEN";
    if (movement && units(movement.monto, currency, "shared-invalid-request") <= 0n) fail("shared-invalid-request");
    const rows = await tx.get(root.collection("movements"));
    if (movement?.personalTransactionId != null && rows.docs.some(row => row.data().personalOwnerUid === uid
      && row.data().personalTransactionId === movement.personalTransactionId)) fail("shared-conflict");
    let balance = 0n;
    for (const row of rows.docs) {
      const item = row.data();
      if (!["ingreso", "gasto"].includes(item.tipo)) fail("shared-invalid-data");
      const amount = units(item.monto, currency, "shared-invalid-data");
      if (amount <= 0n) fail("shared-invalid-data");
      balance += item.tipo === "ingreso" ? amount : -amount;
    }
    if (action === "create") {
      const amount = units(movement.monto, currency, "shared-invalid-request");
      // No usar tolerancias de céntimos: incluso un céntimo pertenece al grupo.
      if (movement.tipo === "gasto" && balance < amount) fail("shared-insufficient-balance");
      tx.create(ref, { ...movement, creadoPor: uid, creadoEn: now });
    } else if (current.exists) {
      const item = current.data();
      if (item.personalTransactionId != null || item.personalOwnerUid != null || item.personalReturnAmount != null) fail("shared-linked-movement");
      if (item.creadoPor !== uid && data.ownerUid !== uid) fail("shared-permission-denied");
      if (item.tipo === "ingreso" && balance < units(item.monto, currency, "shared-invalid-data")) fail("shared-insufficient-balance");
      tx.delete(ref);
    }
    tx.set(receiptRef, { fingerprint, createdAt: now });
    tx.update(root, { sharedMoneyVersion: (Number(data.sharedMoneyVersion) || 0) + 1 });
    return { movementId, createdAt: now };
  });
}

module.exports = { mutateSharedMovement, validateMovement };

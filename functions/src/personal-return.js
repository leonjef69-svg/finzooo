"use strict";

const crypto = require("node:crypto");
const { invalidPersonalReturns } = require("./personal-contribution");
const ZERO = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);
function currencyDecimals(currency) { return ZERO.has(currency) ? 0 : THREE.has(currency) ? 3 : 2; }
function fail(reason) { const error = new Error(reason); error.reason = reason; throw error; }
function units(value, currency) {
  const decimals = currencyDecimals(currency), scale = 10 ** decimals;
  if (!Number.isFinite(value) || value < 0 || value > 9_000_000_000_000) fail("return-invalid-data");
  const rounded = Math.round(value * scale) / scale;
  if (Math.abs(value - rounded) > Math.max(1e-9, Number.EPSILON * Math.abs(value) * 2)) fail("return-invalid-data");
  if (!Number.isInteger(rounded) && rounded > (decimals === 3 ? 10_000_000_000 : 100_000_000_000)) fail("return-invalid-data");
  return BigInt(rounded.toFixed(decimals).replace(".", ""));
}
function amount(value, currency) {
  const result = Number(value) / 10 ** currencyDecimals(currency);
  if (units(result, currency) !== value) fail("return-invalid-data");
  return result;
}
function responsible(item) { return item.personalOwnerUid || item.creadoPor; }
function created(item) { return typeof item.creadoEn?.toMillis === "function" ? item.creadoEn.toMillis() : Number(item.creadoEn) || 0; }

/** Calcula solo dinero recuperable de esa cuenta, en unidades enteras exactas. */
function refundable(movements, uid, currency) {
  if (invalidPersonalReturns(movements)) fail("return-invalid-data");
  let balance = 0n, sent = 0n, returned = 0n;
  const ownContributions = [], ids = new Set();
  for (const item of movements) {
    const value = units(item.monto, currency);
    balance += item.tipo === "ingreso" ? value : -value;
    if (item.personalReturnAmount != null && !responsible(item)) fail("return-invalid-data");
    if (responsible(item) !== uid) continue;
    if (item.tipo === "ingreso" && item.personalTransactionId != null) {
      if (!Number.isSafeInteger(item.personalTransactionId) || item.personalTransactionId <= 0 || ids.has(item.personalTransactionId)) fail("return-invalid-data");
      ids.add(item.personalTransactionId); sent += value; ownContributions.push({ ...item, value });
    }
    if (item.personalReturnAmount != null) returned += units(item.personalReturnAmount, currency);
  }
  const net = sent - returned;
  return { available: balance > 0n && net > 0n ? (balance < net ? balance : net) : 0n, ownContributions, returned };
}

async function returnPersonalContribution(db, uid, input, now = Date.now()) {
  const { kind, spaceId, personalTransactionId, currency, fecha, description } = input || {};
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/") || !["family", "box"].includes(kind)
    || typeof spaceId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(spaceId)
    || !Number.isSafeInteger(personalTransactionId) || personalTransactionId <= 0
    || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)
    || typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    || !Number.isFinite(Date.parse(`${fecha}T00:00:00Z`)) || new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) !== fecha
    || typeof description !== "string" || !description.trim() || description.length > 60) fail("return-invalid-request");
  const expected = units(input.amount, currency);
  if (expected <= 0n) fail("return-invalid-request");
  const spaceRef = db.doc(`${kind === "family" ? "familySpaces" : "boxSpaces"}/${spaceId}`);
  const movementId = `return_${crypto.createHash("sha256").update(uid).digest("hex").slice(0, 24)}_${personalTransactionId}`;
  const movementRef = spaceRef.collection("movements").doc(movementId);
  const receiptRef = db.doc(`personalReturnReceipts/${uid}/operations/${movementId}`);
  return db.runTransaction(async tx => {
    // La confirmación privada permite recuperar el ingreso aunque el grupo
    // se borre o retire al miembro antes de que el teléfono consiga guardarlo.
    const confirmed = await tx.get(receiptRef);
    if (confirmed.exists) {
      const receipt = confirmed.data();
      if (receipt.uid !== uid || receipt.kind !== kind || receipt.spaceId !== spaceId || receipt.personalTransactionId !== personalTransactionId
        || receipt.currency !== currency || units(receipt.amount, currency) !== expected || receipt.fecha !== fecha
        || receipt.description !== description.trim()) fail("return-conflict");
      return receipt;
    }
    const [space, member, existing] = await Promise.all([tx.get(spaceRef), tx.get(spaceRef.collection("members").doc(uid)), tx.get(movementRef)]);
    if (!space.exists || !member.exists) fail("return-permission-denied");
    if (existing.exists) {
      const receipt = existing.data().personalReturnReceipt;
      if (!receipt || receipt.uid !== uid || receipt.kind !== kind || receipt.spaceId !== spaceId
        || receipt.personalTransactionId !== personalTransactionId || receipt.currency !== currency
        || units(receipt.amount, currency) !== expected || receipt.fecha !== fecha || receipt.description !== description.trim()) fail("return-conflict");
      return receipt; // También recupera un resultado ya confirmado tras cerrar.
    }
    const data = space.data();
    const claim = await tx.get(db.doc(`premiumTrialClaims/${uid}`));
    if (claim.exists && claim.data().deletionPending === true) fail("return-space-closed");
    if ([data.closed, data.closing, data.deleting].includes(true) || data.migrationComplete === false) fail("return-space-closed");
    if (String(data.currency || "PEN") !== currency) fail("return-currency-mismatch");
    const rows = await tx.get(spaceRef.collection("movements"));
    const movements = rows.docs.map(item => ({ ...item.data(), id: item.id }));
    if (movements.some(item => responsible(item) === uid && item.personalTransactionId === personalTransactionId)) fail("return-conflict");
    const ledger = refundable(movements, uid, currency);
    if (ledger.available !== expected) fail("return-changed");
    let previouslyReturned = ledger.returned, remaining = expected;
    const allocations = [];
    for (const item of ledger.ownContributions.sort((a, b) => created(a) - created(b) || a.id.localeCompare(b.id))) {
      const credited = previouslyReturned < item.value ? previouslyReturned : item.value;
      previouslyReturned -= credited;
      const unreturned = item.value - credited;
      const applied = remaining < unreturned ? remaining : unreturned;
      if (applied > 0n) allocations.push({ transactionId: item.personalTransactionId, amount: amount(applied, currency) });
      remaining -= applied;
      if (remaining === 0n) break;
    }
    if (remaining !== 0n) fail("return-invalid-data");
    const receipt = { uid, kind, spaceId, movementId, personalTransactionId, currency, fecha, description: description.trim(),
      spaceName: String(data.nombre || (kind === "family" ? "Familia" : "Caja")).slice(0, 60),
      amount: amount(expected, currency), createdAt: now, allocations };
    if (Buffer.byteLength(JSON.stringify(receipt), "utf8") > 800_000) fail("return-too-large");
    tx.set(movementRef, { tipo: "gasto", monto: receipt.amount, descripcion: receipt.description, method: "transfer", fecha,
      creadoPor: uid, creadoEn: now, personalTransactionId, personalOwnerUid: uid, personalReturnAmount: receipt.amount,
      personalReturnReceipt: receipt });
    tx.set(receiptRef, receipt);
    // Todos los reembolsos de este espacio bloquean la misma raíz al confirmar.
    tx.update(spaceRef, { personalReturnVersion: (Number(data.personalReturnVersion) || 0) + 1 });
    return receipt;
  });
}

module.exports = { returnPersonalContribution, refundable, currencyDecimals, units };

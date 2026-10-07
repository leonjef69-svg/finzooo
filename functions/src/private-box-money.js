"use strict";
const { createHash } = require("node:crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { premiumForUser } = require("./premium-entitlement");
const { sourceFrom } = require("./private-box-migration");
const { units } = require("./money-units");
const { canonical, validateMoneyReview, moneyResult, moneyAcknowledgement, fail } = require("./private-box-money-shared");
function sameSource(actual, expected) {
  try { return canonical(actual) === canonical(expected); } catch { fail("money-invalid-source"); }
}
function sameWithoutVersion(actual, expected) {
  if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object") fail("money-invalid-source");
  const { updatedAt: ignoredActual, ...current } = actual;
  const { updatedAt: ignoredExpected, ...original } = expected;
  return sameSource(current, original);
}
function retirementDigest(entry) { return createHash("sha256").update(canonical(entry)).digest("hex"); }
function retirementResult(entry, digest) {
  return { status: "retired", uid: entry.uid, id: entry.id, boxId: entry.box.id,
    movementId: entry.remote.movement.id, personalId: entry.remote.personal.id, digest };
}

/** Pareja exacta y fuentes comprobadas; el retiro conserva un bloqueo permanente por ID. */
async function privateBoxMoney(db, uid, entry, mode) {
  let bytes;
  try { bytes = Buffer.byteLength(JSON.stringify(entry), "utf8"); } catch { fail("money-invalid-review"); }
  if (bytes > 150_000) fail("money-review-too-large");
  validateMoneyReview(entry, uid);
  const rootRef = db.doc(`users/${uid}`), boxesRef = db.doc(`cajas/${uid}`);
  const retirementRef = db.doc(`moneyReviewRetirements/${uid}/operations/${entry.id}`);
  return db.runTransaction(async tx => {
    const [root, boxes, retirement] = await Promise.all([tx.get(rootRef), tx.get(boxesRef), tx.get(retirementRef)]);
    const user = root.exists ? root.data() : null;
    if (!user || user.hasOnboarded !== true || user.accountDeletionPending === true) fail("money-account-unavailable");
    // Recuperar solo comprueba el resultado exacto ya presente; nunca corrige
    // ni entrega el historial. Una corrección nueva sigue exigiendo Pro.
    if (mode !== "resolve") {
      const claim = await tx.get(db.doc(`premiumTrialClaims/${uid}`));
      if (claim.exists && claim.data().deletionPending === true) fail("money-account-unavailable");
    } else if (!(await premiumForUser(db, uid, user, tx))) fail("money-premium-required");
    if (retirement.exists) {
      if (mode !== "retire" || retirement.data().digest !== retirementDigest(entry)) fail("money-review-retired");
      return retirementResult(entry, retirement.data().digest);
    }
    if (user.userCurrency !== entry.currency) fail("money-currency-changed");
    if (!boxes.exists) fail("money-source-changed");
    const data = boxes.data();
    if (!Array.isArray(data.cajas) || !Array.isArray(data.movimientos)
      || (data.cajasBorradas !== undefined && !Array.isArray(data.cajasBorradas))
      || (data.movimientosBorrados !== undefined && !Array.isArray(data.movimientosBorrados))
      || (data.syncFormat !== undefined && ![1, 2, 3].includes(data.syncFormat))
      || (data.syncFormat === 3 && data.conversiones === undefined)
      || (data.conversiones !== undefined && (!data.conversiones || typeof data.conversiones !== "object" || Array.isArray(data.conversiones) || data.syncFormat !== 3))
      || data.revisionesNombre !== undefined || data.revisionesImporte !== undefined) fail("money-invalid-source");
    const boxId = entry.box.id, movementId = entry.remote.movement.id, personalId = entry.remote.personal.id;
    if (data.cajas.filter(item => item?.id === boxId).length !== 1 || (data.cajasBorradas || []).includes(boxId)
      || (data.movimientosBorrados || []).includes(movementId) || data.conversiones?.[boxId]
      || !sameSource(data.cajas.find(item => item?.id === boxId), entry.box)) fail("money-source-changed");
    if (data.movimientos.filter(item => item?.id === movementId).length !== 1
      || data.movimientos.filter(item => item?.personalTransactionId === personalId).length !== 1) fail("money-source-changed");
    const movement = data.movimientos.find(item => item?.id === movementId);
    const rows = data.movimientos.filter(item => item?.cajaId === boxId);
    // No reconstruir asignaciones ni modificar un aporte con devolución posterior.
    if (rows.some(item => item.personalReturnAmount !== undefined || (data.movimientosBorrados || []).includes(item.id))) fail("money-return-conflict");
    let personal, historyRef;
    if (user.historyFormat === 2) {
      historyRef = rootRef.collection("history").doc(String(personalId));
      const query = rootRef.collection("history").where("transaction.internalTransferLink", "==", movementId).limit(2);
      const [saved, links] = await Promise.all([tx.get(historyRef), tx.get(query)]);
      if (!saved.exists || saved.data().id !== personalId || saved.data().deleted !== false
        || saved.data().transaction?.id !== personalId || links.docs.length !== 1 || links.docs[0].id !== String(personalId)) fail("money-source-changed");
      personal = saved.data().transaction;
    } else {
      if ((user.historyFormat !== undefined && user.historyFormat !== 1) || !Array.isArray(user.transactions)
        || (user.deletedTransactionIds !== undefined && !Array.isArray(user.deletedTransactionIds))) fail("money-invalid-source");
      if ((user.deletedTransactionIds || []).includes(personalId)
        || user.transactions.filter(item => item?.id === personalId).length !== 1
        || user.transactions.filter(item => item?.internalTransferLink === movementId).length !== 1) fail("money-source-changed");
      personal = user.transactions.find(item => item?.id === personalId);
    }
    const result = moneyResult(entry), ack = moneyAcknowledgement(entry);
    const replay = sameSource(personal, result.personal) && sameSource(movement, result.movement);
    if (mode === "retire" && replay) return { status: "applied", uid, id: entry.id };
    if (mode === "retire") {
      // Solo se suelta el bloqueo cuando ambas mitades remotas y locales ya
      // coinciden. El marcador y el escritor viejo leen el mismo documento:
      // Firestore reintenta la transacción perdedora, incluso si HTTP llegó tarde.
      if (entry.local.personal.amount !== entry.local.movement.monto || entry.local.personal.date !== entry.local.movement.fecha
        || !sameWithoutVersion(personal, entry.local.personal) || !sameWithoutVersion(movement, entry.local.movement)) fail("money-source-changed");
      try { sourceFrom(data, boxId); } catch { fail("money-invalid-source"); }
      const digest = retirementDigest(entry);
      tx.set(retirementRef, { digest, retiredAt: FieldValue.serverTimestamp() });
      return retirementResult(entry, digest);
    }
    if (!replay && (!sameSource(personal, entry.remote.personal) || !sameSource(movement, entry.remote.movement))) fail("money-source-changed");
    if (mode === "recover" && !replay) fail("money-not-confirmed");
    let balance = 0n;
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row.id !== "string" || ids.has(row.id) || !["ingreso", "gasto"].includes(row.tipo)) fail("money-invalid-source");
      ids.add(row.id);
      const value = units(row.id === movementId ? result.movement.monto : row.monto, entry.currency, "money-invalid-source");
      if (value <= 0n) fail("money-invalid-source");
      balance += value * (row.tipo === "ingreso" ? 1n : -1n);
    }
    if (balance < 0n) fail("money-negative-balance");
    const movements = data.movimientos.map(row => row?.id === movementId ? result.movement : row);
    try { sourceFrom({ ...data, movimientos: movements }, boxId); } catch { fail("money-invalid-source"); }
    if (replay) return ack; // Respuesta perdida: no añade otro movimiento ni otra escritura.
    tx.update(boxesRef, { movimientos: movements, syncFormat: data.syncFormat === 3 ? 3 : 2 });
    if (historyRef) tx.update(historyRef, { transaction: result.personal, syncAt: FieldValue.serverTimestamp() });
    else tx.update(rootRef, { transactions: user.transactions.map(row => row?.id === personalId ? result.personal : row), syncFormat: 2 });
    return ack;
  });
}
function resolvePrivateBoxMoney(db, uid, entry) { return privateBoxMoney(db, uid, entry, "resolve"); }
function recoverPrivateBoxMoney(db, uid, entry) { return privateBoxMoney(db, uid, entry, "recover"); }
function retirePrivateBoxMoney(db, uid, entry) { return privateBoxMoney(db, uid, entry, "retire"); }
module.exports = { resolvePrivateBoxMoney, recoverPrivateBoxMoney, retirePrivateBoxMoney };

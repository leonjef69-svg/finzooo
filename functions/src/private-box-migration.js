"use strict";
const { createHash } = require("node:crypto");
const { premiumForUser } = require("./premium-entitlement");
const { privateBoxSourceString, copiedBoxMovementMatches } = require("./private-box-source");
const { invalidPersonalReturns } = require("./personal-contribution");

const fail = reason => { const error = new Error(reason); error.reason = reason; throw error; };
function requestValid(data) {
  if (!data || !["status", "finish", "reset"].includes(data.action) || typeof data.sourceId !== "string"
    || !/^[A-Za-z0-9_-]{1,160}$/.test(data.sourceId)
    || typeof data.digest !== "string" || !/^[a-f0-9]{64}$/.test(data.digest)
    || typeof data.currency !== "string" || !/^[A-Z]{3}$/.test(data.currency)) fail("migration-invalid-request");
}

function sourceFrom(data, sourceId) {
  if (!Array.isArray(data?.cajas) || !Array.isArray(data?.movimientos)) fail("migration-invalid-source");
  if (data.cajas.some(item => !item || typeof item !== "object") || data.movimientos.some(item => !item || typeof item !== "object")) fail("migration-invalid-source");
  const box = data.cajas.find(item => item.id === sourceId);
  const rows = data.movimientos.filter(item => item.cajaId === sourceId);
  if (!box || data.cajasBorradas?.includes(sourceId)) fail("migration-source-missing");
  if (data.cajas.filter(item => item.id === sourceId).length !== 1 || typeof box.nombre !== "string" || !box.nombre || box.nombre.length > 30
    || !Number.isSafeInteger(box.creadaEn) || box.creadaEn < 0 || (box.updatedAt != null && (!Number.isSafeInteger(box.updatedAt) || box.updatedAt < 0))) fail("migration-invalid-source");
  const ids = new Set(), personalIds = new Set();
  for (const row of rows) {
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(row.id) || ids.has(row.id) || data.movimientosBorrados?.includes(row.id)
      || !["ingreso", "gasto"].includes(row.tipo) || !Number.isFinite(row.monto) || row.monto <= 0
      || !Number.isSafeInteger(Math.round(row.monto * 1000)) || !Number.isSafeInteger(row.creadoEn)
      || row.creadoEn < 0 || (row.updatedAt != null && (!Number.isSafeInteger(row.updatedAt) || row.updatedAt < 0))
      || typeof row.descripcion !== "string" || typeof row.fecha !== "string"
      || [row.category, row.notes, row.method].some(value => value != null && typeof value !== "string")
      || (row.personalTransactionId != null && (!Number.isSafeInteger(row.personalTransactionId) || row.personalTransactionId <= 0 || personalIds.has(row.personalTransactionId)))
      || (row.personalReturnAmount != null && (row.tipo !== "gasto" || !Number.isFinite(row.personalReturnAmount)
        || row.personalReturnAmount <= 0 || row.personalReturnAmount > row.monto || row.personalTransactionId == null))) fail("migration-invalid-source");
    ids.add(row.id); if (row.personalTransactionId != null) personalIds.add(row.personalTransactionId);
  }
  const balance = rows.reduce((total, row) => total + BigInt(Math.round(row.monto * 1000)) * (row.tipo === "ingreso" ? 1n : -1n), 0n);
  if (balance < 0n || invalidPersonalReturns(rows)) fail("migration-invalid-source");
  return { box, rows };
}

function digestSource(box, rows, currency) {
  return createHash("sha256").update(privateBoxSourceString(box, rows, currency), "utf8").digest("hex");
}

async function accountOpen(tx, db, uid) {
  const [user, claim] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(db.doc(`premiumTrialClaims/${uid}`))]);
  if (user.data()?.accountDeletionPending === true || claim.data()?.deletionPending === true) fail("migration-account-closing");
  return user;
}

/** Confirma copia y retira origen en UNA transacción, no en dos pantallas. */
async function privateBoxMigration(db, uid, data) {
  requestValid(data);
  const targetId = `${uid}_${data.sourceId}`;
  const target = db.doc(`boxSpaces/${targetId}`), origin = db.doc(`cajas/${uid}`);
  const receiptRef = db.doc(`privateBoxMigrations/${uid}/operations/${data.sourceId}`);
  if (data.action === "reset") return reset(db, uid, target);
  return db.runTransaction(async tx => {
    const [receipt, user] = await Promise.all([tx.get(receiptRef), accountOpen(tx, db, uid)]);
    if (receipt.exists) {
      const saved = receipt.data();
      if (saved.uid !== uid || saved.digest !== data.digest || saved.currency !== data.currency) fail("migration-source-changed");
      return { complete: true, receipt: saved };
    }
    if (data.action === "status") return { complete: false };
    // El estado/reintento confirmado no consulta el historial ni el destino.
    const [root, source] = await Promise.all([tx.get(target), tx.get(origin)]);
    if (!root.exists || root.data().ownerUid !== uid || root.data().currency !== data.currency
      || root.data().closed === true || root.data().closing === true || root.data().deleting === true || root.data().migrationResetting === true) fail("migration-not-owner");
    // Solo termina sin Pro una operación que fue creada con el protocolo nuevo.
    if (root.data().migrationProtocol !== 2 && !(await premiumForUser(db, uid, user.data() || {}, tx))) fail("migration-premium-required");
    if (root.data().migrationProtocol === 2 && root.data().migrationComplete !== false) fail("migration-copy-incomplete");
    if (!source.exists) fail("migration-source-missing");
    const original = source.data();
    if ((original.conversiones != null && (typeof original.conversiones !== "object" || Array.isArray(original.conversiones)))
      || (original.cajasBorradas != null && !Array.isArray(original.cajasBorradas))
      || (original.movimientosBorrados != null && !Array.isArray(original.movimientosBorrados))) fail("migration-invalid-source");
    const { box, rows } = sourceFrom(original, data.sourceId);
    if (digestSource(box, rows, data.currency) !== data.digest) fail("migration-source-changed");
    const [movements, members] = await Promise.all([tx.get(target.collection("movements")), tx.get(target.collection("members"))]);
    if (members.size !== 1 || members.docs[0].id !== uid || members.docs[0].data().rol !== "owner") fail("migration-members-conflict");
    const byId = new Map(rows.map(row => [row.id, row]));
    if (movements.size !== rows.length || movements.docs.some(doc => !byId.has(doc.id)
      || !copiedBoxMovementMatches(doc.data(), byId.get(doc.id), uid))) fail("migration-copy-incomplete");
    const links = rows.filter(row => row.personalTransactionId != null).map(row => ({ personalId: row.personalTransactionId, movementId: row.id }));
    const saved = { uid, sourceId: data.sourceId, targetId, name: box.nombre, currency: data.currency,
      createdAt: box.creadaEn, digest: data.digest, links, completedAt: Date.now() };
    const conversiones = { ...(original.conversiones || {}), [data.sourceId]: saved };
    tx.set(receiptRef, saved);
    tx.set(origin, { ...original, syncFormat: 3, conversiones,
      cajas: original.cajas.filter(item => item.id !== data.sourceId),
      movimientos: original.movimientos.filter(item => item.cajaId !== data.sourceId),
      cajasBorradas: [...new Set([...(original.cajasBorradas || []), data.sourceId])],
      movimientosBorrados: [...new Set([...(original.movimientosBorrados || []), ...rows.map(row => row.id)])],
    });
    tx.update(target, { migrationComplete: true, migrationProtocol: 2, nombre: box.nombre });
    return { complete: true, receipt: saved };
  });
}

/** Solo elimina clones incompletos del protocolo nuevo, nunca el origen. */
async function reset(db, uid, target) {
  await db.runTransaction(async tx => {
    const [root, members] = await Promise.all([tx.get(target), tx.get(target.collection("members")), accountOpen(tx, db, uid)]);
    if (!root.exists || root.data().ownerUid !== uid || root.data().migrationProtocol !== 2
      || root.data().migrationComplete !== false || members.size !== 1 || members.docs[0].id !== uid) fail("migration-reset-forbidden");
    tx.update(target, { migrationResetting: true });
  });
  while (true) {
    const done = await db.runTransaction(async tx => {
      const root = await tx.get(target);
      if (!root.exists || root.data().ownerUid !== uid || root.data().migrationComplete !== false) fail("migration-reset-forbidden");
      // Dos reintentos de limpieza no pueden borrar una copia que ya empezó
      // después de que el primero liberó el bloqueo.
      if (root.data().migrationResetting !== true) return true;
      const docs = await tx.get(target.collection("movements").limit(200));
      if (docs.empty) { tx.update(target, { migrationResetting: false }); return true; }
      for (const doc of docs.docs) tx.delete(doc.ref);
      return false;
    });
    if (done) break;
  }
  return { complete: false };
}

module.exports = { privateBoxMigration, digestSource, sourceFrom };

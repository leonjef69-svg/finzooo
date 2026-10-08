"use strict";

const crypto = require("node:crypto");
const { Timestamp } = require("firebase-admin/firestore");
const CONTACT = "dinero123xc@gmail.com";
const REASONS = new Set(["abuse", "harassment", "inappropriate", "other"]);
const RETENTION_MS = 30 * 86_400_000;
function fail(reason) { throw Object.assign(new Error(reason), { reason }); }
function validSegment(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function validateReport(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => !["id", "kind", "spaceId", "targetType", "targetId", "reason", "details", "expectedText", "expectedUid", "processingAccepted", "policyVersion"].includes(key))
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.id || "") || !["family", "box"].includes(input.kind)
    || !validSegment(input.spaceId) || !["movement", "member", "space"].includes(input.targetType)
    || !validSegment(input.targetId) || !REASONS.has(input.reason)
    || typeof input.details !== "string" || input.details.length > 500
    || typeof input.expectedText !== "string" || input.expectedText.length > 120
    || typeof input.expectedUid !== "string" || input.expectedUid.length > 128
    || input.processingAccepted !== true || input.policyVersion !== "2026-10-08"
    || input.targetType === "space" && input.targetId !== input.spaceId) fail("report-invalid");
  return { id: input.id, kind: input.kind, spaceId: input.spaceId,
    targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details.trim(),
    expectedText: input.expectedText, expectedUid: input.expectedUid,
    processingAccepted: true, policyVersion: input.policyVersion };
}

/** No modifica el libro financiero ni da acceso al historial a soporte. */
async function submitContentReport(db, uid, raw, now = Date.now()) {
  if (!validSegment(uid) || !Number.isSafeInteger(now) || now < 0) fail("report-invalid");
  const input = validateReport(raw);
  const hash = crypto.createHash("sha256").update(JSON.stringify([uid, input])).digest("hex");
  const key = crypto.createHash("sha256").update(`${uid}:${input.id}`).digest("hex");
  const reportRef = db.collection("contentReports").doc(key);
  const mailRef = db.collection("moderationMail").doc(key);
  const quotaRef = db.collection("reportRateLimits").doc(uid);
  const spaceRef = db.collection(input.kind === "family" ? "familySpaces" : "boxSpaces").doc(input.spaceId);
  const memberRef = spaceRef.collection("members").doc(uid);
  const targetRef = input.targetType === "space" ? spaceRef
    : spaceRef.collection(input.targetType === "movement" ? "movements" : "members").doc(input.targetId);
  return db.runTransaction(async tx => {
    // Idempotencia antes de consumir cupo: reintentar una respuesta perdida
    // no duplica el correo. Nunca devuelve texto/identidad del denunciado.
    const existing = await tx.get(reportRef);
    if (existing.exists) {
      if (existing.data().reporterUid !== uid || existing.data().requestHash !== hash) fail("report-conflict");
      return { id: input.id, saved: true, emailConfirmed: false };
    }
    const quota = await tx.get(quotaRef), day = Math.floor(now / 86_400_000);
    if (quota.exists && quota.data().closed === true) fail("report-account-closing");
    const used = quota.exists && quota.data().day === day ? quota.data().count : 0;
    if (!Number.isSafeInteger(used) || used < 0 || used >= 3) fail("report-limit");
    // Máscaras también en servidor: no leer el historial v1 completo del
    // denunciante ni importe/notas del movimiento solo para comprobar acceso.
    const [[configuration, account, claim], [space, member, target]] = await Promise.all([
      tx.getAll(db.collection("privateSettings").doc("moderation"), db.collection("users").doc(uid),
        db.collection("premiumTrialClaims").doc(uid),
        { fieldMask: ["enabled", "mailConfigured", "contact", "accountDeletionPending", "deletionPending"] }),
      tx.getAll(spaceRef, memberRef, targetRef,
        { fieldMask: ["ownerUid", "nombre", "migrationComplete", "uid", "creadoPor", "descripcion"] }),
    ]);
    // No anunciar atención/correo automáticos hasta que el propietario haya
    // configurado y probado el envío. No se instala ni conecta ningún proveedor.
    if (!configuration.exists || configuration.data().enabled !== true
      || configuration.data().mailConfigured !== true || configuration.data().contact !== CONTACT) fail("report-unavailable");
    if (account.exists && account.data().accountDeletionPending === true
      || claim.exists && claim.data().deletionPending === true) fail("report-account-closing");
    if (!space.exists || !member.exists || !target.exists || space.data().migrationComplete === false) fail("report-permission");
    const data = target.data();
    const targetUid = input.targetType === "member" ? input.targetId
      : input.targetType === "space" ? String(space.data().ownerUid || "") : String(data.creadoPor || "");
    const text = input.targetType === "movement" ? String(data.descripcion || "").slice(0, 120)
      : String(data.nombre || (input.targetType === "member" ? "Miembro" : input.kind === "family" ? "Familia" : "Caja")).slice(0, 120);
    if (input.expectedText !== text || input.expectedUid !== targetUid) fail("report-source-changed");
    const expiresAt = Timestamp.fromMillis(now + RETENTION_MS);
    const report = { reporterUid: uid, requestHash: hash, reportId: input.id, kind: input.kind,
      spaceId: input.spaceId, targetType: input.targetType, targetId: input.targetId,
      targetUid, reason: input.reason, details: input.details, text,
      createdAt: Timestamp.fromMillis(now), expiresAt, status: "pending", processingAccepted: true, policyVersion: input.policyVersion };
    // Solo texto señalado/IDs, motivo y aclaración voluntaria; no importe,
    // presupuesto, PIN, fotos, notas financieras ni todo el historial.
    tx.set(reportRef, report);
    tx.set(mailRef, { to: CONTACT, reporterUid: uid, targetUid, expiresAt,
      message: { subject: "Fino: denuncia de contenido compartido",
        text: `Reporte: ${key}\nDenunciante: ${uid}\nEspacio: ${input.kind}/${input.spaceId}\nElemento: ${input.targetType}/${input.targetId}\nAutor: ${targetUid}\nMotivo: ${input.reason}\nTexto señalado: ${text}\nAclaración: ${input.details}\nNo cambiar movimientos ni saldos al atender este aviso.` } });
    tx.set(quotaRef, { day, count: used + 1 });
    return { id: input.id, saved: true, emailConfirmed: false };
  });
}

/** Acotado, reintentable; el operador no conserva copias técnicas indefinidas. */
async function cleanupExpiredReports(db, now = Date.now()) {
  let removed = 0;
  for (let round = 0; round < 5; round++) {
    const page = await db.collection("contentReports").where("expiresAt", "<=", Timestamp.fromMillis(now)).limit(100).get();
    if (page.empty) break;
    const batch = db.batch();
    for (const row of page.docs) {
      batch.delete(row.ref); batch.delete(db.collection("moderationMail").doc(row.id));
    }
    await batch.commit(); removed += page.size;
  }
  // Barrera breve para peticiones iniciadas antes de borrar Auth. Las nuevas
  // llamadas comprueban además que Auth siga existiendo; no guardar UID indefinido.
  const barriers = await db.collection("reportRateLimits").where("expiresAt", "<=", Timestamp.fromMillis(now)).limit(100).get();
  if (!barriers.empty) {
    const batch = db.batch(); for (const row of barriers.docs) batch.delete(row.ref);
    await batch.commit();
  }
  return removed;
}

async function cleanupReportsForAccount(db, uid, now = Date.now()) {
  if (!validSegment(uid) || !Number.isSafeInteger(now) || now < 0) fail("report-invalid");
  // Primero cerrar: una transacción concurrente que había leído el cupo
  // debe reintentarse y fallar, no recrear denuncias después de la limpieza.
  await db.collection("reportRateLimits").doc(uid).set({ closed: true, expiresAt: Timestamp.fromMillis(now + RETENTION_MS) });
  for (const collection of ["contentReports", "moderationMail"]) {
    for (const field of ["reporterUid", "targetUid"]) {
      while (true) {
        const page = await db.collection(collection).where(field, "==", uid).limit(100).get();
        if (page.empty) break;
        const batch = db.batch(); for (const row of page.docs) batch.delete(row.ref);
        await batch.commit();
      }
    }
  }
}

module.exports = { CONTACT, validateReport, submitContentReport, cleanupExpiredReports, cleanupReportsForAccount };

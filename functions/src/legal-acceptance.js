"use strict";

// Huellas de constants/legal.ts. La prueba de contrato exige igualdad exacta
// con textos y reglas; actualizar juntos y desplegar de forma coordinada.
const DOCUMENTS = Object.freeze({ version: "2026-10-08-ugc1",
  termsHash: "3dab9c8bcd507b36f28f293c57dc23010e76b5f408de3700d2e53c44c97f968f",
  privacyHash: "812f7f971bd3391f3302dc45f9b312743561280a23119b2c1b643fa0242927d5" });
const fail = reason => { throw Object.assign(new Error(reason), { reason }); };
function safeUid(uid) {
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/") || uid === "." || uid === "..") fail("legal-account-invalid");
}
function validLegalReceipt(value, uid, now = Date.now()) {
  return !!value && value.format === 1 && value.uid === uid && value.version === DOCUMENTS.version
    && Object.keys(value).every(key => ["format", "uid", "version", "termsHash", "privacyHash", "termsAccepted", "privacyRead", "acceptedAt"].includes(key))
    && value.termsHash === DOCUMENTS.termsHash && value.privacyHash === DOCUMENTS.privacyHash
    && value.termsAccepted === true && value.privacyRead === true
    && Number.isSafeInteger(value.acceptedAt) && value.acceptedAt > 0 && value.acceptedAt <= now;
}
async function assertLegalAccountOpen(tx, db, uid) {
  const [user, claim, reports] = await tx.getAll(db.doc(`users/${uid}`), db.doc(`premiumTrialClaims/${uid}`),
    db.doc(`reportRateLimits/${uid}`), { fieldMask: ["accountDeletionPending", "deletionPending", "closed"] });
  if (user.data()?.accountDeletionPending === true || claim.data()?.deletionPending === true || reports.data()?.closed === true) fail("legal-account-closing");
}
async function assertLegalAcceptance(tx, db, uid) {
  safeUid(uid);
  const receipt = await tx.get(db.doc(`legalAcceptances/${uid}`));
  if (!receipt.exists || !validLegalReceipt(receipt.data(), uid)) fail("legal-acceptance-required");
  await assertLegalAccountOpen(tx, db, uid);
}
/** Auth real verificado por el callable; sin Pro, sin historia ni UID del cuerpo. */
async function acceptLegalDocuments(db, uid, input, now) {
  safeUid(uid);
  if ((now !== undefined && (!Number.isSafeInteger(now) || now <= 0)) || !input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => !["termsHash", "privacyHash", "termsAccepted", "privacyRead"].includes(key))
    || input.termsAccepted !== true || input.privacyRead !== true) fail("legal-invalid-request");
  if (input.termsHash !== DOCUMENTS.termsHash || input.privacyHash !== DOCUMENTS.privacyHash) fail("legal-version-changed");
  const ref = db.doc(`legalAcceptances/${uid}`);
  return db.runTransaction(async tx => {
    await assertLegalAccountOpen(tx, db, uid);
    const current = await tx.get(ref);
    // Tiempo del intento transaccional, no del comienzo de la llamada: al
    // reintentar detrás de otra aceptación, conservar su fecha ya confirmada.
    const acceptedAt = now ?? Date.now();
    if (current.exists && validLegalReceipt(current.data(), uid, acceptedAt)) return current.data();
    const receipt = { format: 1, uid, ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt };
    tx.set(ref, receipt); // Solo la versión vigente; reintentar no cambia la fecha.
    return receipt;
  });
}
module.exports = { DOCUMENTS, validLegalReceipt, acceptLegalDocuments, assertLegalAcceptance };

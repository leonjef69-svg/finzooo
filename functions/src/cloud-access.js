"use strict";

const { premium, testerPremium } = require("./premium-entitlement");
const { prepareIncompleteBoxDeletion } = require("./incomplete-box-cleanup");

function safeUid(uid) {
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/") || uid === "." || uid === "..") throw new Error("INVALID_UID");
}

/** Devuelve solo permisos y existencia: nunca movimientos, fotos ni perfil. */
async function getCloudAccess(db, uid, now = Date.now()) {
  safeUid(uid);
  const [account, tester, trialClaim] = await db.getAll(
    db.doc(`users/${uid}`), db.doc(`testerPremium/${uid}`), db.doc(`premiumTrialClaims/${uid}`),
    { fieldMask: ["isPremium", "hasOnboarded", "premiumTrialStartedAt", "accountDeletionPending", "active", "grantedAt", "deletionPending"] },
  );
  const data = account.exists ? account.data() : {};
  const testerData = tester.exists ? tester.data() : null;
  const deleting = data.accountDeletionPending === true || (trialClaim.exists && trialClaim.data().deletionPending === true);
  const result = {
    uid, isPremium: data.isPremium === true, isTester: testerPremium(testerData),
    canSync: !deleting && premium(data, now, testerData),
    hasCloudCopy: data.hasOnboarded === true,
    deletionPending: deleting,
    serverNow: now,
  };
  if (Number.isFinite(data.premiumTrialStartedAt) && data.premiumTrialStartedAt >= 0) {
    result.premiumTrialStartedAt = data.premiumTrialStartedAt;
  }
  return result;
}

/** Limpieza por UID, sin exigir Pro ni entregar el historial al cliente. */
async function deletePersonalCloudCopy(db, uid) {
  safeUid(uid);
  const ref = db.doc(`users/${uid}`);
  const claim = db.doc(`premiumTrialClaims/${uid}`);
  // Mantener el marcador hasta acabar bloquea también escritores Pro en vuelo.
  await db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    transaction.set(claim, { deletionPending: true }, { merge: true });
    if (current.exists) transaction.update(ref, { accountDeletionPending: true });
    else transaction.set(ref, { hasOnboarded: false, isPremium: false, accountDeletionPending: true });
  });
  while (true) {
    const rows = await ref.collection("history").limit(200).get();
    if (rows.empty) break;
    const batch = db.batch();
    for (const row of rows.docs) batch.delete(row.ref);
    await batch.commit();
  }
  await ref.delete();
  return { ok: true };
}

/** El evento de Auth retira también permisos que un token antiguo conserve. */
async function cleanupDeletedCloudAccount(db, uid) {
  await deletePersonalCloudCopy(db, uid);
  // Comprobar ANTES de retirar recibos: un destino inconsistente pero ya
  // publicado no puede pasar como clon por haber borrado primero su prueba.
  await prepareIncompleteBoxDeletion(db, uid, "deleted");
  for (const collection of ["personalReturnReceipts", "privateBoxMigrations"]) {
    for (const subcollection of collection === "privateBoxMigrations" ? ["operations", "attempts"] : ["operations"]) {
      const receipts = db.doc(`${collection}/${uid}`).collection(subcollection);
      while (true) {
        const rows = await receipts.limit(200).get();
        if (rows.empty) break;
        const batch = db.batch();
        for (const row of rows.docs) batch.delete(row.ref);
        await batch.commit();
      }
    }
  }
  const batch = db.batch();
  for (const collection of ["negocios", "cajas", "testerPremium", "premiumTrialClaims", "personalReturnReceipts", "privateBoxMigrations"]) {
    batch.delete(db.doc(`${collection}/${uid}`));
  }
  await batch.commit();
}

module.exports = { getCloudAccess, deletePersonalCloudCopy, cleanupDeletedCloudAccount };

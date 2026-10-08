"use strict";

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { cleanupTelegram, cleanupExpiredTelegram } = require("./src/telegram-cleanup");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const legacyFunctions = require("firebase-functions/v1");
const { getFirestore } = require("firebase-admin/firestore");
const { handleTelegramUpdate } = require("./src/telegram-guided-handler");
const { CENT, contributionLimits, canCloseLinkedSpace, hasUnreturnedPersonalContribution } = require("./src/personal-contribution");
const { premiumForUser } = require("./src/premium-entitlement");
const { activatePremiumTrial } = require("./src/premium-trial");
const { getCloudAccess, deletePersonalCloudCopy, cleanupDeletedCloudAccount } = require("./src/cloud-access");
const { returnPersonalContribution } = require("./src/personal-return");
const { finalizeLinkedSpaceDeletion } = require("./src/linked-space-cleanup");
const { privateBoxMigration } = require("./src/private-box-migration");
const { prepareIncompleteBoxDeletion } = require("./src/incomplete-box-cleanup");
const { resolvePrivateBoxMoney, recoverPrivateBoxMoney, retirePrivateBoxMoney } = require("./src/private-box-money");
const { submitContentReport, cleanupExpiredReports } = require("./src/content-reports");

initializeApp();
const { acceptLegalDocuments, assertLegalAcceptance } = require("./src/legal-acceptance");

function verifiedAccount(request, recent = false) {
  const uid = request.auth?.uid;
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/")
    || request.auth.token?.email_verified !== true) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión y verificar tu correo.");
  }
  if (recent) {
    const age = Date.now() / 1000 - request.auth.token.auth_time;
    if (!Number.isFinite(age) || age < -30 || age > 300) {
      throw new HttpsError("failed-precondition", "Confirma tu identidad antes de eliminar los datos.");
    }
  }
  return uid;
}

exports.getCloudAccess = onCall({ region: "southamerica-east1", maxInstances: 10 }, request =>
  getCloudAccess(getFirestore(), verifiedAccount(request)));

exports.acceptLegalDocuments = onCall({ region: "southamerica-east1", maxInstances: 2, timeoutSeconds: 60 }, async request => {
  const uid = verifiedAccount(request);
  let account;
  try { account = await getAuth().getUser(uid); }
  catch (error) {
    if (error?.code === "auth/user-not-found") throw new HttpsError("unauthenticated", "La cuenta ya no está disponible.");
    throw error;
  }
  if (account.disabled || !account.emailVerified) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
  try { return await acceptLegalDocuments(getFirestore(), uid, request.data); }
  catch (error) {
    if (!error?.reason) throw error;
    throw new HttpsError(error.reason === "legal-invalid-request" ? "invalid-argument" : "failed-precondition",
      "No se confirmó la aceptación. No se cambió ningún movimiento ni saldo.", { reason: error.reason });
  }
});

exports.submitContentReport = onCall({ region: "southamerica-east1", maxInstances: 2 }, async request => {
  const uid = verifiedAccount(request), account = await getAuth().getUser(uid);
  if (account.disabled || !account.emailVerified) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
  try { return await submitContentReport(getFirestore(), uid, request.data); }
  catch (error) {
    if (!error?.reason) throw error;
    throw new HttpsError(error.reason === "report-limit" ? "resource-exhausted"
      : error.reason === "report-permission" ? "permission-denied"
        : error.reason === "report-invalid" ? "invalid-argument" : "failed-precondition",
    "No se guardó la denuncia. No se cambió ningún movimiento ni saldo.", { reason: error.reason });
  }
});

exports.cleanupExpiredContentReports = onSchedule({ schedule: "every 60 minutes", region: "southamerica-east1", maxInstances: 1 }, () =>
  cleanupExpiredReports(getFirestore()));

exports.resolvePrivateBoxMoney = onCall({ region: "southamerica-east1", maxInstances: 5, timeoutSeconds: 120 }, async request => {
  const uid = verifiedAccount(request);
  const account = await getAuth().getUser(uid);
  if (account.disabled || !account.emailVerified) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
  try { return await resolvePrivateBoxMoney(getFirestore(), uid, request.data); }
  catch (error) {
    if (!error?.reason) throw error;
    throw new HttpsError(error.reason === "money-premium-required" ? "permission-denied"
      : /invalid-review|review-too-large/.test(error.reason) ? "invalid-argument" : "failed-precondition",
    "No se corrigió la transferencia. Conserva los originales y revisa de nuevo los importes.", { reason: error.reason });
  }
});

// Sin Pro: únicamente confirma un resultado exacto vigente. La petición no
// puede seleccionar el modo de escritura ni esta función iniciar un arreglo.
exports.recoverPrivateBoxMoney = onCall({ region: "southamerica-east1", maxInstances: 5, timeoutSeconds: 120 }, async request => {
  const uid = verifiedAccount(request);
  const account = await getAuth().getUser(uid);
  if (account.disabled || !account.emailVerified) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
  try { return await recoverPrivateBoxMoney(getFirestore(), uid, request.data); }
  catch (error) {
    if (!error?.reason) throw error;
    throw new HttpsError(/invalid-review|review-too-large/.test(error.reason) ? "invalid-argument" : "failed-precondition",
      "No se pudo confirmar esa corrección. Conserva los originales; no se ha cambiado dinero.", { reason: error.reason });
  }
});

// Sin Pro: registra el retiro únicamente cuando ambas copias remotas ya
// coinciden con las locales. Si la corrección vieja se aplicó, devuelve solo
// su estado para que la app recupere el recibo por el camino de solo lectura.
exports.retirePrivateBoxMoney = onCall({ region: "southamerica-east1", maxInstances: 5, timeoutSeconds: 120 }, async request => {
  const uid = verifiedAccount(request);
  const account = await getAuth().getUser(uid);
  if (account.disabled || !account.emailVerified) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
  try { return await retirePrivateBoxMoney(getFirestore(), uid, request.data); }
  catch (error) {
    if (!error?.reason) throw error;
    throw new HttpsError(/invalid-review|review-too-large/.test(error.reason) ? "invalid-argument" : "failed-precondition",
      "No se retiró la elección. Conserva los originales y comprueba las copias.", { reason: error.reason });
  }
});

exports.prepareIncompleteBoxDeletion = onCall({ region: "southamerica-east1", maxInstances: 5, timeoutSeconds: 540 }, async request => {
  const uid = verifiedAccount(request, true);
  if (!["inspect", "discard"].includes(request.data?.action)) throw new HttpsError("invalid-argument", "Solicitud de borrado inválida.");
  const user = await getAuth().getUser(uid);
  if (user.disabled || !user.emailVerified) throw new HttpsError("unauthenticated", "Confirma tu cuenta.");
  try { return await prepareIncompleteBoxDeletion(getFirestore(), uid, request.data.action); }
  catch (error) {
    if (!error?.reason) throw error;
    throw new HttpsError("failed-precondition", "No se pudo comprobar una copia incompleta. No se elimina como si fuera dinero compartido.", { reason: error.reason });
  }
});

exports.privateBoxMigration = onCall({ region: "southamerica-east1", maxInstances: 5, timeoutSeconds: 120 }, async request => {
  const uid = verifiedAccount(request);
  const account = await getAuth().getUser(uid);
  if (account.disabled || !account.emailVerified) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
  try { return await privateBoxMigration(getFirestore(), uid, request.data); }
  catch (error) {
    if (!error?.reason) throw error;
    throw new HttpsError(error.reason === "migration-invalid-request" ? "invalid-argument" : "failed-precondition",
      "No se confirmó la copia de la Caja. El origen no se retira hasta comprobarla.", { reason: error.reason });
  }
});

exports.deletePersonalCloudCopy = onCall({ region: "southamerica-east1", maxInstances: 5, timeoutSeconds: 540 }, request =>
  deletePersonalCloudCopy(getFirestore(), verifiedAccount(request, true)));

exports.returnPersonalContribution = onCall({ region: "southamerica-east1", maxInstances: 5, timeoutSeconds: 120 }, async request => {
  const uid = verifiedAccount(request);
  const account = await getAuth().getUser(uid);
  if (account.disabled || !account.emailVerified) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
  try { return await returnPersonalContribution(getFirestore(), uid, request.data); }
  catch (error) {
    if (!error?.reason) throw error;
    const code = error.reason === "return-permission-denied" ? "permission-denied"
      : error.reason === "return-invalid-request" ? "invalid-argument" : "failed-precondition";
    throw new HttpsError(code, "No se confirmó la devolución. Actualiza el espacio y revisa el saldo.", { reason: error.reason });
  }
});

exports.cleanupDeletedCloudAccount = legacyFunctions.region("southamerica-east1")
  .runWith({ failurePolicy: true, maxInstances: 5, timeoutSeconds: 540 }).auth.user().onDelete(async user => {
    try {
      await getAuth().getUser(user.uid);
      return; // No eliminar una cuenta nueva que reutilice el UID administrativo.
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    await cleanupDeletedCloudAccount(getFirestore(), user.uid);
  });

exports.finalizeLinkedSpaceDeletion = onCall({ region: "southamerica-east1", maxInstances: 5, timeoutSeconds: 540 }, async request => {
  const uid = verifiedAccount(request, true);
  const account = await getAuth().getUser(uid);
  if (account.disabled || !account.emailVerified) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
  try { return await finalizeLinkedSpaceDeletion(getFirestore(), uid, request.data); }
  catch (error) {
    if (!error?.reason) throw error;
    const code = error.reason === "cleanup-not-owner" ? "permission-denied"
      : error.reason === "cleanup-invalid-request" ? "invalid-argument" : "failed-precondition";
    throw new HttpsError(code, "No se pudo completar la limpieza del espacio.", { reason: error.reason });
  }
});

function validDocumentId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);
}

async function hasPremium(db, uid) {
  const user = await db.doc(`users/${uid}`).get();
  const data = user.exists ? user.data() : {};
  return premiumForUser(db, uid, data);
}

/** La prueba gratuita se concede una sola vez y con hora del servidor. */
exports.activatePremiumTrial = onCall(
  { region: "southamerica-east1" },
  async request => {
    const uid = request.auth?.uid;
    if (!uid || request.auth.token?.email_verified !== true) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión y verificar tu correo.");
    }
    try {
      // Un ID token anterior puede seguir vigente tras borrar Auth. No puede
      // usarse para recrear el permiso de prueba del UID ya eliminado.
      const account = await getAuth().getUser(uid);
      if (account.disabled || account.emailVerified !== true) throw new HttpsError("unauthenticated", "Verifica tu cuenta.");
      return await activatePremiumTrial(getFirestore(), uid, Date.now(), { hasLocalSetup: request.data?.hasLocalSetup === true });
    } catch (error) {
      if (error?.message === "ACCOUNT_NOT_READY") {
        throw new HttpsError("failed-precondition", "Termina de configurar tu cuenta.");
      }
      throw error;
    }
  },
);

/**
 * Único camino para reducir o borrar un aporte que salió de Personal.
 * Firestore Rules no puede sumar una subcolección completa; la transacción
 * administrativa sí lee el espacio entero y aplica el límite financiero antes
 * de modificar el movimiento.
 */
exports.changePersonalContribution = onCall(
  { region: "southamerica-east1" },
  async request => {
    const uid = request.auth?.uid;
    if (!uid || request.auth.token?.email_verified !== true) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión y verificar tu correo.");
    }
    const { kind, spaceId, movementId, action, amount, description } = request.data || {};
    if (!(["family", "box"].includes(kind)) || !validDocumentId(spaceId) || !validDocumentId(movementId) || !["update", "delete"].includes(action)) {
      throw new HttpsError("invalid-argument", "Solicitud de aporte inválida.");
    }
    if (action === "update" && (!Number.isFinite(amount) || amount <= 0 || amount > 9000000000000 || typeof description !== "string" || description.length > 60)) {
      throw new HttpsError("invalid-argument", "Monto o descripción inválidos.");
    }
    const db = getFirestore();
    const collectionName = kind === "family" ? "familySpaces" : "boxSpaces";
    const spaceRef = db.doc(`${collectionName}/${spaceId}`);
    const movementRef = spaceRef.collection("movements").doc(movementId);
    const memberRef = spaceRef.collection("members").doc(uid);
    const receiptRef = db.doc(`personalReturnReceipts/${uid}/operations/${movementId}`);

    await db.runTransaction(async transaction => {
      if (action === "update") {
        try { await assertLegalAcceptance(transaction, db, uid); }
        catch (error) {
          if (!error?.reason) throw error;
          throw new HttpsError("failed-precondition", "Lee y acepta los documentos antes de compartir contenido.", { reason: error.reason });
        }
      }
      const [space, member, current, movementSnapshot, confirmed] = await Promise.all([
        transaction.get(spaceRef), transaction.get(memberRef), transaction.get(movementRef), transaction.get(spaceRef.collection("movements")),
        action === "delete" ? transaction.get(receiptRef) : Promise.resolve(null),
      ]);
      const previous = confirmed?.exists ? confirmed.data() : null;
      // Recupera una anulación ya confirmada sin otra escritura, incluso si
      // después venció Pro o el espacio se cerró. Solo confirma la operación propia.
      if (action === "delete" && !current.exists && previous?.cancelled === true
        && previous.uid === uid && previous.kind === kind && previous.spaceId === spaceId && previous.movementId === movementId) return;
      if (!space.exists || !member.exists || space.data().closed === true || space.data().closing === true || space.data().deleting === true || space.data().migrationComplete === false) {
        throw new HttpsError("failed-precondition", "El espacio no está disponible.");
      }
      if (!(await hasPremium(db, space.data().ownerUid))) {
        throw new HttpsError("failed-precondition", "El espacio está en solo lectura porque venció Premium.");
      }
      const currentData = current.exists ? current.data() : {};
      const linkedContribution = currentData.tipo === "ingreso" && typeof currentData.personalTransactionId === "number";
      const linkedReturn = currentData.tipo === "gasto"
        && typeof currentData.personalTransactionId === "number"
        && Number.isFinite(currentData.personalReturnAmount)
        && currentData.personalReturnAmount > 0;
      if (!current.exists || currentData.personalOwnerUid !== uid || (!linkedContribution && !linkedReturn)) {
        throw new HttpsError("permission-denied", "No puedes modificar este aporte.");
      }
      if (action === "update" && !linkedContribution) {
        throw new HttpsError("failed-precondition", "Una devolución solo puede deshacerse completa.");
      }
      if (action === "delete" && linkedReturn) {
        const receipt = previous || currentData.personalReturnReceipt;
        if (receipt) {
          if (receipt.uid !== uid || receipt.kind !== kind || receipt.spaceId !== spaceId || receipt.movementId !== movementId
            || receipt.personalTransactionId !== currentData.personalTransactionId || receipt.amount !== currentData.personalReturnAmount) {
            throw new HttpsError("failed-precondition", "La confirmación de la devolución no coincide.");
          }
          transaction.set(receiptRef, { ...receipt, cancelled: true, cancelledAt: receipt.cancelledAt ?? Date.now() });
        }
        transaction.delete(movementRef);
        transaction.update(spaceRef, { personalReturnVersion: (Number(space.data().personalReturnVersion) || 0) + 1 });
        return;
      }
      const movements = movementSnapshot.docs.map(item => item.data());
      const original = Number.isFinite(currentData.monto) ? currentData.monto : 0;
      const limits = contributionLimits(movements, uid, original);
      if (action === "delete") {
        if (!limits.canDelete) throw new HttpsError("failed-precondition", "Este aporte ya fue usado.");
        transaction.delete(movementRef);
        return;
      }
      if (amount < limits.minimum - CENT) throw new HttpsError("failed-precondition", "No puedes reducir la parte ya usada.");
      transaction.update(movementRef, { monto: amount, descripcion: description.trim() });
    });
    return { ok: true };
  },
);

/**
 * Cerrar o preparar el borrado de una Familia/Caja también requiere sumar
 * todos sus movimientos. Solo Admin puede escribir estas marcas; el celular
 * ya no puede habilitarse a sí mismo para saltar la comprobación financiera.
 */
exports.manageLinkedSpace = onCall(
  { region: "southamerica-east1" },
  async request => {
    const uid = request.auth?.uid;
    if (!uid || request.auth.token?.email_verified !== true) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión y verificar tu correo.");
    }
    const { kind, spaceId, action } = request.data || {};
    if (!(["family", "box"].includes(kind)) || !validDocumentId(spaceId) || !["close", "prepare-delete"].includes(action)) {
      throw new HttpsError("invalid-argument", "Solicitud de espacio inválida.");
    }
    const db = getFirestore();
    const collectionName = kind === "family" ? "familySpaces" : "boxSpaces";
    const spaceRef = db.doc(`${collectionName}/${spaceId}`);
    await db.runTransaction(async transaction => {
      const [space, movementSnapshot] = await Promise.all([
        transaction.get(spaceRef),
        transaction.get(spaceRef.collection("movements")),
      ]);
      if (!space.exists || space.data().ownerUid !== uid) {
        throw new HttpsError("permission-denied", "Solo el propietario puede realizar esta acción.");
      }
      if (space.data().migrationComplete === false) throw new HttpsError("failed-precondition", "La copia de la Caja aún no está confirmada.");
      if (space.data().deleting === true) {
        if (action === "prepare-delete") return;
        throw new HttpsError("failed-precondition", "El espacio se está eliminando.");
      }
      const movements = movementSnapshot.docs.map(item => item.data());
      if (!canCloseLinkedSpace(movements)) {
        throw new HttpsError("failed-precondition", "Primero devuelve el dinero disponible y deja el saldo en cero. Lo ya gastado es consumido.");
      }
      if (action === "prepare-delete") {
        transaction.update(spaceRef, { deleting: true });
      } else if (space.data().closed !== true) {
        transaction.update(spaceRef, { closed: true, closing: false });
      }
    });
    return { ok: true };
  },
);

/** Salir o retirar a un miembro nunca puede abandonar un aporte Personal. */
exports.leaveLinkedSpace = onCall(
  { region: "southamerica-east1" },
  async request => {
    const uid = request.auth?.uid;
    if (!uid || request.auth.token?.email_verified !== true) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión y verificar tu correo.");
    }
    const { kind, spaceId, targetUid } = request.data || {};
    const memberUid = typeof targetUid === "string" && targetUid ? targetUid : uid;
    if (!(["family", "box"].includes(kind)) || !validDocumentId(spaceId) || !validDocumentId(memberUid)) {
      throw new HttpsError("invalid-argument", "Solicitud de salida inválida.");
    }
    const db = getFirestore();
    const collectionName = kind === "family" ? "familySpaces" : "boxSpaces";
    const userIndexName = kind === "family" ? "familyUsers" : "boxUsers";
    const spaceRef = db.doc(`${collectionName}/${spaceId}`);
    const memberRef = spaceRef.collection("members").doc(memberUid);
    const linkRef = db.doc(`${userIndexName}/${memberUid}/spaces/${spaceId}`);
    const familyUserRef = kind === "family" ? db.doc(`familyUsers/${memberUid}`) : null;
    let movementsToAnonymize = [];

    await db.runTransaction(async transaction => {
      const reads = [
        transaction.get(spaceRef),
        transaction.get(memberRef),
        transaction.get(spaceRef.collection("movements")),
      ];
      if (familyUserRef) reads.push(transaction.get(familyUserRef));
      const [space, member, movementSnapshot, familyUser] = await Promise.all(reads);
      if (!space.exists) return;
      if (space.data().migrationComplete === false) throw new HttpsError("failed-precondition", "La copia de la Caja aún no está confirmada.");
      const ownerUid = space.data().ownerUid;
      if (memberUid === ownerUid) throw new HttpsError("failed-precondition", "El propietario debe cerrar el espacio.");
      if (memberUid !== uid && ownerUid !== uid) {
        throw new HttpsError("permission-denied", "No puedes retirar a este miembro.");
      }
      const movements = movementSnapshot.docs.map(item => item.data());
      if (hasUnreturnedPersonalContribution(movements, memberUid)) {
        throw new HttpsError("failed-precondition", "Primero devuelve el aporte Personal de este miembro.");
      }
      movementsToAnonymize = movementSnapshot.docs.filter(item =>
        item.data().creadoPor === memberUid || item.data().personalOwnerUid === memberUid || item.data().personalReturnReceipt?.uid === memberUid,
      );
      if (member.exists) transaction.delete(memberRef);
      transaction.delete(linkRef);
      if (familyUserRef && familyUser?.exists && String(familyUser.data().activeFamilyId || "") === spaceId) {
        transaction.set(familyUserRef, { activeFamilyId: "" }, { merge: true });
      }
    });

    for (let start = 0; start < movementsToAnonymize.length; start += 400) {
      const batch = db.batch();
      for (const item of movementsToAnonymize.slice(start, start + 400)) {
        const data = item.data();
        batch.update(item.ref, {
          ...(data.creadoPor === memberUid ? { creadoPor: "deleted" } : {}),
          ...(data.personalOwnerUid === memberUid ? { personalOwnerUid: "deleted" } : {}),
          ...(data.personalReturnReceipt?.uid === memberUid ? { "personalReturnReceipt.uid": "deleted" } : {}),
        });
      }
      await batch.commit();
    }
    return { ok: true };
  },
);
exports.cleanupDeletedTelegramAccount = onDocumentDeleted(
  { document: "users/{uid}", region: "southamerica-east1", retry: true },
  event => cleanupTelegram(getFirestore(), event.params.uid, true),
);
exports.cleanupDisconnectedTelegram = onDocumentDeleted(
  { document: "telegramUsers/{uid}", region: "southamerica-east1", retry: true },
  event => cleanupTelegram(getFirestore(), event.params.uid),
);
exports.cleanupExpiredTelegram = onSchedule(
  { schedule: "every 60 minutes", region: "southamerica-east1", maxInstances: 1 },
  () => cleanupExpiredTelegram(getFirestore()),
);
const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_WEBHOOK_SECRET = defineSecret("TELEGRAM_WEBHOOK_SECRET");

exports.telegramWebhook = onRequest(
  { region: "southamerica-east1", secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET] },
  async (request, response) => {
    if (request.method !== "POST" || request.get("x-telegram-bot-api-secret-token") !== TELEGRAM_WEBHOOK_SECRET.value()) {
      response.status(403).send("Forbidden"); return;
    }
    await handleTelegramUpdate({ db: getFirestore(), token: TELEGRAM_BOT_TOKEN.value(), update: request.body });
    response.status(200).send("OK");
  },
);

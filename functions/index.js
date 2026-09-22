"use strict";

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { cleanupTelegram, cleanupExpiredTelegram } = require("./src/telegram-cleanup");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { handleTelegramUpdate } = require("./src/telegram-guided-handler");
const { CENT, contributionLimits, canCloseLinkedSpace, hasUnreturnedPersonalContribution } = require("./src/personal-contribution");

initializeApp();

function validDocumentId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);
}

async function hasPremium(db, uid) {
  const [user, tester] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`testerPremium/${uid}`).get(),
  ]);
  const data = user.exists ? user.data() : {};
  const trial = typeof data.premiumTrialStartedAt === "number" ? data.premiumTrialStartedAt : 0;
  return data.isPremium === true
    || (tester.exists && tester.data().active === true && tester.data().grantedAt)
    || (trial > 0 && trial + 24 * 60 * 60 * 1000 > Date.now());
}

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

    await db.runTransaction(async transaction => {
      const [space, member, current, movementSnapshot] = await Promise.all([
        transaction.get(spaceRef), transaction.get(memberRef), transaction.get(movementRef), transaction.get(spaceRef.collection("movements")),
      ]);
      if (!space.exists || !member.exists || space.data().closed === true || space.data().closing === true || space.data().deleting === true) {
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
        transaction.delete(movementRef);
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
      if (space.data().deleting === true) {
        if (action === "prepare-delete") return;
        throw new HttpsError("failed-precondition", "El espacio se está eliminando.");
      }
      const movements = movementSnapshot.docs.map(item => item.data());
      if (!canCloseLinkedSpace(movements)) {
        throw new HttpsError("failed-precondition", "Primero devuelve los aportes Personal y deja el saldo en cero.");
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
        item.data().creadoPor === memberUid || item.data().personalOwnerUid === memberUid,
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

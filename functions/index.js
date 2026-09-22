"use strict";

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { cleanupTelegram, cleanupExpiredTelegram } = require("./src/telegram-cleanup");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { handleTelegramUpdate } = require("./src/telegram-guided-handler");
const { CENT, contributionLimits } = require("./src/personal-contribution");

initializeApp();

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
    if (!(["family", "box"].includes(kind)) || typeof spaceId !== "string" || typeof movementId !== "string" || !["update", "delete"].includes(action)) {
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
      if (!current.exists || current.data().tipo !== "ingreso" || current.data().personalOwnerUid !== uid || typeof current.data().personalTransactionId !== "number") {
        throw new HttpsError("permission-denied", "No puedes modificar este aporte.");
      }
      const movements = movementSnapshot.docs.map(item => item.data());
      const original = numberOrZero(current.data().monto);
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

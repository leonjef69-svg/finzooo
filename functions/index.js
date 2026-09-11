"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { cleanupTelegram, cleanupExpiredTelegram } = require("./src/telegram-cleanup");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { handleTelegramUpdate } = require("./src/telegram-guided-handler");

initializeApp();
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

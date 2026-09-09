"use strict";

const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { handleTelegramUpdate } = require("./src/telegram-handler");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en el entorno. No lo escribas dentro del código.");

initializeApp({ credential: applicationDefault(), projectId: "dotero-2d430" });
const db = getFirestore();
let offset = 0;

async function api(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || method);
  return result.result;
}

async function main() {
  await api("deleteWebhook", { drop_pending_updates: false });
  console.log("Bot local de Fino activo. Déjalo abierto para recibir mensajes.");
  while (true) {
    try {
      const updates = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleTelegramUpdate({ db, token, update });
      }
    } catch (error) {
      console.error("Telegram:", error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

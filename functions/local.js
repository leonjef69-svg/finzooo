"use strict";

// Esta herramienta borra el webhook del bot para poder leer mensajes por
// polling. No debe hacerlo por accidente ni apuntar a Firebase de producción
// solo porque alguien ejecutó `node local.js`.
const projectId = process.env.FINO_LOCAL_FIREBASE_PROJECT_ID?.trim();
if (process.env.FINO_LOCAL_ALLOW_WEBHOOK_DELETE !== "YES") {
  throw new Error("El bot local cambiaría el webhook. Exige FINO_LOCAL_ALLOW_WEBHOOK_DELETE=YES explícito.");
}
if (!projectId) {
  throw new Error("Indica FINO_LOCAL_FIREBASE_PROJECT_ID para el proyecto de pruebas.");
}
if (projectId === "dotero-2d430" && process.env.FINO_LOCAL_ALLOW_PRODUCTION !== "YES") {
  throw new Error("Producción bloqueada: FINO_LOCAL_ALLOW_PRODUCTION=YES es obligatorio para usarla aquí.");
}

const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { handleTelegramUpdate } = require("./src/telegram-guided-handler");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN en el entorno. No lo escribas dentro del código.");

initializeApp({ credential: applicationDefault(), projectId });
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

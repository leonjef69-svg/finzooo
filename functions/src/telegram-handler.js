"use strict";

const crypto = require("node:crypto");
const { Buffer } = require("node:buffer");
const { parseLinkCode, parseMovement } = require("./telegram-parser");

const MAX_USER_BYTES = 850_000;
const LINK_MINUTES = 10;

function limaDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function premium(data, now = Date.now()) {
  return data?.isPremium === true || (Number.isFinite(data?.premiumTrialStartedAt) && data.premiumTrialStartedAt <= now && data.premiumTrialStartedAt + 86_400_000 > now);
}

function telegramApi(token, method, body) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Telegram ${method}: ${response.status}`);
    return response.json();
  });
}

async function send(token, chatId, text, replyMarkup) {
  return telegramApi(token, "sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup });
}

async function connectionFor(db, chatId) {
  const connection = await db.collection("telegramConnections").doc(String(chatId)).get();
  if (!connection.exists) return null;
  const uid = connection.data().uid;
  const status = await db.collection("telegramUsers").doc(uid).get();
  return status.exists && status.data().active === true && status.data().chatId === String(chatId) ? { uid } : null;
}

async function link(db, token, chatId, code) {
  const ref = db.collection("telegramLinkRequests").doc(code.toUpperCase());
  await db.runTransaction(async (tx) => {
    const request = await tx.get(ref);
    if (!request.exists || request.data().used || request.data().expiresAtMs < Date.now()) throw new Error("INVALID_CODE");
    const uid = request.data().uid;
    const userRef = db.collection("users").doc(uid);
    const statusRef = db.collection("telegramUsers").doc(uid);
    const connectionRef = db.collection("telegramConnections").doc(String(chatId));
    const [user, oldStatus, occupiedConnection] = await Promise.all([
      tx.get(userRef), tx.get(statusRef), tx.get(connectionRef),
    ]);
    if (!user.exists || !premium(user.data())) throw new Error("NOT_PREMIUM");
    // Una cuenta y un chat solo pueden tener una conexión activa. Al volver a
    // vincular se revocan ambos extremos anteriores dentro de la misma operación.
    if (oldStatus.exists && oldStatus.data().chatId !== String(chatId)) {
      tx.delete(db.collection("telegramConnections").doc(oldStatus.data().chatId));
    }
    if (occupiedConnection.exists && occupiedConnection.data().uid !== uid) {
      tx.delete(db.collection("telegramUsers").doc(occupiedConnection.data().uid));
    }
    tx.set(connectionRef, { uid, linkedAtMs: Date.now() });
    tx.set(statusRef, { active: true, chatId: String(chatId), linkedAtMs: Date.now() });
    tx.update(ref, { used: true, usedAtMs: Date.now() });
  });
  await send(token, chatId, "✅ Telegram quedó conectado con Fino. Escribe, por ejemplo: gasto 100 comida");
}

async function confirm(db, token, chatId, nonce) {
  const draftRef = db.collection("telegramDrafts").doc(String(chatId));
  await db.runTransaction(async (tx) => {
    const connectionRef = db.collection("telegramConnections").doc(String(chatId));
    const connection = await tx.get(connectionRef);
    if (!connection.exists) throw new Error("NOT_LINKED");
    const uid = connection.data().uid;
    const statusRef = db.collection("telegramUsers").doc(uid);
    const userRef = db.collection("users").doc(uid);
    const [status, draft, user] = await Promise.all([tx.get(statusRef), tx.get(draftRef), tx.get(userRef)]);
    if (!status.exists || status.data().active !== true || status.data().chatId !== String(chatId)) throw new Error("NOT_LINKED");
    if (!draft.exists || draft.data().nonce !== nonce || draft.data().expiresAtMs < Date.now()) throw new Error("EXPIRED");
    if (!user.exists || !premium(user.data())) throw new Error("NOT_PREMIUM");
    const data = user.data();
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    let id = Date.now() * 4096 + crypto.randomInt(4096);
    while (transactions.some((item) => item.id === id)) id += 1;
    const movement = { ...draft.data().movement, id, date: limaDate(), notes: "", origin: "manual" };
    const next = [...transactions, movement];
    if (Buffer.byteLength(JSON.stringify({ ...data, transactions: next }), "utf8") > MAX_USER_BYTES) throw new Error("TOO_LARGE");
    tx.update(userRef, { transactions: next });
    tx.delete(draftRef);
  });
  await send(token, chatId, "✅ Movimiento guardado en Fino.");
}

async function handleTelegramUpdate({ db, token, update }) {
  const message = update.message;
  const callback = update.callback_query;
  const chatId = message?.chat?.id ?? callback?.message?.chat?.id;
  if (!chatId) return;
  try {
    if (callback) {
      await telegramApi(token, "answerCallbackQuery", { callback_query_id: callback.id });
      const [action, nonce] = String(callback.data || "").split(":");
      if (action === "ok") return await confirm(db, token, chatId, nonce);
      if (action === "cancel") {
        await db.collection("telegramDrafts").doc(String(chatId)).delete();
        return await send(token, chatId, "Movimiento cancelado.");
      }
      return;
    }
    const text = String(message?.text || "").trim();
    const linkCode = parseLinkCode(text);
    if (linkCode) return await link(db, token, chatId, linkCode);
    if (/^\/start\b/i.test(text)) return await send(token, chatId, "Hola. Vincula tu cuenta desde Fino y luego usa: gasto 100 comida o ingreso 1500 salario.");
    const connection = await connectionFor(db, chatId);
    if (!connection) return await send(token, chatId, "Primero vincula Telegram desde Ajustes → Telegram en Fino.");
    const movement = parseMovement(text);
    if (!movement) return await send(token, chatId, "No lo entendí. Usa, por ejemplo: gasto 100 comida");
    const nonce = crypto.randomBytes(6).toString("hex");
    await db.collection("telegramDrafts").doc(String(chatId)).set({ movement, nonce, expiresAtMs: Date.now() + LINK_MINUTES * 60_000 });
    const kind = movement.type === "expense" ? "Gasto" : "Ingreso";
    return await send(token, chatId, `${kind}: S/ ${movement.amount.toFixed(2)}\nCategoría: ${movement.category}\nDescripción: ${movement.description}\n\n¿Guardar en Fino?`, {
      inline_keyboard: [[{ text: "✅ Confirmar", callback_data: `ok:${nonce}` }, { text: "Cancelar", callback_data: `cancel:${nonce}` }]],
    });
  } catch (error) {
    const messages = { INVALID_CODE: "El código no existe o venció. Genera uno nuevo en Fino.", NOT_PREMIUM: "Esta conexión requiere Premium activo.", EXPIRED: "La confirmación venció. Escribe el movimiento nuevamente.", TOO_LARGE: "Tu respaldo alcanzó su límite. Exporta o elimina movimientos antiguos antes de continuar." };
    await send(token, chatId, messages[error.message] || "No pude completar la operación. Intenta nuevamente.");
  }
}

module.exports = { handleTelegramUpdate, premium };

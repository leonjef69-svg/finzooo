"use strict";

const crypto = require("node:crypto");
const { Buffer } = require("node:buffer");
const { FieldValue } = require("firebase-admin/firestore");
const { cleanAmount, parseLinkCode, parseMovement } = require("./telegram-parser");

const FLOW_MS = 10 * 60_000;
const MAX_USER_BYTES = 850_000;
const EXPENSE_CATS = [["comida", "Comida"], ["transporte", "Transporte"], ["compras", "Compras"], ["servicios", "Servicios"], ["salud", "Salud"], ["otros", "Otros"]];
const INCOME_CATS = [["salario", "Salario"], ["freelance", "Freelance"], ["venta", "Venta"], ["regalo", "Regalo"], ["inversiones", "Inversiones"], ["otro_ingreso", "Otros"]];
const METHOD_NAMES = { cash: "Efectivo", debit: "Débito", credit: "Crédito", transfer: "Transferencia", yape: "Yape", plin: "Plin" };

const date = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const time = () => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const monthKey = () => date().slice(0, 7);
const premium = (data, now = Date.now()) => data?.isPremium === true || (Number.isFinite(data?.premiumTrialStartedAt) && data.premiumTrialStartedAt <= now && data.premiumTrialStartedAt + 86_400_000 > now);

function api(token, method, body) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async response => { if (!response.ok) throw new Error(`Telegram ${method}: ${response.status}`); return response.json(); });
}
const send = (token, chatId, text, reply_markup) => api(token, "sendMessage", { chat_id: chatId, text, reply_markup });

function money(amount, currency = "PEN") {
  const symbols = { PEN: "S/", USD: "US$", EUR: "€", BOB: "Bs", MXN: "MX$", COP: "COL$", CLP: "CLP$", ARS: "ARS$" };
  const decimals = ["CLP", "COP", "ARS"].includes(currency) ? 0 : 2;
  return `${symbols[currency] || currency} ${Number(amount || 0).toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function previousBalance(data, until) {
  const budgets = data.budgets || {}, txs = Array.isArray(data.transactions) ? data.transactions : [], cuts = Array.isArray(data.carryoverCleared) ? data.carryoverCleared : [];
  if (cuts.includes(until)) return 0;
  const net = {};
  for (const [month, amount] of Object.entries(budgets)) if (/^\d{4}-\d{2}$/.test(month) && month < until) net[month] = (net[month] || 0) + Number(amount || 0);
  for (const tx of txs) {
    const month = String(tx.date || "").slice(0, 7);
    if (month < until) net[month] = (net[month] || 0) + (tx.type === "income" ? Number(tx.amount || 0) : -Number(tx.amount || 0));
  }
  let balance = 0;
  for (const month of [...new Set([...Object.keys(net), ...cuts.filter(item => item < until)])].sort()) { if (cuts.includes(month)) balance = 0; balance += net[month] || 0; }
  return balance;
}

function personalFigures(data) {
  const month = monthKey(), txs = (Array.isArray(data.transactions) ? data.transactions : []).filter(tx => String(tx.date || "").startsWith(month));
  const spent = txs.filter(tx => tx.type === "expense" && !tx.internalTransfer).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const income = txs.filter(tx => tx.type === "income" && !tx.internalTransfer).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const out = txs.filter(tx => tx.type === "expense" && tx.internalTransfer).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const incoming = txs.filter(tx => tx.type === "income" && tx.internalTransfer).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const budget = Number(data.budgets?.[month] || 0);
  return { budget, spent, income, balance: budget + previousBalance(data, month) + income - spent - out + incoming };
}

function sharedFigures(items) {
  return items.reduce((result, item) => { item.tipo === "ingreso" ? result.income += Number(item.monto || 0) : result.spent += Number(item.monto || 0); result.balance = result.income - result.spent; return result; }, { income: 0, spent: 0, balance: 0 });
}

async function connectionFor(db, chatId) {
  const connection = await db.collection("telegramConnections").doc(String(chatId)).get();
  if (!connection.exists) return null;
  const uid = connection.data().uid;
  const [status, user] = await Promise.all([db.collection("telegramUsers").doc(uid).get(), db.collection("users").doc(uid).get()]);
  return status.exists && status.data().active === true && status.data().chatId === String(chatId) && user.exists && premium(user.data()) ? { uid, user: user.data() } : null;
}
const saveFlow = (db, chatId, flow) => db.collection("telegramDrafts").doc(String(chatId)).set({ ...flow, expiresAtMs: Date.now() + FLOW_MS });
async function getFlow(db, chatId) { const snap = await db.collection("telegramDrafts").doc(String(chatId)).get(); return snap.exists && snap.data().expiresAtMs >= Date.now() ? snap.data() : null; }

async function link(db, token, chatId, code) {
  const ref = db.collection("telegramLinkRequests").doc(code.toUpperCase());
  await db.runTransaction(async tx => {
    const request = await tx.get(ref);
    if (!request.exists || request.data().used || request.data().expiresAtMs < Date.now()) throw new Error("INVALID_CODE");
    const uid = request.data().uid, userRef = db.collection("users").doc(uid), statusRef = db.collection("telegramUsers").doc(uid), connectionRef = db.collection("telegramConnections").doc(String(chatId));
    const [user, oldStatus, occupied] = await Promise.all([tx.get(userRef), tx.get(statusRef), tx.get(connectionRef)]);
    if (!user.exists || !premium(user.data())) throw new Error("NOT_PREMIUM");
    if (oldStatus.exists && oldStatus.data().chatId !== String(chatId)) tx.delete(db.collection("telegramConnections").doc(oldStatus.data().chatId));
    if (occupied.exists && occupied.data().uid !== uid) tx.delete(db.collection("telegramUsers").doc(occupied.data().uid));
    tx.set(connectionRef, { uid, linkedAtMs: Date.now() }); tx.set(statusRef, { active: true, chatId: String(chatId), linkedAtMs: Date.now() }); tx.update(ref, { used: true, usedAtMs: Date.now() });
  });
  return showMain(db, token, chatId, "✅ Telegram conectado con Fino.");
}

async function showMain(db, token, chatId, heading = "¿Dónde quieres registrar?") {
  await db.collection("telegramDrafts").doc(String(chatId)).delete().catch(() => {});
  return send(token, chatId, heading, { inline_keyboard: [[{ text: "👤 Personal", callback_data: "space:personal" }], [{ text: "👨‍👩‍👧 Familia", callback_data: "space:family" }, { text: "📦 Cajas", callback_data: "space:boxes" }]] });
}

async function activeFamily(db, uid) {
  const index = await db.collection("familyUsers").doc(uid).get(), id = index.exists ? String(index.data().activeFamilyId || "") : "";
  if (!id) return null;
  const [space, member] = await Promise.all([db.collection("familySpaces").doc(id).get(), db.collection("familySpaces").doc(id).collection("members").doc(uid).get()]);
  if (!space.exists || !member.exists || [space.data().closed, space.data().closing, space.data().deleting].includes(true)) return null;
  return { kind: "family", id, name: String(space.data().nombre || "Familia"), currency: "PEN" };
}

async function boxesFor(db, uid) {
  const links = await db.collection("boxUsers").doc(uid).collection("spaces").get();
  const boxes = await Promise.all(links.docs.slice(0, 20).map(async link => {
    const [space, member] = await Promise.all([db.collection("boxSpaces").doc(link.id).get(), db.collection("boxSpaces").doc(link.id).collection("members").doc(uid).get()]);
    if (!space.exists || !member.exists || [space.data().closed, space.data().closing, space.data().deleting].includes(true) || space.data().migrationComplete === false) return null;
    return { kind: "box", id: link.id, name: String(space.data().nombre || "Caja"), currency: String(space.data().currency || "PEN") };
  }));
  return boxes.filter(Boolean);
}

async function showSpace(db, token, chatId, connection, space) {
  let figures;
  if (space.kind === "personal") figures = personalFigures(connection.user);
  else { const root = space.kind === "family" ? "familySpaces" : "boxSpaces"; const snap = await db.collection(root).doc(space.id).collection("movements").get(); figures = sharedFigures(snap.docs.map(item => item.data())); }
  await saveFlow(db, chatId, { kind: "session", uid: connection.uid, space });
  const budget = space.kind === "personal" ? `\n🎯 Presupuesto: ${figures.budget > 0 ? money(figures.budget, space.currency) : "Sin definir"}` : "";
  return send(token, chatId, `📌 ${space.name}\n💰 Saldo: ${money(figures.balance, space.currency)}${budget}\n🟢 Ingresos: ${money(figures.income, space.currency)} · 🔴 Gastos: ${money(figures.spent, space.currency)}`, { inline_keyboard: [[{ text: "➖ Gasto", callback_data: "new:expense" }, { text: "➕ Ingreso", callback_data: "new:income" }], [{ text: "⬅️ Espacios", callback_data: "menu" }]] });
}

function amountDescription(text, type) {
  const match = String(text || "").trim().match(/^(?:s\/?\s*)?([\d.,]+)(?:\s+(.+))?$/i);
  if (!match) return null;
  const amount = cleanAmount(match[1]);
  return amount === null ? null : { amount, description: String(match[2] || (type === "expense" ? "Gasto desde Telegram" : "Ingreso desde Telegram")).slice(0, 120) };
}
function suggestedCategory(type, description) { return parseMovement(`${type === "expense" ? "gasto" : "ingreso"} 1 ${description}`)?.category || (type === "expense" ? "otros" : "otro_ingreso"); }
function categoryKeyboard(type, selected) {
  const cats = [...(type === "expense" ? EXPENSE_CATS : INCOME_CATS)].sort((a, b) => a[0] === selected ? -1 : b[0] === selected ? 1 : 0);
  return [cats.slice(0, 3), cats.slice(3)].map(row => row.map(([id, label]) => ({ text: id === selected ? `✓ ${label}` : label, callback_data: `cat:${id}` })));
}
function methodKeyboard(currency) {
  const rows = [["cash", "debit"], ["credit", "transfer"]];
  if (currency === "PEN") rows.push(["yape", "plin"]); else if (currency === "BOB") rows.push(["yape"]);
  return rows.map(row => row.map(id => ({ text: METHOD_NAMES[id], callback_data: `method:${id}` })));
}

async function askConfirmation(db, token, chatId, flow) {
  const nonce = crypto.randomBytes(5).toString("hex");
  await saveFlow(db, chatId, { ...flow, step: "confirm", nonce });
  return send(token, chatId, `📌 ${flow.space.name}\n${flow.type === "expense" ? "Gasto" : "Ingreso"}: ${money(flow.amount, flow.space.currency)}\n${flow.description}\nCategoría: ${flow.category}\nMétodo: ${METHOD_NAMES[flow.method] || flow.method}\n\n¿Guardar?`, { inline_keyboard: [[{ text: "✅ Confirmar", callback_data: `ok:${nonce}` }, { text: "Cancelar", callback_data: "cancel" }]] });
}

async function confirm(db, token, chatId, nonce) {
  const flowRef = db.collection("telegramDrafts").doc(String(chatId)), snap = await flowRef.get();
  if (!snap.exists || snap.data().step !== "confirm" || snap.data().nonce !== nonce || snap.data().expiresAtMs < Date.now()) throw new Error("EXPIRED");
  const flow = snap.data(), connection = await connectionFor(db, chatId);
  if (!connection || connection.uid !== flow.uid) throw new Error("NOT_LINKED");
  if (flow.space.kind === "personal") {
    await db.runTransaction(async tx => {
      const ref = db.collection("users").doc(connection.uid), user = await tx.get(ref);
      if (!user.exists || !premium(user.data())) throw new Error("NOT_PREMIUM");
      const data = user.data(), transactions = Array.isArray(data.transactions) ? data.transactions : [];
      let id = Date.now() * 4096 + crypto.randomInt(4096); while (transactions.some(item => item.id === id)) id++;
      const next = [...transactions, { id, type: flow.type, amount: flow.amount, category: flow.category, date: date(), time: time(), method: flow.method, description: flow.description, notes: "", origin: "manual" }];
      if (Buffer.byteLength(JSON.stringify({ ...data, transactions: next }), "utf8") > MAX_USER_BYTES) throw new Error("TOO_LARGE");
      tx.update(ref, { transactions: next });
    });
  } else {
    const root = flow.space.kind === "family" ? "familySpaces" : "boxSpaces", spaceRef = db.collection(root).doc(flow.space.id);
    const [space, member] = await Promise.all([spaceRef.get(), spaceRef.collection("members").doc(connection.uid).get()]);
    if (!space.exists || !member.exists || [space.data().closed, space.data().closing, space.data().deleting].includes(true) || space.data().migrationComplete === false) throw new Error("SPACE_UNAVAILABLE");
    await spaceRef.collection("movements").add({ tipo: flow.type === "income" ? "ingreso" : "gasto", monto: flow.amount, descripcion: flow.description, method: flow.method, fecha: date(), creadoPor: connection.uid, creadoEn: FieldValue.serverTimestamp() });
  }
  await flowRef.delete();
  const fresh = await db.collection("users").doc(connection.uid).get();
  await send(token, chatId, "✅ Guardado en Fino.");
  return showSpace(db, token, chatId, { ...connection, user: fresh.data() }, flow.space);
}

async function callbackAction(db, token, chatId, data, connection) {
  if (data === "menu") return showMain(db, token, chatId);
  if (data === "space:personal") return showSpace(db, token, chatId, connection, { kind: "personal", id: connection.uid, name: "Personal", currency: String(connection.user.userCurrency || "PEN") });
  if (data === "space:family") { const family = await activeFamily(db, connection.uid); return family ? showSpace(db, token, chatId, connection, family) : send(token, chatId, "No tienes una Familia activa.", { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "menu" }]] }); }
  if (data === "space:boxes") { const boxes = await boxesFor(db, connection.uid); return boxes.length ? send(token, chatId, "Elige una caja:", { inline_keyboard: [...boxes.map(box => [{ text: `📦 ${box.name}`, callback_data: `box:${box.id}` }]), [{ text: "⬅️ Volver", callback_data: "menu" }]] }) : send(token, chatId, "No tienes cajas compartidas activas.", { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "menu" }]] }); }
  if (data.startsWith("box:")) { const box = (await boxesFor(db, connection.uid)).find(item => item.id === data.slice(4)); if (!box) throw new Error("SPACE_UNAVAILABLE"); return showSpace(db, token, chatId, connection, box); }
  const flow = await getFlow(db, chatId); if (!flow || flow.uid !== connection.uid) throw new Error("EXPIRED");
  if (data.startsWith("new:") && flow.kind === "session") { const type = data.slice(4); if (!["expense", "income"].includes(type)) throw new Error("EXPIRED"); await saveFlow(db, chatId, { ...flow, kind: "wizard", step: "amount", type }); return send(token, chatId, "Escribe monto y descripción juntos.\nEjemplo: 20 almuerzo\n\n/cancelar para salir"); }
  if (data.startsWith("cat:") && flow.step === "category") { const next = { ...flow, category: data.slice(4), step: "method" }; await saveFlow(db, chatId, next); return send(token, chatId, "Método de pago:", { inline_keyboard: methodKeyboard(flow.space.currency) }); }
  if (data.startsWith("method:") && flow.step === "method") return askConfirmation(db, token, chatId, { ...flow, method: data.slice(7) });
  if (data.startsWith("ok:") && flow.step === "confirm") return confirm(db, token, chatId, data.slice(3));
  if (data === "cancel") return showMain(db, token, chatId, "Movimiento cancelado.");
  throw new Error("EXPIRED");
}

async function handleTelegramUpdate({ db, token, update }) {
  const message = update.message, callback = update.callback_query, chatId = message?.chat?.id ?? callback?.message?.chat?.id;
  if (!chatId) return;
  try {
    if (callback) { await api(token, "answerCallbackQuery", { callback_query_id: callback.id }); const connection = await connectionFor(db, chatId); if (!connection) throw new Error("NOT_LINKED"); return callbackAction(db, token, chatId, String(callback.data || ""), connection); }
    const text = String(message?.text || "").trim(), code = parseLinkCode(text);
    if (code) return link(db, token, chatId, code);
    const connection = await connectionFor(db, chatId);
    if (/^\/start\b/i.test(text)) return connection ? showMain(db, token, chatId) : send(token, chatId, "Abre Fino → Ajustes → Registrar por Telegram → Conectar Telegram.");
    if (!connection) throw new Error("NOT_LINKED");
    if (/^\/(menu|inicio)$/i.test(text)) return showMain(db, token, chatId);
    if (/^\/cancelar$/i.test(text)) return showMain(db, token, chatId, "Operación cancelada.");
    const flow = await getFlow(db, chatId);
    if (flow?.step === "amount") {
      const value = amountDescription(text, flow.type); if (!value) return send(token, chatId, "Escribe monto y descripción. Ejemplo: 20 almuerzo");
      const next = { ...flow, ...value, category: suggestedCategory(flow.type, value.description), step: "category" }; await saveFlow(db, chatId, next);
      return send(token, chatId, `${money(value.amount, flow.space.currency)} · ${value.description}\nElige categoría:`, { inline_keyboard: categoryKeyboard(flow.type, next.category) });
    }
    const movement = parseMovement(text);
    if (movement) return askConfirmation(db, token, chatId, { kind: "wizard", uid: connection.uid, space: { kind: "personal", id: connection.uid, name: "Personal", currency: String(connection.user.userCurrency || "PEN") }, type: movement.type, amount: movement.amount, description: movement.description, category: movement.category, method: "cash" });
    return showMain(db, token, chatId, "Usa los botones o escribe: gasto 20 comida.");
  } catch (error) {
    const messages = { INVALID_CODE: "El código no existe o venció.", NOT_PREMIUM: "Esta conexión requiere Premium activo.", NOT_LINKED: "Conecta Telegram desde Ajustes en Fino.", EXPIRED: "La operación venció. Empieza nuevamente.", TOO_LARGE: "Tu respaldo alcanzó su límite.", SPACE_UNAVAILABLE: "Ese espacio ya no está disponible." };
    return send(token, chatId, messages[error.message] || "No pude completar la operación. Intenta nuevamente.");
  }
}

module.exports = { handleTelegramUpdate, premium, previousBalance, personalFigures, sharedFigures, amountDescription };

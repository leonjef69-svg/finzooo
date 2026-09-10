"use strict";

const crypto = require("node:crypto");
const { Buffer } = require("node:buffer");
const { FieldValue } = require("firebase-admin/firestore");
const { cleanAmount, parseLinkCode, parseNaturalMovement, parseQuickEntry } = require("./telegram-parser");

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
  return fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) })
    .then(async response => {
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(`Telegram ${method}: ${result.description || response.status}`);
      return result;
    });
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
  for (const item of txs) {
    const month = String(item.date || "").slice(0, 7);
    if (month < until) net[month] = (net[month] || 0) + (item.type === "income" ? Number(item.amount || 0) : -Number(item.amount || 0));
  }
  let balance = 0;
  for (const month of [...new Set([...Object.keys(net), ...cuts.filter(item => item < until)])].sort()) { if (cuts.includes(month)) balance = 0; balance += net[month] || 0; }
  return balance;
}

function personalFigures(data) {
  const month = monthKey(), txs = (Array.isArray(data.transactions) ? data.transactions : []).filter(item => String(item.date || "").startsWith(month));
  const spent = txs.filter(item => item.type === "expense" && !item.internalTransfer).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const income = txs.filter(item => item.type === "income" && !item.internalTransfer).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const out = txs.filter(item => item.type === "expense" && item.internalTransfer).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const incoming = txs.filter(item => item.type === "income" && item.internalTransfer).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const budget = Number(data.budgets?.[month] || 0);
  return { budget, spent, income, balance: budget + previousBalance(data, month) + income - spent - out + incoming };
}

function sharedFigures(items) {
  return items.reduce((result, item) => {
    if (item.tipo === "ingreso") result.income += Number(item.monto || 0);
    else result.spent += Number(item.monto || 0);
    result.balance = result.income - result.spent;
    return result;
  }, { income: 0, spent: 0, balance: 0 });
}

async function connectionFor(db, chatId) {
  const connection = await db.collection("telegramConnections").doc(String(chatId)).get();
  if (!connection.exists) return null;
  const settings = connection.data(), uid = settings.uid;
  const [status, user] = await Promise.all([db.collection("telegramUsers").doc(uid).get(), db.collection("users").doc(uid).get()]);
  return status.exists && status.data().active === true && status.data().chatId === String(chatId) && user.exists && premium(user.data())
    ? { uid, user: user.data(), settings }
    : null;
}

const saveFlow = (db, chatId, flow) => db.collection("telegramDrafts").doc(String(chatId)).set({ ...flow, expiresAtMs: Date.now() + FLOW_MS });
async function getFlow(db, chatId) { const snap = await db.collection("telegramDrafts").doc(String(chatId)).get(); return snap.exists && snap.data().expiresAtMs >= Date.now() ? snap.data() : null; }
const saveUndo = (db, chatId, action) => db.collection("telegramUndo").doc(String(chatId)).set({ uid: action.uid, action, expiresAtMs: Date.now() + FLOW_MS });
async function getUndo(db, chatId) { const snap = await db.collection("telegramUndo").doc(String(chatId)).get(); return snap.exists && snap.data().expiresAtMs >= Date.now() ? snap.data() : null; }

function safeSpace(space) {
  return { kind: space.kind, id: String(space.id), name: String(space.name).slice(0, 35), currency: String(space.currency || "PEN") };
}
async function remember(db, chatId, space, extra = {}) {
  await db.collection("telegramConnections").doc(String(chatId)).set({ lastSpace: safeSpace(space), ...extra }, { merge: true });
}

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
    tx.set(connectionRef, { uid, linkedAtMs: Date.now() });
    tx.set(statusRef, { active: true, chatId: String(chatId), linkedAtMs: Date.now() });
    tx.update(ref, { used: true, usedAtMs: Date.now() });
  });
  return showMain(db, token, chatId, "✅ Telegram conectado con Fino.");
}

async function showMain(db, token, chatId, heading = "¿Dónde quieres registrar?") {
  await db.collection("telegramDrafts").doc(String(chatId)).delete().catch(() => {});
  return send(token, chatId, heading, { inline_keyboard: [[{ text: "👤 Personal", callback_data: "space:personal" }], [{ text: "👨‍👩‍👧 Familia", callback_data: "space:family" }, { text: "📦 Cajas", callback_data: "space:boxes" }]] });
}

async function activeFamily(db, uid, currency = "PEN") {
  const index = await db.collection("familyUsers").doc(uid).get(), id = index.exists ? String(index.data().activeFamilyId || "") : "";
  if (!id) return null;
  const [space, member] = await Promise.all([db.collection("familySpaces").doc(id).get(), db.collection("familySpaces").doc(id).collection("members").doc(uid).get()]);
  if (!space.exists || !member.exists || [space.data().closed, space.data().closing, space.data().deleting].includes(true)) return null;
  return { kind: "family", id, name: String(space.data().nombre || "Familia"), currency: String(space.data().currency || currency) };
}

async function boxesFor(db, uid) {
  const links = await db.collection("boxUsers").doc(uid).collection("spaces").get();
  const boxes = await Promise.all(links.docs.slice(0, 20).map(async item => {
    const [space, member] = await Promise.all([db.collection("boxSpaces").doc(item.id).get(), db.collection("boxSpaces").doc(item.id).collection("members").doc(uid).get()]);
    if (!space.exists || !member.exists || [space.data().closed, space.data().closing, space.data().deleting].includes(true) || space.data().migrationComplete === false) return null;
    return { kind: "box", id: item.id, name: String(space.data().nombre || "Caja"), currency: String(space.data().currency || "PEN") };
  }));
  return boxes.filter(Boolean);
}

async function resolveRememberedSpace(db, connection) {
  const saved = connection.settings?.lastSpace;
  if (saved?.kind === "family") {
    const family = await activeFamily(db, connection.uid, String(connection.user.userCurrency || "PEN"));
    if (family?.id === saved.id) return family;
  }
  if (saved?.kind === "box") {
    const box = (await boxesFor(db, connection.uid)).find(item => item.id === saved.id);
    if (box) return box;
  }
  return { kind: "personal", id: connection.uid, name: "Personal", currency: String(connection.user.userCurrency || "PEN") };
}

function spaceKeyboard(space, personalCurrency) {
  const rows = [[{ text: "➖ Gasto", callback_data: "new:expense" }, { text: "➕ Ingreso", callback_data: "new:income" }]];
  if (space.kind !== "personal" && space.currency === personalCurrency) rows.push([{ text: "↗️ Transferir desde Personal", callback_data: "transfer" }]);
  rows.push([{ text: "⬅️ Cambiar espacio", callback_data: "menu" }]);
  return { inline_keyboard: rows };
}

async function showSpace(db, token, chatId, connection, space, heading = "") {
  let figures;
  if (space.kind === "personal") figures = personalFigures(connection.user);
  else {
    const root = space.kind === "family" ? "familySpaces" : "boxSpaces";
    const snap = await db.collection(root).doc(space.id).collection("movements").get();
    figures = sharedFigures(snap.docs.map(item => item.data()));
  }
  await Promise.all([saveFlow(db, chatId, { kind: "session", uid: connection.uid, space: safeSpace(space) }), remember(db, chatId, space)]);
  const budget = space.kind === "personal" ? `\n🎯 Presupuesto: ${figures.budget > 0 ? money(figures.budget, space.currency) : "Sin definir"}` : "";
  const prefix = heading ? `${heading}\n\n` : "";
  return send(token, chatId, `${prefix}📌 ${space.name}\n💰 Saldo: ${money(figures.balance, space.currency)}${budget}\n🟢 Ingresos: ${money(figures.income, space.currency)}\n🔴 Gastos: ${money(figures.spent, space.currency)}`, spaceKeyboard(space, String(connection.user.userCurrency || "PEN")));
}

function amountDescription(text, type) {
  const match = String(text || "").trim().match(/^(?:s\/?\s*)?([\d.,]+)(?:\s+(.+))?$/i);
  if (!match) return null;
  const amount = cleanAmount(match[1]);
  return amount === null ? null : { amount, description: String(match[2] || (type === "expense" ? "Gasto desde Telegram" : "Ingreso desde Telegram")).slice(0, 120) };
}

function quickOptions(connection, type) {
  return { fallbackMethod: connection.settings?.lastMethods?.[type] || "cash", country: String(connection.user.userCountry || "PE"), customCategories: connection.user.categoriasPropias || [] };
}
function categoryKeyboard(type, selected, customCategories = []) {
  const custom = (Array.isArray(customCategories) ? customCategories : []).filter(item => item?.tipo === type).slice(0, 6).map(item => [String(item.id), String(item.nombre).slice(0, 24)]);
  const cats = [...(type === "expense" ? EXPENSE_CATS : INCOME_CATS), ...custom].sort((a, b) => a[0] === selected ? -1 : b[0] === selected ? 1 : 0), rows = [];
  for (let index = 0; index < cats.length; index += 2) rows.push(cats.slice(index, index + 2).map(([id, label]) => ({ text: id === selected ? `✓ ${label}` : label, callback_data: `cat:${id}` })));
  rows.push([{ text: "Cancelar", callback_data: "cancel" }]);
  return rows;
}
function allowedMethods(country) {
  const methods = ["cash", "debit", "credit", "transfer"];
  if (["PE", "BO"].includes(country)) methods.push("yape");
  if (country === "PE") methods.push("plin");
  return methods;
}
function methodKeyboard(country, selected) {
  const methods = allowedMethods(country), rows = [];
  for (let index = 0; index < methods.length; index += 2) rows.push(methods.slice(index, index + 2).map(id => ({ text: id === selected ? `✓ ${METHOD_NAMES[id]}` : METHOD_NAMES[id], callback_data: `method:${id}` })));
  rows.push([{ text: "Cancelar", callback_data: "cancel" }]);
  return rows;
}

function operationKey(operationId) {
  const raw = String(operationId ?? crypto.randomBytes(8).toString("hex"));
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || crypto.randomBytes(8).toString("hex");
}

function personalIdForOperation(key) {
  const suffix = BigInt(`0x${crypto.createHash("sha256").update(key).digest("hex").slice(0, 12)}`) % 800_000_000_000_000n;
  return Number(8_000_000_000_000_000n + suffix);
}

function claimOperation(tx, connectionRef, connectionData, key) {
  const recent = Array.isArray(connectionData.recentUpdateIds) ? connectionData.recentUpdateIds.map(String) : [];
  if (recent.includes(key)) return false;
  tx.update(connectionRef, { recentUpdateIds: [...recent.slice(-19), key] });
  return true;
}

function assertLiveConnection(connectionSnap, statusSnap, uid, chatId) {
  if (!connectionSnap.exists || connectionSnap.data().uid !== uid || !statusSnap.exists || statusSnap.data().active !== true || statusSnap.data().chatId !== String(chatId)) throw new Error("NOT_LINKED");
}

async function saveSimpleMovement(db, chatId, connection, space, movement, operationId) {
  const key = operationKey(operationId), chatConnectionRef = db.collection("telegramConnections").doc(String(chatId));
  if (space.kind === "personal") {
    let saved, action;
    await db.runTransaction(async tx => {
      const ref = db.collection("users").doc(connection.uid), statusRef = db.collection("telegramUsers").doc(connection.uid);
      const [user, connectionSnap, statusSnap] = await Promise.all([tx.get(ref), tx.get(chatConnectionRef), tx.get(statusRef)]);
      assertLiveConnection(connectionSnap, statusSnap, connection.uid, chatId);
      if (!user.exists || !premium(user.data())) throw new Error("NOT_PREMIUM");
      const data = user.data(), transactions = Array.isArray(data.transactions) ? data.transactions : [];
      const id = personalIdForOperation(key);
      saved = { id, type: movement.type, amount: movement.amount, category: movement.category, date: date(), time: time(), method: movement.method, description: movement.description, notes: "", origin: "manual" };
      action = { uid: connection.uid, kind: "movement", space: safeSpace(space), personalTransactionId: id, movement: saved };
      if (!claimOperation(tx, chatConnectionRef, connectionSnap.data() || {}, key)) return;
      if (transactions.some(item => item.id === id)) throw new Error("DUPLICATE_ID");
      const next = [...transactions, saved];
      if (Buffer.byteLength(JSON.stringify({ ...data, transactions: next }), "utf8") > MAX_USER_BYTES) throw new Error("TOO_LARGE");
      tx.update(ref, { transactions: next });
    });
    return action;
  }
  const root = space.kind === "family" ? "familySpaces" : "boxSpaces", spaceRef = db.collection(root).doc(space.id), movementRef = spaceRef.collection("movements").doc(`telegram_${key}`);
  const saved = { tipo: movement.type === "income" ? "ingreso" : "gasto", monto: movement.amount, descripcion: movement.description, method: movement.method, fecha: date(), creadoPor: connection.uid, creadoEn: FieldValue.serverTimestamp() };
  const action = { uid: connection.uid, kind: "movement", space: safeSpace(space), sharedMovementId: movementRef.id, movement: { ...saved, creadoEn: Date.now() } };
  await db.runTransaction(async tx => {
    const statusRef = db.collection("telegramUsers").doc(connection.uid);
    const [spaceSnap, member, connectionSnap, statusSnap] = await Promise.all([tx.get(spaceRef), tx.get(spaceRef.collection("members").doc(connection.uid)), tx.get(chatConnectionRef), tx.get(statusRef)]);
    assertLiveConnection(connectionSnap, statusSnap, connection.uid, chatId);
    if (!spaceSnap.exists || !member.exists || [spaceSnap.data().closed, spaceSnap.data().closing, spaceSnap.data().deleting].includes(true) || spaceSnap.data().migrationComplete === false) throw new Error("SPACE_UNAVAILABLE");
    if (!claimOperation(tx, chatConnectionRef, connectionSnap.data() || {}, key)) return;
    tx.set(movementRef, saved);
  });
  return action;
}

function afterSaveKeyboard(action) {
  const rows = [[{ text: "➖ Otro gasto", callback_data: "again:expense" }, { text: "➕ Otro ingreso", callback_data: "again:income" }]];
  if (action.kind === "movement") rows.push([{ text: "⚙️ Más opciones", callback_data: "options" }, { text: "🔄 Cambiar espacio", callback_data: "menu" }]);
  else rows.push([{ text: "🔄 Cambiar espacio", callback_data: "menu" }]);
  rows.push([{ text: "↩️ Deshacer", callback_data: "undo" }]);
  return { inline_keyboard: rows };
}

function quickPrompt(space, type) {
  const isExpense = type === "expense";
  return `${isExpense ? "➖ Gasto" : "➕ Ingreso"} en ${space.name}\n\nMonto:\nDescripción:\nMétodo de pago:\n\nEjemplo: ${isExpense ? "20 almuerzo Yape" : "500 sueldo Transferencia"}`;
}

function savedMovementMessage(space, movement, label = "Guardado") {
  const description = String(movement.description || "Sin descripción").trim();
  const shownDescription = description.charAt(0).toUpperCase() + description.slice(1);
  const kind = movement.type === "expense" ? "Gasto" : "Ingreso";
  const heading = label === "Guardado" ? `${kind} guardado` : label;
  return `✅ ${heading} en ${space.name}\n\nMonto: ${money(movement.amount, space.currency)}\nDescripción: ${shownDescription}\nMétodo de pago: ${METHOD_NAMES[movement.method] || movement.method}`;
}

async function postSave(db, token, chatId, connection, space, movement, action, label = "Guardado") {
  const lastMethods = { ...(connection.settings?.lastMethods || {}), [movement.type]: movement.method };
  await Promise.all([saveUndo(db, chatId, action), db.collection("telegramDrafts").doc(String(chatId)).delete().catch(() => {}), remember(db, chatId, space, { lastMethods })]);
  return send(token, chatId, savedMovementMessage(space, movement, label), afterSaveKeyboard(action));
}
async function registerQuick(db, token, chatId, connection, space, movement, operationId) {
  const action = await saveSimpleMovement(db, chatId, connection, space, movement, operationId);
  return postSave(db, token, chatId, connection, space, movement, action);
}

async function showTransferConfirmation(db, token, chatId, connection, flow, value) {
  if (flow.space.currency !== String(connection.user.userCurrency || "PEN")) throw new Error("CURRENCY_MISMATCH");
  const available = personalFigures(connection.user).balance;
  if (value.amount > available) throw new Error("INSUFFICIENT");
  const nonce = crypto.randomBytes(5).toString("hex"), next = { ...flow, step: "transfer_confirm", amount: value.amount, description: value.description, nonce };
  await saveFlow(db, chatId, next);
  return send(token, chatId, `Transferir ${money(value.amount, flow.space.currency)} desde Personal a ${flow.space.name}?\n\nPersonal: ${money(available, flow.space.currency)} → ${money(available - value.amount, flow.space.currency)}\n${flow.space.name}: +${money(value.amount, flow.space.currency)}`, { inline_keyboard: [[{ text: "✅ Transferir", callback_data: `transfer_ok:${nonce}` }, { text: "Cancelar", callback_data: "cancel" }]] });
}

async function confirmTransfer(db, token, chatId, connection, nonce, operationId) {
  const flow = await getFlow(db, chatId);
  if (!flow || flow.uid !== connection.uid || flow.step !== "transfer_confirm" || flow.nonce !== nonce) throw new Error("EXPIRED");
  const key = operationKey(operationId), root = flow.space.kind === "family" ? "familySpaces" : "boxSpaces", spaceRef = db.collection(root).doc(flow.space.id), movementRef = spaceRef.collection("movements").doc(`telegram_${key}`);
  const personalTransactionId = personalIdForOperation(key), action = { uid: connection.uid, kind: "transfer", space: safeSpace(flow.space), sharedMovementId: movementRef.id, personalTransactionId };
  await db.runTransaction(async tx => {
    const userRef = db.collection("users").doc(connection.uid), memberRef = spaceRef.collection("members").doc(connection.uid), connectionRef = db.collection("telegramConnections").doc(String(chatId)), statusRef = db.collection("telegramUsers").doc(connection.uid);
    const [user, space, member, connectionSnap, statusSnap] = await Promise.all([tx.get(userRef), tx.get(spaceRef), tx.get(memberRef), tx.get(connectionRef), tx.get(statusRef)]);
    assertLiveConnection(connectionSnap, statusSnap, connection.uid, chatId);
    if (!user.exists || !premium(user.data())) throw new Error("NOT_PREMIUM");
    if (!space.exists || !member.exists || [space.data().closed, space.data().closing, space.data().deleting].includes(true) || space.data().migrationComplete === false) throw new Error("SPACE_UNAVAILABLE");
    if (flow.space.currency !== String(user.data().userCurrency || "PEN")) throw new Error("CURRENCY_MISMATCH");
    if (personalFigures(user.data()).balance < flow.amount) throw new Error("INSUFFICIENT");
    const transactions = Array.isArray(user.data().transactions) ? user.data().transactions : [];
    if (!claimOperation(tx, connectionRef, connectionSnap.data() || {}, key)) return;
    if (transactions.some(item => item.id === personalTransactionId)) throw new Error("DUPLICATE_ID");
    const personalMovement = { id: personalTransactionId, type: "expense", amount: flow.amount, category: "otros", date: date(), time: time(), method: "transfer", description: `Transferencia a ${flow.space.name}`, notes: "", origin: "manual", internalTransfer: flow.space.kind, internalTransferLink: flow.space.id };
    const next = [...transactions, personalMovement];
    if (Buffer.byteLength(JSON.stringify({ ...user.data(), transactions: next }), "utf8") > MAX_USER_BYTES) throw new Error("TOO_LARGE");
    tx.update(userRef, { transactions: next });
    tx.set(movementRef, { tipo: "ingreso", monto: flow.amount, descripcion: flow.description === "Ingreso desde Telegram" ? "Transferencia desde Personal" : flow.description, method: "transfer", fecha: date(), creadoPor: connection.uid, creadoEn: FieldValue.serverTimestamp(), personalTransactionId, personalOwnerUid: connection.uid });
  });
  const movement = { type: "income", amount: flow.amount, description: flow.description === "Ingreso desde Telegram" ? "Transferencia desde Personal" : flow.description, method: "transfer" };
  return postSave(db, token, chatId, connection, flow.space, movement, action, "Transferencia realizada");
}

async function undoLast(db, token, chatId, connection) {
  const saved = await getUndo(db, chatId);
  if (!saved || saved.uid !== connection.uid) throw new Error("NOTHING_TO_UNDO");
  const action = saved.action;
  if (action.space.kind === "personal") {
    await db.runTransaction(async tx => {
      const ref = db.collection("users").doc(connection.uid), connectionRef = db.collection("telegramConnections").doc(String(chatId)), statusRef = db.collection("telegramUsers").doc(connection.uid);
      const [user, connectionSnap, statusSnap] = await Promise.all([tx.get(ref), tx.get(connectionRef), tx.get(statusRef)]);
      assertLiveConnection(connectionSnap, statusSnap, connection.uid, chatId);
      const transactions = Array.isArray(user.data()?.transactions) ? user.data().transactions : [];
      const current = transactions.find(item => item.id === action.personalTransactionId);
      if (!current || current.type !== action.movement.type || Number(current.amount) !== Number(action.movement.amount)) throw new Error("NOTHING_TO_UNDO");
      tx.update(ref, { transactions: transactions.filter(item => item.id !== action.personalTransactionId) });
    });
  } else {
    const root = action.space.kind === "family" ? "familySpaces" : "boxSpaces", spaceRef = db.collection(root).doc(action.space.id), movementRef = spaceRef.collection("movements").doc(action.sharedMovementId);
    await db.runTransaction(async tx => {
      const userRef = db.collection("users").doc(connection.uid), memberRef = spaceRef.collection("members").doc(connection.uid), connectionRef = db.collection("telegramConnections").doc(String(chatId)), statusRef = db.collection("telegramUsers").doc(connection.uid);
      const reads = action.kind === "transfer"
        ? await Promise.all([tx.get(spaceRef), tx.get(memberRef), tx.get(movementRef), tx.get(userRef), tx.get(connectionRef), tx.get(statusRef)])
        : await Promise.all([tx.get(spaceRef), tx.get(memberRef), tx.get(movementRef), Promise.resolve(null), tx.get(connectionRef), tx.get(statusRef)]);
      const [space, member, movement, user, connectionSnap, statusSnap] = reads;
      assertLiveConnection(connectionSnap, statusSnap, connection.uid, chatId);
      if (!space.exists || !member.exists || !movement.exists || [space.data().closed, space.data().closing, space.data().deleting].includes(true) || space.data().migrationComplete === false || movement.data().creadoPor !== connection.uid) throw new Error("NOTHING_TO_UNDO");
      if (action.kind === "transfer") {
        if (movement.data().personalOwnerUid !== connection.uid || movement.data().personalTransactionId !== action.personalTransactionId) throw new Error("NOTHING_TO_UNDO");
        const transactions = Array.isArray(user.data()?.transactions) ? user.data().transactions : [];
        const linked = transactions.find(item => item.id === action.personalTransactionId && item.internalTransfer === action.space.kind && item.internalTransferLink === action.space.id);
        if (!linked) throw new Error("NOTHING_TO_UNDO");
        tx.update(userRef, { transactions: transactions.filter(item => item.id !== action.personalTransactionId) });
      } else if (movement.data().tipo !== action.movement.tipo || Number(movement.data().monto) !== Number(action.movement.monto)) throw new Error("NOTHING_TO_UNDO");
      tx.delete(movementRef);
    });
  }
  await db.collection("telegramUndo").doc(String(chatId)).delete();
  const fresh = await connectionFor(db, chatId), space = await resolveRememberedSpace(db, fresh);
  return showSpace(db, token, chatId, fresh, space, "↩️ Último movimiento deshecho.");
}

async function editLast(db, token, chatId, connection, flow, method) {
  const saved = await getUndo(db, chatId);
  if (!saved || saved.uid !== connection.uid || saved.action.kind !== "movement") throw new Error("NOTHING_TO_EDIT");
  const action = saved.action, category = flow.category || action.movement.category;
  if (action.space.kind === "personal") {
    await db.runTransaction(async tx => {
      const ref = db.collection("users").doc(connection.uid), connectionRef = db.collection("telegramConnections").doc(String(chatId)), statusRef = db.collection("telegramUsers").doc(connection.uid);
      const [user, connectionSnap, statusSnap] = await Promise.all([tx.get(ref), tx.get(connectionRef), tx.get(statusRef)]);
      assertLiveConnection(connectionSnap, statusSnap, connection.uid, chatId);
      const transactions = Array.isArray(user.data()?.transactions) ? user.data().transactions : [], index = transactions.findIndex(item => item.id === action.personalTransactionId);
      if (index < 0) throw new Error("NOTHING_TO_EDIT");
      const next = [...transactions]; next[index] = { ...next[index], category, method };
      if (Buffer.byteLength(JSON.stringify({ ...user.data(), transactions: next }), "utf8") > MAX_USER_BYTES) throw new Error("TOO_LARGE");
      tx.update(ref, { transactions: next });
    });
    action.movement = { ...action.movement, category, method };
  } else {
    const root = action.space.kind === "family" ? "familySpaces" : "boxSpaces", spaceRef = db.collection(root).doc(action.space.id), movementRef = spaceRef.collection("movements").doc(action.sharedMovementId);
    await db.runTransaction(async tx => {
      const connectionRef = db.collection("telegramConnections").doc(String(chatId)), statusRef = db.collection("telegramUsers").doc(connection.uid);
      const [space, member, movement, connectionSnap, statusSnap] = await Promise.all([tx.get(spaceRef), tx.get(spaceRef.collection("members").doc(connection.uid)), tx.get(movementRef), tx.get(connectionRef), tx.get(statusRef)]);
      assertLiveConnection(connectionSnap, statusSnap, connection.uid, chatId);
      if (!space.exists || !member.exists || !movement.exists || [space.data().closed, space.data().closing, space.data().deleting].includes(true) || space.data().migrationComplete === false || movement.data().creadoPor !== connection.uid) throw new Error("NOTHING_TO_EDIT");
      tx.update(movementRef, { method });
    });
    action.movement = { ...action.movement, method };
  }
  const type = action.movement.type === "income" || action.movement.tipo === "ingreso" ? "income" : "expense";
  const lastMethods = { ...(connection.settings?.lastMethods || {}), [type]: method };
  await Promise.all([saveUndo(db, chatId, action), db.collection("telegramDrafts").doc(String(chatId)).delete(), remember(db, chatId, action.space, { lastMethods })]);
  return send(token, chatId, `✅ Actualizado: ${METHOD_NAMES[method]}`, afterSaveKeyboard(action));
}

async function beginQuick(db, token, chatId, connection, space, type) {
  if (!["expense", "income"].includes(type)) throw new Error("EXPIRED");
  await saveFlow(db, chatId, { kind: "quick", step: "quick", uid: connection.uid, space: safeSpace(space), type });
  return send(token, chatId, quickPrompt(space, type));
}
async function cancelToSpace(db, token, chatId, connection, heading = "Operación cancelada.") {
  return showSpace(db, token, chatId, connection, await resolveRememberedSpace(db, connection), heading);
}

async function callbackAction(db, token, chatId, data, connection, operationId) {
  if (data === "menu") return showMain(db, token, chatId);
  if (data === "space:personal") return showSpace(db, token, chatId, connection, { kind: "personal", id: connection.uid, name: "Personal", currency: String(connection.user.userCurrency || "PEN") });
  if (data === "space:family") { const family = await activeFamily(db, connection.uid, String(connection.user.userCurrency || "PEN")); return family ? showSpace(db, token, chatId, connection, family) : send(token, chatId, "No tienes una Familia activa. Créala o únete primero desde Fino.", { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "menu" }]] }); }
  if (data === "space:boxes") { const boxes = await boxesFor(db, connection.uid); return boxes.length ? send(token, chatId, "Elige una caja:", { inline_keyboard: [...boxes.map(box => [{ text: `📦 ${box.name}`, callback_data: `box:${box.id}` }]), [{ text: "⬅️ Volver", callback_data: "menu" }]] }) : send(token, chatId, "No tienes cajas compartidas activas. Créala o únete primero desde Fino.", { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "menu" }]] }); }
  if (data.startsWith("box:")) { const box = (await boxesFor(db, connection.uid)).find(item => item.id === data.slice(4)); if (!box) throw new Error("SPACE_UNAVAILABLE"); return showSpace(db, token, chatId, connection, box); }
  if (data === "undo") return undoLast(db, token, chatId, connection);
  if (data.startsWith("again:")) return beginQuick(db, token, chatId, connection, await resolveRememberedSpace(db, connection), data.slice(6));
  if (data === "options") {
    const saved = await getUndo(db, chatId);
    if (!saved || saved.uid !== connection.uid || saved.action.kind !== "movement") throw new Error("NOTHING_TO_EDIT");
    const action = saved.action, movementType = action.movement.type === "income" || action.movement.tipo === "ingreso" ? "income" : "expense";
    if (action.space.kind === "personal") {
      await saveFlow(db, chatId, { kind: "edit", step: "edit_category", uid: connection.uid, category: action.movement.category });
      return send(token, chatId, "Corrige la categoría:", { inline_keyboard: categoryKeyboard(movementType, action.movement.category, connection.user.categoriasPropias) });
    }
    await saveFlow(db, chatId, { kind: "edit", step: "edit_method", uid: connection.uid });
    return send(token, chatId, "Corrige el método:", { inline_keyboard: methodKeyboard(String(connection.user.userCountry || "PE"), action.movement.method) });
  }
  const flow = await getFlow(db, chatId);
  if (data.startsWith("new:")) {
    const space = flow?.kind === "session" ? flow.space : await resolveRememberedSpace(db, connection);
    return beginQuick(db, token, chatId, connection, space, data.slice(4));
  }
  if (data === "transfer") {
    const space = flow?.kind === "session" ? flow.space : await resolveRememberedSpace(db, connection);
    if (space.kind === "personal") throw new Error("SPACE_UNAVAILABLE");
    if (space.currency !== String(connection.user.userCurrency || "PEN")) throw new Error("CURRENCY_MISMATCH");
    await saveFlow(db, chatId, { kind: "transfer", step: "transfer_amount", uid: connection.uid, space });
    return send(token, chatId, `¿Cuánto quieres pasar de Personal a ${space.name}?\nEjemplo: 300`);
  }
  if (data.startsWith("transfer_ok:") && flow?.step === "transfer_confirm") return confirmTransfer(db, token, chatId, connection, data.slice(12), operationId);
  if (data.startsWith("cat:") && flow?.step === "edit_category") {
    await saveFlow(db, chatId, { ...flow, category: data.slice(4), step: "edit_method" });
    const saved = await getUndo(db, chatId);
    return send(token, chatId, "Corrige el método:", { inline_keyboard: methodKeyboard(String(connection.user.userCountry || "PE"), saved?.action?.movement?.method) });
  }
  if (data.startsWith("method:") && flow?.step === "edit_method") {
    const method = data.slice(7);
    if (!allowedMethods(String(connection.user.userCountry || "PE")).includes(method)) throw new Error("EXPIRED");
    return editLast(db, token, chatId, connection, flow, method);
  }
  if (data === "cancel") return cancelToSpace(db, token, chatId, connection);
  throw new Error("EXPIRED");
}

async function handleTelegramUpdate({ db, token, update }) {
  const message = update.message, callback = update.callback_query, chatId = message?.chat?.id ?? callback?.message?.chat?.id;
  if (!chatId) return;
  try {
    if (callback) {
      await api(token, "answerCallbackQuery", { callback_query_id: callback.id });
      const connection = await connectionFor(db, chatId);
      if (!connection) throw new Error("NOT_LINKED");
      return callbackAction(db, token, chatId, String(callback.data || ""), connection, update.update_id);
    }
    const text = String(message?.text || "").trim(), code = parseLinkCode(text);
    if (code) return link(db, token, chatId, code);
    const connection = await connectionFor(db, chatId);
    if (/^\/start\b/i.test(text)) {
      if (!connection) return send(token, chatId, "Abre Fino → Ajustes → Registrar por Telegram → Conectar Telegram.");
      return showSpace(db, token, chatId, connection, await resolveRememberedSpace(db, connection));
    }
    if (!connection) throw new Error("NOT_LINKED");
    if (/^\/(menu|inicio)$/i.test(text)) return showMain(db, token, chatId);
    if (/^\/cancelar$/i.test(text)) return cancelToSpace(db, token, chatId, connection);
    const flow = await getFlow(db, chatId);
    if (flow?.step === "quick") {
      const explicitType = /^\s*(ingreso|ingresé|cobré|recibí)/i.test(text) ? "income" : "expense";
      const movement = parseNaturalMovement(text, quickOptions(connection, explicitType)) || parseQuickEntry(text, flow.type, quickOptions(connection, flow.type));
      if (!movement) return send(token, chatId, "No encontré un monto válido. Ejemplo: 20 almuerzo Yape");
      return registerQuick(db, token, chatId, connection, flow.space, movement, update.update_id);
    }
    if (flow?.step === "transfer_amount") {
      const value = amountDescription(text, "income");
      if (!value) return send(token, chatId, "Escribe un monto válido. Ejemplo: 300");
      return showTransferConfirmation(db, token, chatId, connection, flow, value);
    }
    const guessedType = /^\s*(ingreso|ingresé|cobré|recibí)/i.test(text) ? "income" : "expense";
    const movement = parseNaturalMovement(text, quickOptions(connection, guessedType));
    if (movement) return registerQuick(db, token, chatId, connection, await resolveRememberedSpace(db, connection), movement, update.update_id);
    return send(token, chatId, "Escribe, por ejemplo: gasto 20 almuerzo Yape. También puedes usar /menu.");
  } catch (error) {
    const messages = { INVALID_CODE: "El código no existe o venció.", NOT_PREMIUM: "Esta conexión requiere Premium activo.", NOT_LINKED: "Conecta Telegram desde Ajustes en Fino.", EXPIRED: "La operación venció. Empieza nuevamente.", TOO_LARGE: "Tu respaldo alcanzó su límite.", SPACE_UNAVAILABLE: "Ese espacio ya no está disponible.", INSUFFICIENT: "No hay saldo suficiente en Personal.", CURRENCY_MISMATCH: "No puedo transferir entre monedas diferentes sin inventar un tipo de cambio.", NOTHING_TO_UNDO: "Ya no hay un movimiento reciente que pueda deshacerse.", NOTHING_TO_EDIT: "Ya no hay un movimiento reciente que pueda corregirse." };
    return send(token, chatId, messages[error.message] || "No pude completar la operación. Intenta nuevamente.");
  }
}

module.exports = { handleTelegramUpdate, premium, previousBalance, personalFigures, sharedFigures, amountDescription, allowedMethods, safeSpace, operationKey, personalIdForOperation, quickPrompt, savedMovementMessage };

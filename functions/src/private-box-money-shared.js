"use strict";
const { units } = require("./money-units");

const fail = reason => { const error = new Error(reason); error.reason = reason; throw error; };
const id = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const time = value => Number.isSafeInteger(value) && value >= 0;
const date = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function canonical(value) {
  if (typeof value === "number" && !Number.isFinite(value)) fail("money-invalid-review");
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const without = (value, keys) => canonical(Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))));
function boxValid(box) { return !!box && id(box.id) && typeof box.nombre === "string" && !!box.nombre.trim() && box.nombre.length <= 30
  && time(box.creadaEn) && (box.updatedAt === undefined || time(box.updatedAt)) && !box.sharingPending && !box.sharingAttempt; }
function pairValid(pair, box, currency) {
  const p = pair?.personal, m = pair?.movement;
  if (!p || !m || !Number.isSafeInteger(p.id) || p.id <= 0 || !id(m.id) || m.cajaId !== box.id || m.personalTransactionId !== p.id
    || m.tipo !== "ingreso" || m.personalReturnAmount !== undefined || !time(m.creadoEn)
    || p.type !== "expense" || p.internalTransfer !== "box" || p.internalTransferLink !== m.id || p.internalTransferSpaceId !== box.id
    || (p.internalTransferSettled !== undefined && p.internalTransferSettled !== false)
    || (p.internalTransferConsumedAmount !== undefined && p.internalTransferConsumedAmount !== 0)
    || (p.internalTransferAllocations !== undefined && (!Array.isArray(p.internalTransferAllocations) || p.internalTransferAllocations.length))
    || (p.updatedAt !== undefined && !time(p.updatedAt)) || (m.updatedAt !== undefined && !time(m.updatedAt))
    || typeof m.descripcion !== "string" || !date(m.fecha) || !date(p.date)) fail("money-invalid-review");
  if (units(p.amount, currency, "money-invalid-review") <= 0n || units(m.monto, currency, "money-invalid-review") <= 0n) fail("money-invalid-review");
}

/** No elige el dinero: valida cuatro originales y la elección explícita. */
function validateMoneyReview(entry, uid = entry?.uid) {
  if (!entry || !id(entry.id) || entry.id.length < 16 || entry.uid !== uid || typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/")
    || !/^[A-Z]{3}$/.test(entry.currency) || !boxValid(entry.box) || !time(entry.createdAt) || !time(entry.version)
    || !["local-personal", "local-box", "remote-personal", "remote-box"].includes(entry.chosen)) fail("money-invalid-review");
  pairValid(entry.local, entry.box, entry.currency); pairValid(entry.remote, entry.box, entry.currency);
  canonical(entry.box);
  const a = entry.local, b = entry.remote;
  if (a.personal.id !== b.personal.id || a.movement.id !== b.movement.id
    || without(a.personal, ["amount", "date", "updatedAt"]) !== without(b.personal, ["amount", "date", "updatedAt"])
    || without(a.movement, ["monto", "fecha", "updatedAt"]) !== without(b.movement, ["monto", "fecha", "updatedAt"])
    || entry.version <= Math.max(a.personal.updatedAt ?? 0, b.personal.updatedAt ?? 0,
      a.movement.updatedAt ?? a.movement.creadoEn, b.movement.updatedAt ?? b.movement.creadoEn)) fail("money-invalid-review");
  const values = moneyChoices(entry);
  if (values.length < 2) fail("money-invalid-review");
  return entry;
}
function moneyChoices(entry) {
  const seen = new Set(), result = [];
  for (const [source, row, amountKey, dateKey] of [["local-personal", entry.local.personal, "amount", "date"], ["local-box", entry.local.movement, "monto", "fecha"],
    ["remote-personal", entry.remote.personal, "amount", "date"], ["remote-box", entry.remote.movement, "monto", "fecha"]]) {
    const amount = row[amountKey], date = row[dateKey], key = JSON.stringify([amount, date]);
    if (!seen.has(key)) { seen.add(key); result.push({ source, amount, date }); }
  }
  return result;
}
function moneyResult(entry) {
  const pair = entry.chosen.startsWith("local-") ? entry.local : entry.remote;
  const amount = entry.chosen.endsWith("personal") ? pair.personal.amount : pair.movement.monto;
  const date = entry.chosen.endsWith("personal") ? pair.personal.date : pair.movement.fecha;
  return { personal: { ...entry.remote.personal, amount, date, updatedAt: entry.version },
    movement: { ...entry.remote.movement, monto: amount, fecha: date, updatedAt: entry.version } };
}
function moneyAcknowledgement(entry) {
  const result = moneyResult(entry);
  return { confirmed: true, uid: entry.uid, id: entry.id, boxId: entry.box.id, movementId: result.movement.id,
    personalId: result.personal.id, amount: result.personal.amount, date: result.personal.date, version: entry.version };
}
module.exports = { canonical, validateMoneyReview, moneyChoices, moneyResult, moneyAcknowledgement, fail };

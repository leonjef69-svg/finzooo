"use strict";

const EXPENSES = new Map([
  ["comida", "comida"], ["transporte", "transporte"], ["compras", "compras"],
  ["entretenimiento", "entretenimiento"], ["videojuegos", "videojuegos"],
  ["salud", "salud"], ["servicios", "servicios"], ["combustible", "combustible"],
  ["suscripciones", "suscripciones"], ["educacion", "educacion"],
  ["educación", "educacion"], ["mascotas", "mascotas"], ["hogar", "hogar"],
  ["otros", "otros"], ["otro", "otros"],
]);
const INCOMES = new Map([
  ["salario", "salario"], ["sueldo", "salario"], ["freelance", "freelance"],
  ["regalo", "regalo"], ["inversiones", "inversiones"], ["venta", "venta"],
  ["premios", "premios"], ["prestamo", "prestamo"], ["préstamo", "prestamo"],
  ["dividendos", "dividendos"], ["alquiler", "alquiler"], ["cripto", "cripto"],
  ["beca", "beca"], ["otro", "otro_ingreso"], ["otros", "otro_ingreso"],
]);

const METHODS = [
  ["yape", ["yape"]], ["plin", ["plin"]],
  ["debit", ["debito", "tarjeta de debito"]],
  ["credit", ["credito", "tarjeta de credito"]],
  ["transfer", ["transferencia", "transferencia bancaria"]],
  ["cash", ["efectivo", "cash"]],
];

const CATEGORY_HINTS = {
  expense: [
    ["comida", ["comida", "almuerzo", "almorce", "cena", "desayuno", "restaurante", "menu"]],
    ["transporte", ["transporte", "taxi", "uber", "bus", "micro", "pasaje"]],
    ["compras", ["compras", "compra", "ropa", "zapatos", "supermercado"]],
    ["entretenimiento", ["entretenimiento", "cine", "fiesta", "juego"]],
    ["videojuegos", ["videojuego", "steam", "playstation", "xbox"]],
    ["salud", ["salud", "medicina", "farmacia", "doctor", "clinica"]],
    ["servicios", ["servicio", "luz", "agua", "internet", "telefono"]],
    ["combustible", ["combustible", "gasolina", "grifo"]],
    ["suscripciones", ["suscripcion", "netflix", "spotify"]],
    ["educacion", ["educacion", "colegio", "universidad", "curso", "libro"]],
    ["mascotas", ["mascota", "veterinaria", "perro", "gato"]],
    ["hogar", ["hogar", "casa", "alquiler"]],
  ],
  income: [
    ["salario", ["salario", "sueldo", "planilla"]],
    ["freelance", ["freelance", "trabajo", "servicio"]],
    ["venta", ["venta", "vendi"]], ["regalo", ["regalo"]],
    ["inversiones", ["inversion", "ganancia"]], ["premios", ["premio"]],
    ["prestamo", ["prestamo"]], ["dividendos", ["dividendo"]],
    ["alquiler", ["alquiler"]], ["cripto", ["cripto", "bitcoin"]], ["beca", ["beca"]],
  ],
};

function folded(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function wordFound(text, word) {
  return new RegExp(`(?:^|\\s)${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)`, "i").test(text);
}

function inferMethod(text, fallback = "cash", country = "PE") {
  const plain = folded(text).replace(/[^a-z0-9]+/g, " ").trim();
  for (const [id, names] of METHODS) {
    if ((id === "plin" && country !== "PE") || (id === "yape" && !["PE", "BO"].includes(country))) continue;
    if (names.some((name) => wordFound(plain, name))) return id;
  }
  return fallback;
}

function inferCategory(type, text, customCategories = []) {
  const plain = folded(text).replace(/[^a-z0-9]+/g, " ").trim();
  const custom = Array.isArray(customCategories)
    ? customCategories.find((item) => item?.tipo === type && wordFound(plain, folded(item.nombre)))
    : null;
  if (custom?.id) return custom.id;
  const found = CATEGORY_HINTS[type].find(([, hints]) => hints.some((hint) => wordFound(plain, hint)));
  return found?.[0] || (type === "expense" ? "otros" : "otro_ingreso");
}

function stripMethod(text, method) {
  if (!METHODS.some(([id]) => id === method)) return String(text || "").trim();
  return String(text || "")
    .replace(/(?:^|\s)(?:tarjeta\s+de\s+)?(?:d[eé]bito|cr[eé]dito)(?=$|\s)/ig, " ")
    .replace(/(?:^|\s)(?:transferencia(?:\s+bancaria)?|efectivo|cash|yape|plin)(?=$|\s)/ig, " ")
    .replace(/\s+/g, " ").trim();
}

function parseQuickEntry(text, type, options = {}) {
  if (!["expense", "income"].includes(type)) return null;
  let value = String(text || "").trim().replace(/\s+/g, " ");
  const amountMatch = value.match(/(?:^|\s)(?:s\/?\s*)?([\d.,]+)(?=$|\s)/i);
  if (!amountMatch) return null;
  const amount = cleanAmount(amountMatch[1]);
  if (amount === null) return null;
  const method = inferMethod(value, options.fallbackMethod || "cash", options.country || "PE");
  value = value.replace(amountMatch[0], " ");
  value = stripMethod(value, method)
    .replace(/^(?:gasto|gast[eé]|pagu[eé]|compr[eé]|ingreso|ingres[eé]|cobr[eé]|recib[ií])\s+/i, "")
    .replace(/^(?:por|de|en|con)\s+/i, "").replace(/\s+(?:por|de|en|con)$/i, "").replace(/\s+/g, " ").trim();
  const description = value.slice(0, 120) || (type === "expense" ? "Gasto desde Telegram" : "Ingreso desde Telegram");
  return { type, amount, category: inferCategory(type, description, options.customCategories), description, method };
}

function parseNaturalMovement(text, options = {}) {
  const plain = folded(text).trim();
  let type = null;
  if (/^(gasto|gaste|pague|compre)\b/.test(plain)) type = "expense";
  if (/^(ingreso|ingrese|cobre|recibi)\b/.test(plain)) type = "income";
  return type ? parseQuickEntry(text, type, options) : null;
}

function cleanAmount(raw) {
  const value = raw.trim();
  let normalized;
  if (value.includes(",") && value.includes(".")) {
    normalized = value.lastIndexOf(",") > value.lastIndexOf(".")
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (value.includes(",")) {
    normalized = /^\d{1,3}(,\d{3})+$/.test(value) ? value.replace(/,/g, "") : value.replace(",", ".");
  } else {
    normalized = value;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 && amount <= 9_000_000_000_000 ? amount : null;
}

function parseMovement(text) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  const match = normalized.match(/^(gasto|ingreso|expense|income|despesa|receita)\s+(?:s\/?\s*)?([\d.,]+)(?:\s+(.+))?$/i);
  if (!match) return null;
  const expenseWords = new Set(["gasto", "expense", "despesa"]);
  const type = expenseWords.has(match[1].toLowerCase()) ? "expense" : "income";
  const amount = cleanAmount(match[2]);
  if (amount === null) return null;
  const tail = (match[3] || "").trim();
  const words = tail.toLocaleLowerCase("es").split(" ").filter(Boolean);
  const categories = type === "expense" ? EXPENSES : INCOMES;
  const categoryWord = words.find((word) => categories.has(word));
  const category = categoryWord ? categories.get(categoryWord) : type === "expense" ? "otros" : "otro_ingreso";
  const description = tail.slice(0, 120) || (type === "expense" ? "Gasto desde Telegram" : "Ingreso desde Telegram");
  return { type, amount, category, description, method: "Telegram" };
}

function parseLinkCode(text) {
  const match = String(text || "").trim().match(/^(?:\/vincular\s+|\/start\s+link_)([A-Z0-9]{6})$/i);
  return match ? match[1].toUpperCase() : null;
}

module.exports = { parseMovement, cleanAmount, parseLinkCode, parseQuickEntry, parseNaturalMovement, inferCategory, inferMethod };

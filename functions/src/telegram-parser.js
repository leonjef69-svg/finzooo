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

module.exports = { parseMovement, cleanAmount, parseLinkCode };

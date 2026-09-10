"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { inferCategory, inferMethod, parseLinkCode, parseMovement, parseNaturalMovement, parseQuickEntry } = require("../src/telegram-parser");

test("interpreta gasto con decimal peruano", () => assert.deepEqual(parseMovement("gasto S/ 1.250,50 comida"), { type: "expense", amount: 1250.5, category: "comida", description: "comida", method: "Telegram" }));
test("interpreta ingreso y sinónimo sueldo", () => assert.equal(parseMovement("ingreso 1500 sueldo").category, "salario"));
test("usa categoría segura si no se indicó", () => assert.equal(parseMovement("gasto 20 taxi").category, "otros"));
test("rechaza cero, negativos y texto ambiguo", () => { assert.equal(parseMovement("gasto 0 comida"), null); assert.equal(parseMovement("pagué 20"), null); });
test("acepta vínculo automático y manual", () => {
  assert.equal(parseLinkCode("/start link_AB12CD"), "AB12CD");
  assert.equal(parseLinkCode("/vincular ab12cd"), "AB12CD");
  assert.equal(parseLinkCode("/start"), null);
});

test("registra monto, descripción y método desde una sola línea", () => {
  assert.deepEqual(parseQuickEntry("20 almuerzo Yape", "expense", { country: "PE" }), {
    type: "expense", amount: 20, category: "comida", description: "almuerzo", method: "yape",
  });
  assert.deepEqual(parseQuickEntry("cobro 1.250,50 tarjeta de débito", "income", { country: "PE" }), {
    type: "income", amount: 1250.5, category: "otro_ingreso", description: "cobro", method: "debit",
  });
});

test("acepta monto, descripción y método en cualquier orden", () => {
  const expected = { type: "expense", amount: 20, category: "comida", description: "almuerzo", method: "yape" };
  assert.deepEqual(parseQuickEntry("Yape almuerzo 20", "expense", { country: "PE" }), expected);
  assert.deepEqual(parseQuickEntry("almuerzo 20 Yape", "expense", { country: "PE" }), expected);
  assert.deepEqual(parseQuickEntry("20, almuerzo, Yape", "expense", { country: "PE" }), expected);
});

test("entiende frases directas sin inteligencia artificial", () => {
  assert.deepEqual(parseNaturalMovement("Pagué 18 taxi en efectivo", { country: "PE" }), {
    type: "expense", amount: 18, category: "transporte", description: "taxi", method: "cash",
  });
  assert.equal(parseNaturalMovement("quizás compre algo"), null);
});

test("respeta país, último método y categorías creadas por la persona", () => {
  assert.equal(inferMethod("20 comida Plin", "credit", "BO"), "credit");
  assert.equal(inferMethod("20 comida", "debit", "PE"), "debit");
  assert.equal(inferCategory("expense", "pollo broster", [{ id: "propia_broster", nombre: "Broster", tipo: "expense" }]), "propia_broster");
});

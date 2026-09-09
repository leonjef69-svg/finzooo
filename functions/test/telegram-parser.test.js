"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMovement } = require("../src/telegram-parser");

test("interpreta gasto con decimal peruano", () => assert.deepEqual(parseMovement("gasto S/ 1.250,50 comida"), { type: "expense", amount: 1250.5, category: "comida", description: "comida", method: "Telegram" }));
test("interpreta ingreso y sinónimo sueldo", () => assert.equal(parseMovement("ingreso 1500 sueldo").category, "salario"));
test("usa categoría segura si no se indicó", () => assert.equal(parseMovement("gasto 20 taxi").category, "otros"));
test("rechaza cero, negativos y texto ambiguo", () => { assert.equal(parseMovement("gasto 0 comida"), null); assert.equal(parseMovement("pagué 20"), null); });

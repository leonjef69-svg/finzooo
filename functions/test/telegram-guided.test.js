"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  amountDescription,
  personalFigures,
  previousBalance,
  sharedFigures,
  allowedMethods,
  safeSpace,
  operationKey,
  personalIdForOperation,
  quickPrompt,
  savedMovementMessage,
  transferConfirmationMessage,
  localDate,
  localTime,
  validTimeZone,
} = require("../src/telegram-guided-handler");

test("Telegram respeta la zona horaria del celular", () => {
  const instant = new Date("2026-09-11T02:30:00.000Z");
  assert.equal(localDate({ timeZone: "America/Lima" }, instant), "2026-09-10");
  assert.equal(localTime({ timeZone: "America/Lima" }, instant), "21:30");
  assert.equal(localDate({ timeZone: "Europe/Madrid" }, instant), "2026-09-11");
  assert.equal(validTimeZone("zona-inventada"), "America/Lima");
});

test("monto y descripción viajan juntos en un solo mensaje", () => {
  assert.deepEqual(amountDescription("S/ 20 almuerzo", "expense"), {
    amount: 20,
    description: "almuerzo",
  });
  assert.equal(amountDescription("almuerzo", "expense"), null);
});

test("saldo anterior respeta los cortes mensuales de Fino", () => {
  const data = {
    budgets: { "2026-06": 100, "2026-07": 200, "2026-08": 300 },
    transactions: [
      { date: "2026-06-02", type: "expense", amount: 20 },
      { date: "2026-07-02", type: "income", amount: 10 },
      { date: "2026-08-02", type: "expense", amount: 50 },
    ],
    carryoverCleared: ["2026-07"],
  };
  assert.equal(previousBalance(data, "2026-09"), 460);
});

test("totales compartidos no mezclan ingreso y gasto", () => {
  assert.deepEqual(sharedFigures([
    { tipo: "ingreso", monto: 100 },
    { tipo: "gasto", monto: 35 },
  ]), { income: 100, spent: 35, balance: 65 });
});

test("Personal funciona sin presupuesto y excluye transferencias del consumo", () => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const figures = personalFigures({
    budgets: {}, carryoverCleared: [],
    transactions: [
      { date: today, type: "income", amount: 100 },
      { date: today, type: "expense", amount: 20 },
      { date: today, type: "expense", amount: 30, internalTransfer: "box" },
    ],
  });
  assert.equal(figures.budget, 0);
  assert.equal(figures.income, 100);
  assert.equal(figures.spent, 20);
  assert.equal(figures.balance, 50);
});

test("Yape y Plin respetan el país configurado en Fino", () => {
  assert.deepEqual(allowedMethods("PE"), ["cash", "debit", "credit", "transfer", "yape", "plin"]);
  assert.deepEqual(allowedMethods("BO"), ["cash", "debit", "credit", "transfer", "yape"]);
  assert.deepEqual(allowedMethods("MX"), ["cash", "debit", "credit", "transfer"]);
});

test("solo se recuerda información mínima y segura del espacio", () => {
  assert.deepEqual(safeSpace({ kind: "box", id: 7, name: "Caja emergencia", currency: "PEN", ownerUid: "privado" }), {
    kind: "box", id: "7", name: "Caja emergencia", currency: "PEN",
  });
  assert.deepEqual(safeSpace({ kind: "family", id: 8, name: "Casa", currency: "PEN", canTransfer: true, ownerUid: "privado" }), {
    kind: "family", id: "8", name: "Casa", currency: "PEN", canTransfer: true,
  });
});

test("cada actualización de Telegram genera una identidad estable y segura", () => {
  assert.equal(operationKey(12345), "12345");
  assert.equal(personalIdForOperation("12345"), personalIdForOperation("12345"));
  assert.ok(Number.isSafeInteger(personalIdForOperation("12345")));
  assert.notEqual(personalIdForOperation("12345"), personalIdForOperation("12346"));
});

test("el aviso rápido presenta los tres datos en vertical y conserva un solo mensaje", () => {
  assert.equal(quickPrompt({ name: "Personal" }, "expense"), "➖ Gasto en Personal\n\nMonto:\nDescripción:\nMétodo de pago:\n\nEjemplo: 20 almuerzo Yape");
  assert.equal(quickPrompt({ name: "Familia" }, "income"), "➕ Ingreso en Familia\n\nMonto:\nDescripción:\nMétodo de pago:\n\nEjemplo: 500 sueldo Transferencia");
});

test("la confirmación guardada separa monto descripción y método", () => {
  assert.equal(savedMovementMessage(
    { name: "Personal", currency: "PEN" },
    { type: "expense", amount: 100, description: "comida", method: "yape" },
  ), "✅ Gasto guardado en Personal\n\nMonto: S/ 100.00\nDescripción: Comida\nMétodo de pago: Yape");
});

test("la transferencia se confirma con textos cortos y verticales", () => {
  assert.equal(transferConfirmationMessage(
    { name: "Caja Ana", currency: "PEN" }, 300, 500,
  ), "↗️ Confirmar transferencia\n\nMonto: S/ 300.00\nDesde: Personal\nSaldo después: S/ 200.00\nPara: Caja Ana");
});

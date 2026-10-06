"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { digestSource, sourceFrom } = require("../src/private-box-migration");
const { sharedBoxMovement, copiedBoxMovementMatches } = require("../src/private-box-source");
const box = { id: "caja-a", nombre: "A 🌟", creadaEn: 1 };
const row = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-05", creadoEn: 2 };
test("huella de conversión estable por orden pero sensible a montos, textos y versión", () => {
  const other = { ...row, id: "mov-b" };
  assert.equal(digestSource(box, [row, other], "PEN"), digestSource(box, [other, row], "PEN"));
  for (const change of [{ monto: 90 }, { notes: "texto" }, { updatedAt: 3 }]) assert.notEqual(digestSource(box, [row], "PEN"), digestSource(box, [{ ...row, ...change }], "PEN"));
  assert.notEqual(digestSource(box, [row], "PEN"), digestSource(box, [row], "USD"));
});
test("copias con el mismo ID pero diferente dinero o campos adicionales no coinciden", () => {
  const actual = sharedBoxMovement(row, "a");
  assert.equal(copiedBoxMovementMatches({ ...actual, migrationSourceIndex: 4 }, row, "a"), true);
  for (const change of [{ monto: 99 }, { creadoPor: "b" }, { notes: "ajeno" }, { personalReturnReceipt: {} }]) assert.equal(copiedBoxMovementMatches({ ...actual, ...change }, row, "a"), false);
});
test("origen malformado, duplicados y gasto sin saldo impiden convertir", () => {
  const data = movimientos => ({ cajas: [box], movimientos });
  assert.deepEqual(sourceFrom(data([row]), box.id).rows, [row]);
  for (const rows of [[row, row], [{ ...row, monto: Infinity }], [{ ...row, tipo: "gasto" }], [{ ...row, updatedAt: -1 }], [{ ...row, personalReturnAmount: 100 }]]) assert.throws(() => sourceFrom(data(rows), box.id), /migration-invalid-source/);
});

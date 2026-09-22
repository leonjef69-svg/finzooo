"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { contributionLimits, canCloseLinkedSpace, hasUnreturnedPersonalContribution } = require("../src/personal-contribution");

test("un aporte Personal gastado no puede borrarse ni reducirse", () => {
  const movements = [
    { tipo: "ingreso", monto: 100, personalTransactionId: 10, personalOwnerUid: "ana" },
    { tipo: "gasto", monto: 100 },
  ];
  assert.deepEqual(contributionLimits(movements, "ana", 100), {
    refundable: 0, minimum: 100, canDelete: false,
  });
});

test("un aporte intacto puede borrarse y una devolución reduce solo su parte", () => {
  const intact = [{ tipo: "ingreso", monto: 100, personalTransactionId: 10, personalOwnerUid: "ana" }];
  assert.equal(contributionLimits(intact, "ana", 100).canDelete, true);
  const partialReturn = [...intact, { tipo: "gasto", monto: 40, personalTransactionId: 11, personalOwnerUid: "ana", personalReturnAmount: 40 }];
  assert.deepEqual(contributionLimits(partialReturn, "ana", 100), {
    refundable: 60, minimum: 40, canDelete: false,
  });
});

test("un espacio no se cierra hasta devolver todos los aportes Personal", () => {
  const used = [
    { tipo: "ingreso", monto: 100, personalTransactionId: 10, personalOwnerUid: "ana" },
    { tipo: "gasto", monto: 100 },
  ];
  assert.equal(canCloseLinkedSpace(used), false);
  const returned = [
    { tipo: "ingreso", monto: 100, personalTransactionId: 10, personalOwnerUid: "ana" },
    { tipo: "gasto", monto: 100, personalTransactionId: 11, personalOwnerUid: "ana", personalReturnAmount: 100 },
  ];
  assert.equal(canCloseLinkedSpace(returned), true);
  assert.equal(hasUnreturnedPersonalContribution(used, "ana"), true);
  assert.equal(hasUnreturnedPersonalContribution(returned, "ana"), false);
});

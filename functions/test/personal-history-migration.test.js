"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { legacyEntries, chooseEntry, covers } = require("../src/personal-history-migration");

test("10.000 movimientos y borrados conservan sus identificadores", () => {
  const transactions = Array.from({ length: 10_000 }, (_, index) => ({ id: index + 1, amount: index + 1 }));
  const entries = legacyEntries({ transactions, deletedTransactionIds: [5, 10_001] });
  assert.equal(entries.length, 10_001);
  assert.deepEqual(entries[4], { id: 5, deleted: true });
  assert.deepEqual(entries.at(-1), { id: 10_001, deleted: true });
});

test("borrados prevalecen y los empates distintos abortan", () => {
  const old = { id: 1, deleted: false, transaction: { id: 1, amount: 10, updatedAt: 100 } };
  const newer = { id: 1, deleted: false, transaction: { id: 1, amount: 20, updatedAt: 200 } };
  const erased = { id: 1, deleted: true };
  assert.deepEqual(chooseEntry(old, newer), newer);
  assert.deepEqual(chooseEntry(newer, old), newer);
  assert.deepEqual(chooseEntry(newer, erased), erased);
  assert.deepEqual(chooseEntry(erased, newer), erased);
  assert.equal(covers(old, newer), false);
  assert.equal(covers(newer, old), true);
  assert.equal(covers(erased, newer), true);
  assert.throws(() => chooseEntry(old, { ...old, transaction: { ...old.transaction, amount: 99 } }), /HISTORY_EDIT_CONFLICT/);
});

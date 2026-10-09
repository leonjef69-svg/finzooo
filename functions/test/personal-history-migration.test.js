"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { legacyEntries, chooseEntry, covers, migratePersonalHistory } = require("../src/personal-history-migration");
const vm = require("node:vm"), { execFileSync } = require("node:child_process");
const originBaseline = process.env.FINO_TEST_HISTORY_ADMIN_ORIGIN_BASELINE;
let original = { legacyEntries, chooseEntry, covers, migratePersonalHistory };
if (originBaseline) {
  assert.match(originBaseline, /^[a-f0-9]{7,40}$/i);
  const module = { exports: {} };
  vm.runInNewContext(execFileSync("git", ["show", `${originBaseline}:functions/src/personal-history-migration.js`], { encoding: "utf8" }), { module, exports: module.exports, require });
  original = module.exports;
}

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

test("Admin también rechaza dos orígenes distintos antes de retirar la lista raíz", () => {
  const row = transaction => ({ id: 1, deleted: false, transaction: { id: 1, amount: 10, updatedAt: 100, ...transaction } });
  for (const [a, b] of [
    [row({ creationId: "creacion-A" }), row({ creationId: "creacion-B", updatedAt: 200 })],
    [row({ creationId: "creacion-A" }), row({ updatedAt: 200 })],
    [row({ captureId: "aviso-A" }), row({ captureId: "aviso-B", updatedAt: 200 })],
    [row({ internalTransferLink: "aporte-A", internalTransferSpaceId: "caja-A", internalTransfer: "box" }), row({ internalTransferLink: "aporte-B", internalTransferSpaceId: "caja-A", internalTransfer: "box", updatedAt: 200 })],
  ]) {
    for (const [before, after] of [[a, b], [b, a]]) {
      assert.throws(() => original.chooseEntry(before, after), /HISTORY_ORIGIN_CONFLICT/);
      assert.throws(() => original.covers(before, after), /HISTORY_ORIGIN_CONFLICT/);
    }
  }
  const before = row({ creationId: "creacion-A" }), after = row({ creationId: "creacion-A", amount: 20, updatedAt: 200 });
  assert.equal(original.chooseEntry(before, after), after);
  assert.equal(original.covers(after, before), true);
});

test("Admin no acredita una marca sin origen como copia de un alta identificada", () => {
  for (const proof of [{ creationId: "A" }, { captureId: "captura-A" }, { internalTransferLink: "aporte-A" }]) {
    const live = { id: 1, deleted: false, transaction: { id: 1, amount: 10, ...proof } };
    const erased = { id: 1, deleted: true };
    const before = JSON.stringify([live, erased]);
    for (const [a, b] of [[live, erased], [erased, live]]) {
      assert.throws(() => original.chooseEntry(a, b), /HISTORY_ORIGIN_CONFLICT/);
      assert.throws(() => original.covers(a, b), /HISTORY_ORIGIN_CONFLICT/);
    }
    assert.throws(() => original.legacyEntries({ transactions: [live.transaction], deletedTransactionIds: [1] }), /HISTORY_ORIGIN_CONFLICT/);
    assert.equal(JSON.stringify([live, erased]), before);
  }
  const live = { id: 1, deleted: false, transaction: { id: 1, amount: 10, creationId: "A" } };
  assert.equal(original.chooseEntry(null, live), live, "un alta sin contradicción sigue copiable");
  assert.equal(original.covers(live, live), true);
});

test("Admin no interpreta ni rebaja una revisión de identidad desconocida", () => {
  for (const recordIdentityFormat of [2, "1", null, false, 0]) {
    const data = { recordIdentityFormat, transactions: [{ id: 1, amount: 10 }], deletedTransactionIds: [] };
    const before = JSON.stringify(data);
    assert.throws(() => original.legacyEntries(data), /HISTORY_FORMAT_UNSUPPORTED/);
    assert.equal(JSON.stringify(data), before);
  }
  assert.equal(original.legacyEntries({ recordIdentityFormat: 1, transactions: [{ id: 1 }] }).length, 1);
});

test("migración no anuncia 'ya migrada' para una revisión que no entiende", async () => {
  let data = { hasOnboarded: true, historyFormat: 2, recordIdentityFormat: 2 };
  const root = { collection: () => ({}), get: async () => ({ exists: true, data: () => data }) };
  const db = { collection: () => ({ doc: () => root }), batch: () => assert.fail("no empezar escrituras") };
  await assert.rejects(original.migratePersonalHistory(db, "fixture"), /HISTORY_FORMAT_UNSUPPORTED/);
  assert.equal(data.recordIdentityFormat, 2);
  data = { ...data, recordIdentityFormat: 1 };
  assert.equal((await original.migratePersonalHistory(db, "fixture")).alreadyMigrated, true);
});

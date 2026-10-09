"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const {
  allPersonalTransactions, personalRecord, addPersonal, editPersonal, deletePersonal,
} = require("../src/telegram-personal-history");

function fakeRoot(rows = {}) {
  const root = { collection: () => ({
    doc: id => ({ id, key: `history/${id}` }),
    get: async () => ({ docs: Object.entries(rows).map(([id, data]) => ({ id, data: () => data })) }),
  }) };
  const writes = [];
  const tx = {
    get: async ref => ref.key
      ? { exists: !!rows[ref.id], data: () => rows[ref.id] }
      : { docs: Object.entries(rows).map(([id, data]) => ({ id, data: () => data })) },
    set: (ref, data) => writes.push({ kind: "set", ref, data }),
    update: (ref, data) => writes.push({ kind: "update", ref, data }),
  };
  return { root, tx, writes };
}

test("Telegram lee el historial separado y excluye lápidas", async () => {
  const { root, tx } = fakeRoot({
    1: { id: 1, deleted: false, transaction: { id: 1, amount: 20 } },
    2: { id: 2, deleted: true },
  });
  assert.deepEqual(await allPersonalTransactions(root, { historyFormat: 2 }, tx), [{ id: 1, amount: 20 }]);
  assert.deepEqual(await allPersonalTransactions(root, { transactions: [{ id: 3 }] }, tx), [{ id: 3 }]);
});

test("Telegram guarda, corrige y deshace sin tocar la lista antigua", async () => {
  const { root, tx, writes } = fakeRoot({});
  const data = { historyFormat: 2 };
  const first = await personalRecord(tx, root, data, 7);
  addPersonal(tx, root, data, first, { id: 7, amount: 10 }, 850_000);
  assert.equal(writes[0].kind, "set");
  assert.equal(writes[0].data.transaction.amount, 10);
  const existing = { ...first, transaction: { id: 7, amount: 10 }, exists: true };
  editPersonal(tx, root, data, existing, { id: 7, amount: 20 }, 850_000);
  deletePersonal(tx, root, data, existing, 7);
  assert.equal(writes[1].data.transaction.amount, 20);
  assert.equal(writes[2].data.deleted, true);
  assert.ok(writes.every(item => item.kind === "set" && item.ref.key.startsWith("history/")));
});

test("Telegram mantiene compatibilidad con la lista antigua", async () => {
  const { root, tx, writes } = fakeRoot();
  const data = { transactions: [{ id: 1, amount: 10 }], deletedTransactionIds: [] };
  const current = await personalRecord(tx, root, data, 1);
  editPersonal(tx, root, data, current, { id: 1, amount: 20 }, 850_000);
  deletePersonal(tx, root, data, current, 1);
  assert.equal(writes[0].kind, "update");
  assert.equal(writes[0].data.transactions[0].amount, 20);
  assert.deepEqual(writes[1].data.deletedTransactionIds, [1]);
});

test("Telegram no modifica una cuenta cuyo borrado está pendiente", async () => {
  const { root, tx, writes } = fakeRoot();
  const data = { historyFormat: 2, accountDeletionPending: true };
  await assert.rejects(allPersonalTransactions(root, data, tx), /ACCOUNT_DELETION_PENDING/);
  await assert.rejects(personalRecord(tx, root, data, 1), /ACCOUNT_DELETION_PENDING/);
  assert.throws(() => addPersonal(tx, root, data, {}, { id: 1 }, 850_000), /ACCOUNT_DELETION_PENDING/);
  assert.deepEqual(writes, []);
});

function historyOriginal() {
  if (process.env.FINO_TELEGRAM_HISTORY_BASELINE && !/^[a-f0-9]{7,40}$/i.test(process.env.FINO_TELEGRAM_HISTORY_BASELINE)) throw new Error("Hash no válido");
  const source = process.env.FINO_TELEGRAM_HISTORY_BASELINE
    ? execFileSync("git", ["show", process.env.FINO_TELEGRAM_HISTORY_BASELINE + ":functions/src/telegram-personal-history.js"], { encoding: "utf8" })
    : fs.readFileSync(require.resolve("../src/telegram-personal-history"), "utf8");
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: name => {
    assert.equal(name, "firebase-admin/firestore");
    return { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } };
  }, Buffer });
  return module.exports;
}

test("Telegram antiguo rechaza un ID reservado por borrado sin anunciar un alta que desaparece", async () => {
  const original = historyOriginal();
  const { root, tx, writes } = fakeRoot();
  const data = { transactions: [{ id: 1, amount: 10 }], deletedTransactionIds: [7] };
  const before = JSON.stringify(data);
  const record = await original.personalRecord(tx, root, data, 7);
  assert.throws(() => original.addPersonal(tx, root, data, record, { id: 7, amount: 20 }, 850_000), /DUPLICATE_ID/);
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(writes, []);
  original.addPersonal(tx, root, data, {}, { id: 8, amount: 20 }, 850_000);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.transactions[1].id, 8);
});

test("Telegram conserva también el primer borrado después de superar 5000 marcas", async () => {
  const original = historyOriginal(), { root, tx, writes } = fakeRoot();
  const movement = { id: 6001, amount: 20, description: "Fixture" };
  const data = { transactions: [movement], deletedTransactionIds: Array.from({ length: 5000 }, (_, index) => index + 1) };
  const before = JSON.stringify(data);
  const record = await original.personalRecord(tx, root, data, movement.id);
  original.deletePersonal(tx, root, data, record, movement.id);
  const saved = writes[0].data;
  assert.equal(saved.deletedTransactionIds.length, 5001);
  assert.ok(saved.deletedTransactionIds.includes(1), "no olvidar la primera marca ni resucitar un registro de otro teléfono");
  assert.ok(saved.deletedTransactionIds.includes(movement.id));
  assert.equal(saved.transactions.length, 0);
  assert.equal(JSON.stringify(data), before);
  assert.ok(Buffer.byteLength(JSON.stringify(saved)) < Buffer.byteLength(before), "este borrado no agranda la copia previa");
});

test("Telegram conserva la copia de una revisión desconocida sin leer historial ni guardar", async () => {
  const original = historyOriginal();
  for (const historyFormat of [1, 2]) for (const recordIdentityFormat of [2, "1", null, false, 0]) {
    const { root, tx, writes } = fakeRoot();
    const data = { historyFormat, recordIdentityFormat, transactions: [{ id: 1, amount: 10 }], deletedTransactionIds: [] };
    const before = JSON.stringify(data);
    await assert.rejects(original.allPersonalTransactions(root, data, tx), /HISTORY_FORMAT_UNSUPPORTED/);
    await assert.rejects(original.personalRecord(tx, root, data, 1), /HISTORY_FORMAT_UNSUPPORTED/);
    assert.throws(() => original.addPersonal(tx, root, data, {}, { id: 2 }, 850_000), /HISTORY_FORMAT_UNSUPPORTED/);
    assert.throws(() => original.editPersonal(tx, root, data, { transaction: data.transactions[0] }, { id: 1, amount: 20 }, 850_000), /HISTORY_FORMAT_UNSUPPORTED/);
    assert.throws(() => original.deletePersonal(tx, root, data, { transaction: data.transactions[0] }, 1), /HISTORY_FORMAT_UNSUPPORTED/);
    assert.deepEqual(writes, []);
    assert.equal(JSON.stringify(data), before);
  }
});

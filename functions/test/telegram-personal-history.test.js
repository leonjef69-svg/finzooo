"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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

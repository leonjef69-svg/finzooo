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
  const entries = legacyEntries({ transactions: transactions.filter(row => row.id !== 5), deletedTransactionIds: [5, 10_001] });
  assert.throws(() => legacyEntries({ transactions, deletedTransactionIds: [5] }), /HISTORY_ORIGIN_CONFLICT/, "una lista histórica contradictoria se conserva para revisión, no se adjudica un borrado");
  assert.equal(entries.length, 10_001);
  assert.deepEqual(entries[4], { id: 5, deleted: true });
  assert.deepEqual(entries.at(-1), { id: 10_001, deleted: true });
});

test("borrados prevalecen y los empates distintos abortan", () => {
  const old = { id: 1, deleted: false, transaction: { id: 1, amount: 10, updatedAt: 100, captureId: "fixture-original" } };
  const newer = { id: 1, deleted: false, transaction: { id: 1, amount: 20, updatedAt: 200, captureId: "fixture-original" } };
  const erased = { id: 1, deleted: true };
  const legacyNewer = { ...newer, transaction: { ...newer.transaction, captureId: undefined } };
  assert.deepEqual(chooseEntry(old, newer), newer);
  assert.deepEqual(chooseEntry(newer, old), newer);
  assert.throws(() => chooseEntry(legacyNewer, erased), /HISTORY_ORIGIN_CONFLICT/);
  assert.throws(() => chooseEntry(erased, legacyNewer), /HISTORY_ORIGIN_CONFLICT/);
  assert.equal(covers(old, newer), false);
  assert.equal(covers(newer, old), true);
  assert.throws(() => covers(erased, legacyNewer), /HISTORY_ORIGIN_CONFLICT/);
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
  assert.deepEqual(original.chooseEntry(before, after), after);
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
  assert.deepEqual(original.chooseEntry(null, live), live, "un alta sin contradicción sigue copiable");
  assert.equal(original.covers(live, live), true);
});

test("Admin no interpreta ni rebaja una revisión de identidad desconocida", () => {
  for (const recordIdentityFormat of [3, "1", null, false, 0]) {
    const data = { recordIdentityFormat, transactions: [{ id: 1, amount: 10 }], deletedTransactionIds: [] };
    const before = JSON.stringify(data);
    assert.throws(() => original.legacyEntries(data), /HISTORY_FORMAT_UNSUPPORTED/);
    assert.equal(JSON.stringify(data), before);
  }
  assert.equal(original.legacyEntries({ recordIdentityFormat: 1, transactions: [{ id: 1 }] }).length, 1);
});

test("Admin conserva fila futura y solo acredita un borrado del mismo original", () => {
  const live = { id: 1, deleted: false, transaction: { id: 1, creationId: "original-A", amount: 10 } };
  const erased = { id: 1, deleted: true, origin: require("../src/record-origin").recordOriginOf(live.transaction) };
  assert.equal(chooseEntry(live, erased).deleted, true);
  assert.equal(chooseEntry(erased, live).origin, erased.origin);
  assert.ok(chooseEntry(live, erased).mutationMeta, "el origen explícito se conserva en el protocolo");
  assert.equal(covers(erased, live), false, "falta guardar la identidad mínima que aún está disponible en la fila viva");
  assert.equal(covers(chooseEntry(erased, live), live), true);
  assert.throws(() => chooseEntry(erased, { ...live, transaction: { ...live.transaction, creationId: "original-B" } }), /HISTORY_ORIGIN_CONFLICT/);
  for (const recordIdentityFormat of [3, "2", null, false, 0]) {
    const future = { ...live, recordIdentityFormat }, before = JSON.stringify(future);
    assert.throws(() => original.chooseEntry(future, live), /HISTORY_FORMAT_UNSUPPORTED/);
    assert.throws(() => original.covers(future, live), /HISTORY_FORMAT_UNSUPPORTED/);
    assert.equal(JSON.stringify(future), before);
  }
});

test("migración no anuncia 'ya migrada' para una revisión que no entiende", async () => {
  let data = { hasOnboarded: true, historyFormat: 2, recordIdentityFormat: 3 };
  const root = { collection: () => ({}), get: async () => ({ exists: true, data: () => data }) };
  const db = { collection: () => ({ doc: () => root }), batch: () => assert.fail("no empezar escrituras") };
  await assert.rejects(original.migratePersonalHistory(db, "fixture"), /HISTORY_FORMAT_UNSUPPORTED/);
  assert.equal(data.recordIdentityFormat, 3);
  data = { ...data, recordIdentityFormat: 1 };
  assert.equal((await original.migratePersonalHistory(db, "fixture")).alreadyMigrated, true);
});

test("Admin no retira una recuperación confirmada por cubrirla con una lápida antigua", () => {
  const { rememberDeletion, rememberRestoration } = require("../src/record-mutations-shared");
  const { recordOriginOf } = require("../src/record-origin");
  const record = { id: 1, creationId: "fixture-origin", amount: 10 };
  const deleted = rememberDeletion({}, "transaction", [record], recordOriginOf, 10);
  const restored = rememberRestoration(deleted, "transaction", record, recordOriginOf, "fixture-restoration", 20);
  const old = { id: 1, deleted: true, origin: recordOriginOf(record), mutationMeta: deleted };
  const next = { id: 1, deleted: false, transaction: restored.record, mutationMeta: restored.metadata };
  const before = JSON.stringify([old, next]);
  assert.equal(original.covers(old, next), false, "la fuente recuperada todavía falta en el destino");
  assert.equal(original.chooseEntry(old, next).deleted, false, "la lápida anterior no deshace recuperar");
  assert.equal(original.covers(next, old), true);
  assert.equal(JSON.stringify([old, next]), before);
});

test("Admin rechaza datos privados o tipos inválidos dentro de la identidad del borrado", () => {
  const { recordDeletionIdentity, recordOriginOf } = require("../src/record-origin");
  const record = { id: 1, creationId: "fixture-A", amount: 10 };
  const identity = recordDeletionIdentity(record);
  for (const extra of [{ description: "NO CONSERVAR" }, { amount: 88 }, { captureId: 123 }]) {
    const entry = { id: 1, deleted: true, origin: recordOriginOf(record), recordIdentity: { ...identity, ...extra } };
    const before = JSON.stringify(entry);
    assert.throws(() => original.chooseEntry(null, entry), /HISTORY_ORIGIN_CONFLICT/);
    assert.equal(JSON.stringify(entry), before);
  }
});

test("Admin conserva una edición del shadow llegada entre lectura y commit", async () => {
  // Función original, con límite IO optimista adaptado. El SDK real tiene
  // su comprobación aparte; aquí no se presenta el reintento como Firestore.
  const source = { id: 99, creationId: "fixture-shadow-race", amount: 10, updatedAt: 100 };
  let rootData = { hasOnboarded: true, historyFormat: 1, recordIdentityFormat: 1,
    transactions: [source], deletedTransactionIds: [] };
  let row = { id: 99, deleted: false, transaction: { ...source, amount: 5, updatedAt: 50 } };
  let rowVersion = 1, rootVersion = 1, injected = false, transactionalReads = 0;
  const revision = version => ({ version, isEqual: other => other?.version === version });
  const rootSnapshot = () => {
    const data = structuredClone(rootData);
    return { exists: true, data: () => data, updateTime: revision(rootVersion) };
  };
  const rowSnapshot = () => {
    const data = structuredClone(row);
    return { exists: true, data: () => data, updateTime: revision(rowVersion) };
  };
  const querySnapshot = () => ({ docs: [{ id: "99", data: () => structuredClone(row) }] });
  const rowRef = { path: "users/fixture-shadow-race/history/99" };
  const history = { doc: id => { assert.equal(id, "99"); return rowRef; }, get: async () => querySnapshot() };
  const root = { get: async () => rootSnapshot(), collection: name => { assert.equal(name, "history"); return history; } };
  const inject = () => {
    if (injected) return;
    injected = true;
    row = { id: 99, deleted: false, transaction: { ...source, amount: 30, updatedAt: 200 } };
    rowVersion++;
  };
  const db = {
    collection: name => { assert.equal(name, "users"); return { doc: () => root }; },
    getAll: async () => [rowSnapshot()],
    batch: () => {
      let pending;
      return { set: (ref, data) => { assert.equal(ref, rowRef); pending = data; },
        commit: async () => { inject(); row = pending; rowVersion++; } };
    },
    runTransaction: async work => {
      for (let attempt = 0; attempt < 5; attempt++) {
        let readVersion, pendingRow, pendingRoot;
        const result = await work({
          get: async ref => {
            if (ref === root) return rootSnapshot();
            if (ref === history) { readVersion = rowVersion; return querySnapshot(); }
            assert.equal(ref, rowRef);
            transactionalReads++; readVersion = rowVersion;
            return rowSnapshot();
          },
          set: (ref, data) => { assert.equal(ref, rowRef); pendingRow = data; },
          update: (ref, data) => { assert.equal(ref, root); pendingRoot = data; },
        });
        // El escritor externo solo se intercala tras leer la fila, nunca
        // antes: la primera preparación utiliza realmente la copia de 5@50.
        if (readVersion !== undefined && pendingRow) inject();
        if (readVersion !== undefined && readVersion !== rowVersion) continue;
        if (pendingRow) { row = pendingRow; rowVersion++; }
        if (pendingRoot) { rootData = { ...rootData, ...pendingRoot }; rootVersion++; }
        return result;
      }
      assert.fail("la transacción adaptada no pudo confirmar");
    },
  };
  const result = await original.migratePersonalHistory(db, "fixture-shadow-race");
  assert.equal(injected, true, "la carrera debe ejecutarse también en la regresión");
  assert.equal(row.transaction.amount, 30, "no pisar la edición que llegó después de leer el shadow");
  assert.equal(row.transaction.updatedAt, 200);
  assert.ok(transactionalReads >= 2, "el límite IO repite la lectura tras el conflicto");
  assert.equal(rootData.historyFormat, 2);
  assert.equal(result.copied, 1);
  assert.equal(source.amount, 10, "la fuente no se modifica para hacer pasar la prueba");
});

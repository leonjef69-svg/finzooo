"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { prepareIncompleteBoxDeletion } = require("../src/incomplete-box-cleanup");
function database() {
  const data = new Map([
    ["boxSpaces/a_caja", { ownerUid: "a", nombre: "Caja", currency: "PEN", migrationComplete: false, migrationProtocol: 2 }],
    ["boxSpaces/a_caja/members/a", { rol: "owner" }], ["boxSpaces/a_caja/movements/mov", { monto: 100 }],
    ["boxUsers/a/spaces/a_caja", {}], ["boxUsers/a/spaces/missing", {}],
    ["boxSpaces/other", { ownerUid: "b", migrationComplete: false, migrationProtocol: 2 }],
    ["boxSpaces/real", { ownerUid: "a", migrationComplete: true }],
    ["boxUsers/a/spaces/real", {}], ["boxInvites/copy", { boxId: "a_caja" }], ["boxInvites/keep", { boxId: "real" }],
    ["cajas/a", { preserved: true }],
  ]);
  let calls = 0, failAt = 0;
  const snapshot = ref => ({ ref, id: ref.id, exists: data.has(ref.path), data: () => data.get(ref.path) });
  const doc = path => ({ path, id: path.split("/").at(-1), get: async () => snapshot(doc(path)), collection: name => collection(`${path}/${name}`) });
  function collection(path, filters = [], limit = Infinity, after = "") {
    return { doc: id => doc(`${path}/${id}`), where: (key, op, value) => { assert.equal(op, "=="); return collection(path, [...filters, [key, value]], limit, after); },
      limit: value => collection(path, filters, value, after), startAfter: snap => collection(path, filters, limit, snap.id), get: async () => {
        const docs = [...data.keys()].filter(key => key.startsWith(`${path}/`) && key.split("/").length === path.split("/").length + 1
          && key.split("/").at(-1) > after && filters.every(([field, value]) => data.get(key)[field] === value)).sort().slice(0, limit).map(key => snapshot(doc(key)));
        return { docs, empty: docs.length === 0 };
      } };
  }
  return { data, doc, collection, failAt: value => { failAt = value; },
    runTransaction: async work => {
      if (++calls === failAt) throw new Error("interrupted");
      const changes = [];
      const result = await work({ get: ref => ref.get(), update: (ref, values) => changes.push(() => data.set(ref.path, { ...data.get(ref.path), ...values })), delete: ref => changes.push(() => data.delete(ref.path)) });
      changes.forEach(change => change()); return result;
    } };
}
test("comprobación previa no escribe ni lee dinero de una copia nueva", async () => {
  const db = database(), before = [...db.data];
  assert.equal((await prepareIncompleteBoxDeletion(db, "a", "inspect")).ok, true);
  assert.deepEqual([...db.data], before);
});
test("descarta clones e índices faltantes, no origen, Caja real ni datos ajenos", async () => {
  const db = database(); await prepareIncompleteBoxDeletion(db, "a", "discard");
  assert.equal(db.data.get("boxSpaces/a_caja").migrationDeletionPending, true);
  assert.equal(db.data.get("boxSpaces/a_caja").closed, true);
  assert.equal(db.data.has("boxSpaces/a_caja/movements/mov"), false); assert.equal(db.data.has("boxInvites/copy"), false);
  assert.equal(db.data.has("boxSpaces/a_caja/members/a"), true); assert.equal(db.data.has("boxUsers/a/spaces/a_caja"), false);
  assert.equal(db.data.has("boxUsers/a/spaces/missing"), false); assert.deepEqual(db.data.get("cajas/a"), { preserved: true });
  assert.equal(db.data.has("boxSpaces/real"), true); assert.equal(db.data.has("boxUsers/a/spaces/real"), true); assert.equal(db.data.has("boxSpaces/other"), true);
  assert.equal(db.data.has("boxInvites/keep"), true);
  await prepareIncompleteBoxDeletion(db, "a", "deleted");
  assert.equal([...db.data.keys()].some(key => key.startsWith("boxSpaces/a_caja")), false);
});
test("un corte conserva la barrera y admite reintentar la limpieza", async () => {
  const db = database(); db.failAt(2);
  await assert.rejects(prepareIncompleteBoxDeletion(db, "a", "discard"), /interrupted/);
  assert.equal(db.data.get("boxSpaces/a_caja").closed, true); assert.equal(db.data.has("boxSpaces/a_caja/movements/mov"), true);
  await prepareIncompleteBoxDeletion(db, "a", "discard"); assert.equal(db.data.has("boxSpaces/a_caja/movements/mov"), false);
});
test("no purga copias con recibo completado, miembros invitados o ID inconsistente", async () => {
  for (const change of [
    db => db.data.set("privateBoxMigrations/a/operations/caja", { complete: true }),
    db => db.data.set("boxSpaces/a_caja/members/b", { rol: "member" }),
    db => { db.data.set("boxSpaces/invalid", db.data.get("boxSpaces/a_caja")); db.data.delete("boxSpaces/a_caja"); },
  ]) {
    const db = database(); change(db); const before = [...db.data];
    await assert.rejects(prepareIncompleteBoxDeletion(db, "a", "discard"), /incomplete-box-conflict/);
    assert.deepEqual([...db.data], before);
  }
});
test("el legado solo se limpia si cada clon coincide exactamente con su origen", async () => {
  const db = database(); delete db.data.get("boxSpaces/a_caja").migrationProtocol;
  const box = { id: "caja", nombre: "Caja", creadaEn: 1 }, row = { id: "mov", cajaId: "caja", tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-05", creadoEn: 2 };
  const { sharedBoxMovement } = require("../src/private-box-source");
  db.data.set("cajas/a", { cajas: [box], movimientos: [row] }); db.data.set("boxSpaces/a_caja/movements/mov", { ...sharedBoxMovement(row, "a"), monto: 90 });
  const before = [...db.data]; await assert.rejects(prepareIncompleteBoxDeletion(db, "a", "discard"), /incomplete-box-conflict/); assert.deepEqual([...db.data], before);
  db.data.set("boxSpaces/a_caja/movements/mov", sharedBoxMovement(row, "a"));
  await prepareIncompleteBoxDeletion(db, "a", "discard"); assert.equal(db.data.get("boxSpaces/a_caja").migrationProtocol, 3);
  db.data.delete("cajas/a"); await prepareIncompleteBoxDeletion(db, "a", "deleted"); assert.equal(db.data.has("boxSpaces/a_caja"), false);
});
test("recorre más de 100 raíces y de 400 clones sin omitir ni borrar otras cajas", async () => {
  const db = database();
  for (let i = 0; i < 105; i++) db.data.set(`boxSpaces/a_extra-${i}`, { ownerUid: "a", migrationComplete: false, migrationProtocol: 2 });
  for (let i = 0; i < 405; i++) db.data.set(`boxSpaces/a_caja/movements/extra-${i}`, { monto: 1 });
  await prepareIncompleteBoxDeletion(db, "a", "deleted");
  assert.equal([...db.data.keys()].some(key => key.startsWith("boxSpaces/a_")), false); assert.equal(db.data.has("boxSpaces/real"), true);
});

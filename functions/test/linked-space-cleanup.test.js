"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { finalizeLinkedSpaceDeletion } = require("../src/linked-space-cleanup");

function database() {
  const data = new Map([
    ["familySpaces/f", { ownerUid: "owner", deleting: true }],
    ["familySpaces/f/members/owner", {}], ["familySpaces/f/members/member", {}],
    ["familyUsers/owner", { activeFamilyId: "f", closedFamilyIds: ["f", "keep-owner"] }],
    ["familyUsers/owner/spaces/f", {}], ["familyUsers/member/spaces/f", {}],
    ["familyUsers/member", { activeFamilyId: "other-family", closedFamilyIds: ["f", "keep"], name: "private" }],
    ["familyUsers/member/spaces/other-family", {}],
    ["familyInvites/a", { familyId: "f" }], ["familyInvites/keep", { familyId: "different" }],
  ]);
  let calls = 0, failAt = 0;
  const snapshot = ref => ({ id: ref.id, ref, exists: data.has(ref.path), data: () => data.get(ref.path) });
  function doc(path) { const ref = { path, id: path.split("/").at(-1), get: async () => snapshot(ref),
    collection: name => collection(`${path}/${name}`) }; return ref; }
  function collection(path, max = Infinity, filter = null) {
    const ref = { path, query: true, doc: id => doc(`${path}/${id}`), limit: value => collection(path, value, filter),
      where: (field, _op, value) => collection(path, max, [field, value]), get: async () => {
        const docs = [...data.keys()].filter(key => key.startsWith(`${path}/`) && key.split("/").length === path.split("/").length + 1
          && (!filter || data.get(key)[filter[0]] === filter[1])).sort().slice(0, max).map(key => snapshot(doc(key)));
        return { docs, empty: docs.length === 0 };
      } }; return ref;
  }
  return { data, doc, collection, setFailure: value => { failAt = value; },
    batch: () => { const removed = []; return { delete: ref => removed.push(ref.path), commit: async () => removed.forEach(key => data.delete(key)) }; },
    runTransaction: async work => {
      if (++calls === failAt) throw new Error("interrupted");
      const writes = [];
      const value = await work({ get: ref => ref.get(), delete: ref => writes.push(() => data.delete(ref.path)),
        update: (ref, fields) => writes.push(() => data.set(ref.path, { ...data.get(ref.path), ...fields })) });
      writes.forEach(write => write()); return value;
    } };
}
const request = { kind: "family", spaceId: "f" };
test("finaliza índices sin leerlos en el cliente ni borrar otras Familias", async () => {
  const db = database();
  await finalizeLinkedSpaceDeletion(db, "owner", request);
  assert.equal(db.data.has("familySpaces/f"), false);
  assert.equal(db.data.has("familySpaces/f/members/owner"), false);
  assert.deepEqual(db.data.get("familyUsers/owner"), { activeFamilyId: "", closedFamilyIds: ["keep-owner"] });
  assert.deepEqual(db.data.get("familyUsers/member"), { activeFamilyId: "other-family", closedFamilyIds: ["keep"], name: "private" });
  assert.equal(db.data.has("familyUsers/member/spaces/f"), false);
  assert.equal(db.data.has("familyUsers/member/spaces/other-family"), true);
  assert.equal(db.data.has("familyInvites/a"), false); assert.equal(db.data.has("familyInvites/keep"), true);
});
test("no finaliza espacios ajenos, activos ni con movimientos pendientes", async () => {
  for (const [change, uid, reason] of [
    [() => {}, "member", "cleanup-not-owner"],
    [db => { db.data.get("familySpaces/f").deleting = false; }, "owner", "cleanup-not-prepared"],
    [db => { db.data.set("familySpaces/f/movements/unremoved", { monto: 100 }); }, "owner", "cleanup-movements-remain"],
  ]) {
    const db = database(); change(db); const before = [...db.data];
    await assert.rejects(finalizeLinkedSpaceDeletion(db, uid, request), error => error.reason === reason);
    assert.deepEqual([...db.data], before);
  }
  await assert.rejects(finalizeLinkedSpaceDeletion(database(), "owner", { ...request, spaceId: "../x" }));
});
test("una interrupción conserva al propietario y permite reanudar", async () => {
  const db = database(); db.setFailure(2);
  await assert.rejects(finalizeLinkedSpaceDeletion(db, "owner", request), /interrupted/);
  assert.equal(db.data.has("familySpaces/f"), true);
  assert.equal(db.data.has("familySpaces/f/members/owner"), true);
  assert.equal(db.data.get("familyUsers/owner").activeFamilyId, "f");
  assert.equal(db.data.has("familyUsers/owner/spaces/f"), true);
  await finalizeLinkedSpaceDeletion(db, "owner", request);
  assert.equal(db.data.has("familySpaces/f"), false);
});
test("recorre varias páginas de miembros e invitaciones sin un lote excesivo", async () => {
  const db = database();
  for (let index = 0; index < 205; index++) {
    db.data.set(`familySpaces/f/members/member-${index}`, {});
    db.data.set(`familyUsers/member-${index}/spaces/f`, {});
    db.data.set(`familyInvites/i-${index}`, { familyId: "f" });
  }
  await finalizeLinkedSpaceDeletion(db, "owner", request);
  assert.equal([...db.data.keys()].some(key => key.startsWith("familySpaces/f/")), false);
  assert.equal([...db.data.values()].some(row => row.familyId === "f"), false);
});

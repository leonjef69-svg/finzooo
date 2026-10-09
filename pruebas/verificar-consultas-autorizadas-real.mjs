import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
const requireProject = createRequire(new URL("../functions/index.js", import.meta.url));
const auth = uid => ({ uid, token: { email_verified: true } });
const clone = value => structuredClone(value);
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
function environment(initial) {
  const documents = new Map(Object.entries(initial).map(([key, value]) => [key, clone(value)]));
  const reads = [], writes = [];
  let wrote = false;
  const snapshot = ref => ({ ref, exists: documents.has(ref.path), data: () => documents.get(ref.path) });
  const collection = (path, filter = null, count = Infinity) => ({ path, query: true, filter, count, doc: id => doc(path + "/" + id),
    where: (field, operator, value) => { assert.equal(operator, "=="); return collection(path, { field, value }, count); },
    limit: count => collection(path, filter, count) });
  const doc = path => ({ path, collection: name => collection(path + "/" + name), get: async () => snapshot(doc(path)) });
  const get = async ref => {
    assert.equal(wrote, false, "la transacción conserva todas las lecturas antes de la primera escritura");
    reads.push(ref.path + (ref.filter ? "?own" : ""));
    if (!ref.query) return snapshot(ref);
    const prefix = ref.path + "/";
    const docs = [...documents.keys()].filter(key => key.startsWith(prefix) && !key.slice(prefix.length).includes("/")
      && (!ref.filter || ref.filter.field.split(".").reduce((value, field) => value?.[field], documents.get(key)) === ref.filter.value))
      .slice(0, ref.count).map(key => snapshot(doc(key)));
    return { docs, empty: docs.length === 0 };
  };
  const write = (kind, ref, value) => {
    wrote = true; writes.push({ kind, path: ref.path, value });
    if (kind === "delete") documents.delete(ref.path);
    else documents.set(ref.path, kind === "update" ? { ...documents.get(ref.path), ...value } : clone(value));
  };
  const tx = { get, getAll: async (...refs) => {
    const mask = refs.find(ref => Array.isArray(ref.fieldMask))?.fieldMask;
    return Promise.all(refs.filter(ref => ref.path).map(async ref => {
      const result = await get(ref);
      return mask ? { ...result, data: () => result.exists ? Object.fromEntries(Object.entries(result.data()).filter(([key]) => mask.includes(key))) : undefined } : result;
    }));
  },
    update: (ref, value) => write("update", ref, value), set: (ref, value) => write("set", ref, value), delete: ref => write("delete", ref) };
  const db = { doc, collection, runTransaction: async work => { wrote = false; return work(tx); },
    batch: () => ({ update: (ref, value) => write("update", ref, value), commit: async () => {} }) };
  const legacy = { region: () => legacy, runWith: () => legacy, auth: { user: () => ({ onDelete: handler => handler }) } };
  const scope = { module: { exports: {} }, Date, console, require: name => {
    if (name === "firebase-admin/app") return { initializeApp() {} };
    if (name === "firebase-admin/firestore") return { getFirestore: () => db };
    if (name === "firebase-admin/auth") return { getAuth: () => { throw new Error("Auth externo no permitido"); } };
    if (name === "firebase-functions/v1") return legacy;
    if (name === "firebase-functions/v2/https") return { HttpsError, onCall: (_options, handler) => handler, onRequest: (_options, handler) => handler };
    if (name === "firebase-functions/v2/firestore") return { onDocumentDeleted: (_options, handler) => handler };
    if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_options, handler) => handler };
    if (name === "firebase-functions/params") return { defineSecret: () => ({ value: () => { throw new Error("Secretos no permitidos"); } }) };
    return requireProject(name);
  } };
  scope.exports = scope.module.exports;
  vm.runInNewContext(read("functions/index.js"), scope);
  return { api: scope.module.exports, documents, reads, writes, bulk: () => reads.filter(path => /\/movements$/.test(path)).length };
}
const { DOCUMENTS } = requireProject("./src/legal-acceptance");
const receipt = uid => ({ format: 1, uid, ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt: Date.now() - 1000 });
for (const kind of ["family", "box"]) {
  const base = (kind === "family" ? "familySpaces" : "boxSpaces") + "/fixture";
  const contribution = { tipo: "ingreso", monto: 100, personalTransactionId: 1, personalOwnerUid: "member", creadoPor: "member" };
  const data = { [base]: { ownerUid: "owner" }, [base + "/members/member"]: { uid: "member" },
    [base + "/movements/contribution"]: contribution, "users/owner": { isPremium: true } };
  for (const [name, args] of [
    ["changePersonalContribution", { kind, spaceId: "fixture", movementId: "contribution", action: "delete" }],
    ["manageLinkedSpace", { kind, spaceId: "fixture", action: "close" }],
    ["leaveLinkedSpace", { kind, spaceId: "fixture", targetUid: "member" }],
  ]) {
    const env = environment(data), before = [...env.documents];
    await assert.rejects(env.api[name]({ auth: auth("stranger"), data: args }), error => ["permission-denied", "failed-precondition"].includes(error.code));
    assert.equal(env.bulk(), 0, name + ": rechazar al usuario ajeno antes de leer todo el libro");
    assert.deepEqual([...env.documents], before);
    assert.equal(env.writes.length, 0);
    const noAuth = environment(data);
    await assert.rejects(noAuth.api[name]({ data: args }), error => error.code === "unauthenticated");
    assert.equal(noAuth.reads.length, 0);
  }
  for (const owner of ["member", "owner"]) {
    const env = environment(data);
    if (owner === "owner") {
      await assert.rejects(env.api.changePersonalContribution({ auth: auth(owner), data: { kind, spaceId: "fixture", movementId: "contribution", action: "delete" } }), error => error.code === "failed-precondition");
      assert.equal(env.bulk(), 0, "sin membresía no se descarga el libro");
    } else {
      await env.api.changePersonalContribution({ auth: auth(owner), data: { kind, spaceId: "fixture", movementId: "contribution", action: "delete" } });
      assert.equal(env.bulk(), 1);
      assert.equal(env.documents.has(base + "/movements/contribution"), false);
      assert.equal(env.writes.length, 1);
    }
  }
  const updated = environment({ ...data, "legalAcceptances/member": receipt("member") });
  await updated.api.changePersonalContribution({ auth: auth("member"), data: { kind, spaceId: "fixture", movementId: "contribution", action: "update", amount: 120, description: "Corregido" } });
  assert.equal(updated.documents.get(base + "/movements/contribution").monto, 120);
  assert.equal(updated.bulk(), 1);
  const spent = { ...data, [base + "/movements/spent"]: { tipo: "gasto", monto: 100, creadoPor: "owner" } };
  const deniedDelete = environment(spent);
  await assert.rejects(deniedDelete.api.changePersonalContribution({ auth: auth("member"), data: { kind, spaceId: "fixture", movementId: "contribution", action: "delete" } }), error => error.code === "failed-precondition");
  assert.equal(deniedDelete.writes.length, 0);
  const closed = environment(spent);
  await closed.api.manageLinkedSpace({ auth: auth("owner"), data: { kind, spaceId: "fixture", action: "close" } });
  assert.equal(closed.documents.get(base).closed, true);
  assert.equal(closed.bulk(), 1);
  assert.equal(closed.documents.get(base + "/movements/contribution").monto, 100);
  const pending = environment(data);
  await assert.rejects(pending.api.manageLinkedSpace({ auth: auth("owner"), data: { kind, spaceId: "fixture", action: "close" } }), error => error.code === "failed-precondition");
  assert.equal(pending.writes.length, 0);
  const already = environment({ ...data, [base]: { ownerUid: "owner", deleting: true } });
  await already.api.manageLinkedSpace({ auth: auth("owner"), data: { kind, spaceId: "fixture", action: "prepare-delete" } });
  assert.equal(already.bulk(), 0);
  const leaving = environment(spent);
  await leaving.api.leaveLinkedSpace({ auth: auth("member"), data: { kind, spaceId: "fixture" } });
  assert.equal(leaving.documents.has(base + "/members/member"), false);
  assert.equal(leaving.documents.get(base + "/movements/contribution").personalOwnerUid, "deleted");
  assert.equal(leaving.bulk(), 1);
  const absentMember = { ...spent };
  delete absentMember[base + "/members/member"];
  const interrupted = environment(absentMember);
  await interrupted.api.leaveLinkedSpace({ auth: auth("member"), data: { kind, spaceId: "fixture" } });
  assert.equal(interrupted.documents.get(base + "/movements/contribution").personalOwnerUid, "deleted");
  assert.equal(interrupted.bulk(), 1, "un exmiembro con anonimización pendiente puede reintentar");
  const strangerSelf = environment(data), strangerBefore = [...strangerSelf.documents];
  await strangerSelf.api.leaveLinkedSpace({ auth: auth("stranger"), data: { kind, spaceId: "fixture" } });
  assert.equal(strangerSelf.bulk(), 0, "un extraño tampoco descarga el libro usando una salida propia ficticia");
  assert.deepEqual([...strangerSelf.documents], strangerBefore);
  assert.equal(strangerSelf.writes.length, 0);
  const finished = environment(leaving.documents ? Object.fromEntries(leaving.documents) : {});
  await finished.api.leaveLinkedSpace({ auth: auth("member"), data: { kind, spaceId: "fixture" } });
  assert.equal(finished.bulk(), 0, "una salida ya anonimizada no vuelve a descargar el libro");
  const partial = environment({ ...data, [base + "/movements/spent"]: { tipo: "gasto", monto: 60 } });
  await assert.rejects(partial.api.leaveLinkedSpace({ auth: auth("member"), data: { kind, spaceId: "fixture" } }), error => error.code === "failed-precondition");
  assert.equal(partial.writes.length, 0);
  const returned = { uid: "member", kind, spaceId: "fixture", movementId: "returned", personalTransactionId: 2, amount: 40 };
  const undone = environment({ ...data, [base + "/movements/returned"]: { tipo: "gasto", monto: 40, personalOwnerUid: "member",
    personalTransactionId: 2, personalReturnAmount: 40, personalReturnReceipt: returned } });
  await undone.api.changePersonalContribution({ auth: auth("member"), data: { kind, spaceId: "fixture", movementId: "returned", action: "delete" } });
  assert.equal(undone.bulk(), 0, "deshacer una devolución no necesita descargar el libro");
  await undone.api.changePersonalContribution({ auth: auth("member"), data: { kind, spaceId: "fixture", movementId: "returned", action: "delete" } });
  assert.equal(undone.bulk(), 0, "la confirmación repetida tampoco descarga el libro");
}
console.log("Envolturas originales/SDK adaptado: denegaciones comprobadas antes de leer el libro, operaciones legítimas y dinero preservados. No prueba Firestore real ni limita todo abuso.");

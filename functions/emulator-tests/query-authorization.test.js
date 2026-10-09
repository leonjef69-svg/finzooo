"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { execFileSync } = require("node:child_process"), { createRequire } = require("node:module");
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080", "solo Firestore local");
test("consultas autorizadas: envolturas originales y transacciones Firestore reales", async t => {
  const projectId = "demo-fino-query-access";
  const env = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080,
    rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") } });
  const app = initializeApp({ projectId }, "query-access-audit"), db = getFirestore(app);
  const bulkReads = [];
  const permissionMasks = [];
  const observed = { doc: value => db.doc(value), collection: value => db.collection(value), batch: () => db.batch(),
    getAll: (...values) => db.getAll(...values), runTransaction: work => db.runTransaction(tx => Promise.resolve(work({
      get: ref => { if (typeof ref.path === "string" && /\/movements$/.test(ref.path)) bulkReads.push(ref.path); return tx.get(ref); },
      getAll: (...refs) => {
        const mask = refs.find(value => Array.isArray(value.fieldMask))?.fieldMask;
        if (mask?.includes("isPremium")) permissionMasks.push(mask);
        return tx.getAll(...refs);
      }, set: (...args) => tx.set(...args), update: (...args) => tx.update(...args), delete: ref => tx.delete(ref),
    }))) };
  const indexPath = path.resolve(__dirname, "../index.js"), own = createRequire(indexPath);
  const legacy = { region: () => legacy, runWith: () => legacy, auth: { user: () => ({ onDelete: handler => handler }) } };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const scope = { module: { exports: {} }, Date, console, require: name => {
    if (name === "firebase-admin/app") return { initializeApp() {} };
    if (name === "firebase-admin/firestore") return { getFirestore: () => observed };
    if (name === "firebase-admin/auth") return { getAuth: () => { throw new Error("Auth externo no permitido"); } };
    if (name === "firebase-functions/v1") return legacy;
    if (name === "firebase-functions/v2/https") return { HttpsError, onCall: (_opts, handler) => handler, onRequest: (_opts, handler) => handler };
    if (name === "firebase-functions/v2/firestore") return { onDocumentDeleted: (_opts, handler) => handler };
    if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_opts, handler) => handler };
    if (name === "firebase-functions/params") return { defineSecret: () => ({ value: () => { throw new Error("Secretos no permitidos"); } }) };
    return own(name);
  } };
  scope.exports = scope.module.exports;
  const baseline = process.env.FINO_TEST_PERMISSION_READ_BASELINE;
  if (baseline && !/^[a-f0-9]{7,40}$/i.test(baseline)) throw new Error("Hash no válido");
  const source = baseline ? execFileSync("git", ["show", baseline + ":functions/index.js"], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" }) : fs.readFileSync(indexPath, "utf8");
  vm.runInNewContext(source, scope);
  const api = scope.module.exports, auth = uid => ({ uid, token: { email_verified: true } });
  const { DOCUMENTS } = own("./src/legal-acceptance");
  try {
    await env.clearFirestore();
    await db.doc("users/owner").set({ isPremium: true });
    await db.doc("legalAcceptances/member").set({ format: 1, uid: "member", ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt: Date.now() - 1000 });
    for (const kind of ["family", "box"]) {
      const collection = kind === "family" ? "familySpaces" : "boxSpaces", id = kind + "-query", ref = db.doc(collection + "/" + id);
      const member = ref.collection("members").doc("member");
      const contribution = ref.collection("movements").doc("contribution");
      const row = { tipo: "ingreso", monto: 100, personalTransactionId: 1, personalOwnerUid: "member", creadoPor: "member" };
      await ref.set({ ownerUid: "owner", nombre: "Fixture", currency: "PEN" });
      await member.set({ uid: "member" });
      await contribution.set(row);
      await t.test(kind + ": tres denegaciones no descargan el historial", async () => {
        for (const [name, data] of [
          ["changePersonalContribution", { kind, spaceId: id, movementId: "contribution", action: "delete" }],
          ["manageLinkedSpace", { kind, spaceId: id, action: "close" }],
          ["leaveLinkedSpace", { kind, spaceId: id, targetUid: "member" }],
        ]) {
          bulkReads.length = 0;
          await assert.rejects(api[name]({ auth: auth("stranger"), data }), error => ["permission-denied", "failed-precondition"].includes(error.code));
          assert.equal(bulkReads.length, 0, name + ": el libro no se consulta antes de rechazar");
          assert.deepEqual((await contribution.get()).data(), row);
        }
      });
      await t.test(kind + ": una salida propia ficticia tampoco descarga el libro ni cambia datos", async () => {
        bulkReads.length = 0;
        await api.leaveLinkedSpace({ auth: auth("stranger"), data: { kind, spaceId: id } });
        assert.equal(bulkReads.length, 0);
        assert.deepEqual((await contribution.get()).data(), row);
        assert.equal((await member.get()).exists, true);
      });
      await t.test(kind + ": editar y borrar un aporte intacto mantiene las transacciones originales", async () => {
        bulkReads.length = 0;
        permissionMasks.length = 0;
        await api.changePersonalContribution({ auth: auth("member"), data: { kind, spaceId: id, movementId: "contribution", action: "update", amount: 120, description: "Corregido" } });
        assert.equal((await contribution.get()).data().monto, 120);
        assert.equal(bulkReads.length, 1);
        assert.deepEqual(permissionMasks.map(mask => Array.from(mask)), [["isPremium", "premiumTrialStartedAt", "accountDeletionPending"]],
          "Pro se comprueba dentro de la transacción y sin leer finanzas ni fotos del propietario");
        await api.changePersonalContribution({ auth: auth("member"), data: { kind, spaceId: id, movementId: "contribution", action: "delete" } });
        assert.equal((await contribution.get()).exists, false);
        await contribution.set(row);
      });
      await t.test(kind + ": dinero pendiente no permite salir ni borrar", async () => {
        await assert.rejects(api.leaveLinkedSpace({ auth: auth("member"), data: { kind, spaceId: id } }), error => error.code === "failed-precondition");
        await ref.collection("movements").doc("spent").set({ tipo: "gasto", monto: 100, creadoPor: "owner" });
        await assert.rejects(api.changePersonalContribution({ auth: auth("member"), data: { kind, spaceId: id, movementId: "contribution", action: "delete" } }), error => error.code === "failed-precondition");
        assert.equal((await contribution.get()).data().monto, 100);
      });
      await t.test(kind + ": salida interrumpida admite reintento, incluida solo una referencia de devolución pendiente", async () => {
        await member.delete(); // Simula el tramo confirmado antes de fallar la anonimización.
        await api.leaveLinkedSpace({ auth: auth("member"), data: { kind, spaceId: id } });
        assert.equal((await contribution.get()).data().personalOwnerUid, "deleted");
        assert.equal((await contribution.get()).data().creadoPor, "deleted");
        bulkReads.length = 0;
        await api.leaveLinkedSpace({ auth: auth("member"), data: { kind, spaceId: id } });
        assert.equal(bulkReads.length, 0, "ya anonimizado no vuelve a descargar el libro");
        const remaining = ref.collection("movements").doc("receipt-only");
        await remaining.set({ tipo: "gasto", monto: 1, creadoPor: "deleted", personalOwnerUid: "deleted", personalReturnReceipt: { uid: "member" } });
        // Dinero ficticio válido: gasto e ingreso compensados. Un monto cero
        // debe ser rechazado por la protección financiera, no por este cambio.
        await ref.collection("movements").doc("receipt-offset").set({ tipo: "ingreso", monto: 1, creadoPor: "owner" });
        await api.leaveLinkedSpace({ auth: auth("member"), data: { kind, spaceId: id } });
        assert.equal((await remaining.get()).data().personalReturnReceipt.uid, "deleted");
      });
      await t.test(kind + ": cerrar conserva dinero consumido e historial, y reintentar borrado no descarga", async () => {
        await api.manageLinkedSpace({ auth: auth("owner"), data: { kind, spaceId: id, action: "close" } });
        assert.equal((await ref.get()).data().closed, true);
        await api.manageLinkedSpace({ auth: auth("owner"), data: { kind, spaceId: id, action: "prepare-delete" } });
        bulkReads.length = 0;
        await api.manageLinkedSpace({ auth: auth("owner"), data: { kind, spaceId: id, action: "prepare-delete" } });
        assert.equal(bulkReads.length, 0);
        assert.equal((await contribution.get()).data().monto, 100);
      });
    }
  } finally { await env.cleanup(); await deleteApp(app); }
});

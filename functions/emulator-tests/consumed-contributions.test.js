"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { initializeTestEnvironment, assertFails } = require("@firebase/rules-unit-testing");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { doc, updateDoc } = require("firebase/firestore");

test("aportes consumidos: transacciones reales de cierre y preflight sin Pro", async t => {
  const env = await initializeTestEnvironment({ projectId: "demo-fino-consumed", firestore: {
    host: "127.0.0.1", port: 8080, rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
  } });
  const app = initializeApp({ projectId: "demo-fino-consumed" }, "consumed-contributions");
  const db = getFirestore(app);
  // El SDK comprueba instanceof Promise. Las funciones se ejecutan en otro
  // contexto JS: convertir solo su promesa al contexto del SDK evita un falso
  // error de la herramienta. La transacción/lecturas/escrituras siguen reales.
  const transactionDb = { doc: value => db.doc(value), collection: value => db.collection(value), batch: () => db.batch(),
    getAll: (...values) => db.getAll(...values), runTransaction: work => db.runTransaction(tx => Promise.resolve(work(tx))) };
  const indexPath = path.resolve(__dirname, "../index.js");
  const requireProject = createRequire(indexPath);
  const legacy = { region: () => legacy, runWith: () => legacy, auth: { user: () => ({ onDelete: handler => handler }) } };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const scope = { exports: {}, module: { exports: {} }, Date, console, require: name => {
    if (name === "firebase-admin/app") return { initializeApp() {} };
    if (name === "firebase-admin/firestore") return { getFirestore: () => transactionDb };
    if (name === "firebase-admin/auth") return { getAuth: () => { throw new Error("AUTH_UNEXPECTED"); } };
    if (name === "firebase-functions/v1") return legacy;
    if (name === "firebase-functions/v2/https") return { onCall: (_options, handler) => handler, onRequest: (_options, handler) => handler, HttpsError };
    if (name === "firebase-functions/v2/firestore") return { onDocumentDeleted: (_options, handler) => handler };
    if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_options, handler) => handler };
    if (name === "firebase-functions/params") return { defineSecret: () => ({ value: () => "UNUSED" }) };
    return requireProject(name);
  } };
  scope.exports = scope.module.exports;
  vm.runInNewContext(fs.readFileSync(indexPath, "utf8"), scope);
  const api = scope.module.exports;
  const auth = { uid: "owner", token: { email_verified: true } };
  const contribution = { tipo: "ingreso", monto: 100, personalTransactionId: 10, personalOwnerUid: "owner", creadoPor: "owner" };
  try {
    await env.clearFirestore();
    await db.doc("users/owner").set({ isPremium: false, transactions: [{ id: 10, type: "expense", amount: 100, internalTransfer: "family" }] });
    for (const kind of ["family", "box"]) {
      const collection = kind === "family" ? "familySpaces" : "boxSpaces";
      const id = `${kind}-consumed`;
      const ref = db.doc(`${collection}/${id}`);
      await ref.set({ ownerUid: "owner", closed: false, nombre: "Fixture", currency: "PEN" });
      await ref.collection("members").doc("owner").set({ uid: "owner", rol: "owner" });
      await ref.collection("movements").doc("contribution").set(contribution);
      await ref.collection("movements").doc("spent").set({ tipo: "gasto", monto: 100 });
      await t.test(`${kind}: un aporte gastado permite cerrar y preparar borrado sin Pro`, async () => {
        const client = env.authenticatedContext("owner", { email_verified: true }).firestore();
        await assertFails(updateDoc(doc(client, collection, id), { closed: true }));
        await api.manageLinkedSpace({ auth, data: { kind, spaceId: id, action: "close" } });
        assert.equal((await ref.get()).data().closed, true);
        assert.equal((await ref.collection("movements").get()).size, 2, "cerrar conserva historial compartido");
        assert.equal((await db.doc("users/owner").get()).data().transactions[0].amount, 100, "no abona dinero consumido a Personal");
        await api.manageLinkedSpace({ auth, data: { kind, spaceId: id, action: "prepare-delete" } });
        assert.equal((await ref.get()).data().deleting, true);
      });
    }
    await t.test("saldo disponible y usuario ajeno siguen bloqueados", async () => {
      const ref = db.doc("familySpaces/pending");
      await ref.set({ ownerUid: "owner" });
      await ref.collection("movements").doc("contribution").set(contribution);
      await ref.collection("movements").doc("spent").set({ tipo: "gasto", monto: 60 });
      await assert.rejects(api.manageLinkedSpace({ auth, data: { kind: "family", spaceId: "pending", action: "close" } }), error => error.code === "failed-precondition");
      await assert.rejects(api.manageLinkedSpace({ auth: { uid: "stranger", token: { email_verified: true } }, data: { kind: "family", spaceId: "pending", action: "close" } }), error => error.code === "permission-denied");
      assert.equal((await ref.get()).data().closed, undefined);
    });
    await t.test("un miembro con aporte consumido puede salir sin borrar cuentas ajenas", async () => {
      const ref = db.doc("familySpaces/member-spent");
      await ref.set({ ownerUid: "owner" });
      await ref.collection("members").doc("member").set({ uid: "member" });
      await db.doc("familyUsers/member/spaces/member-spent").set({ nombre: "Fixture" });
      await ref.collection("movements").doc("contribution").set({ ...contribution, personalOwnerUid: "member", creadoPor: "member" });
      await ref.collection("movements").doc("spent").set({ tipo: "gasto", monto: 100, creadoPor: "owner" });
      await api.leaveLinkedSpace({ auth: { uid: "member", token: { email_verified: true } }, data: { kind: "family", spaceId: "member-spent" } });
      assert.equal((await ref.collection("members").doc("member").get()).exists, false);
      assert.equal((await ref.collection("movements").doc("contribution").get()).data().personalOwnerUid, "deleted");
      assert.equal((await db.doc("users/owner").get()).exists, true);
    });
  } finally {
    await env.cleanup();
    await deleteApp(app);
  }
});

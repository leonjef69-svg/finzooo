"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { createRequire } = require("node:module");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { doc, setDoc, updateDoc, serverTimestamp } = require("firebase/firestore");

test("devolución sin Pro: límites reales, reintentos, concurrencia y migración histórica", async t => {
  const env = await initializeTestEnvironment({ projectId: "demo-fino-return", firestore: { host: "127.0.0.1", port: 8080,
    rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") } });
  const app = initializeApp({ projectId: "demo-fino-return" }, "personal-return-test");
  const db = getFirestore(app);
  const facade = { doc: value => db.doc(value), collection: value => db.collection(value), batch: () => db.batch(),
    getAll: (...values) => db.getAll(...values), runTransaction: work => db.runTransaction(tx => Promise.resolve(work(tx))) };
  const indexPath = path.resolve(__dirname, "../index.js"), requireProject = createRequire(indexPath);
  const legacy = { region: () => legacy, runWith: () => legacy, auth: { user: () => ({ onDelete: handler => handler }) } };
  let disabled = false;
  class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
  const scope = { module: { exports: {} }, exports: {}, Date, console, require: name => {
    if (name === "firebase-admin/app") return { initializeApp() {} };
    if (name === "firebase-admin/firestore") return { getFirestore: () => facade };
    if (name === "firebase-admin/auth") return { getAuth: () => ({ getUser: async () => ({ disabled, emailVerified: true }) }) };
    if (name === "firebase-functions/v1") return legacy;
    if (name === "firebase-functions/v2/https") return { onCall: (_options, handler) => handler, onRequest: (_options, handler) => handler, HttpsError };
    if (name === "firebase-functions/v2/firestore") return { onDocumentDeleted: (_options, handler) => handler };
    if (name === "firebase-functions/v2/scheduler") return { onSchedule: (_options, handler) => handler };
    if (name === "firebase-functions/params") return { defineSecret: () => ({ value: () => "UNUSED" }) };
    return requireProject(name);
  } };
  scope.exports = scope.module.exports;
  const baseline = process.env.FINO_TEST_RETURN_BASELINE;
  if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresión requiere un hash de Git.");
  vm.runInNewContext(baseline ? execFileSync("git", ["show", `${baseline}:functions/index.js`], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" })
    : fs.readFileSync(indexPath, "utf8"), scope);
  const api = scope.module.exports, auth = { uid: "owner", token: { email_verified: true } };
  const contribution = { tipo: "ingreso", monto: 100, personalTransactionId: 10, personalOwnerUid: "owner", creadoPor: "owner", creadoEn: 1 };
  const payload = { kind: "family", spaceId: "f", amount: 40, personalTransactionId: 100,
    currency: "PEN", fecha: "2026-10-05", description: "Devolver" };
  async function seed(root, id) {
    await db.doc(`${root}/${id}`).set({ ownerUid: "owner", nombre: "Casa", currency: "PEN" });
    await db.doc(`${root}/${id}/members/owner`).set({ uid: "owner", rol: "owner", nombre: "Fixture" });
    await db.doc(`${root}/${id}/movements/contribution`).set(contribution);
    await db.doc(`${root}/${id}/movements/spent`).set({ tipo: "gasto", monto: 60, creadoPor: "owner", creadoEn: 2 });
  }
  try {
    await env.clearFirestore();
    await db.doc("users/owner").set({ isPremium: false, premiumTrialStartedAt: Date.now() - 86_401_000 });
    await seed("familySpaces", "f"); await seed("boxSpaces", "b");
    let receipt;
    await t.test("vence Pro: devuelve S/40, no exige pago ni descarga Personal", async () => {
      receipt = await api.returnPersonalContribution({ auth, data: { ...payload, uid: "victim" } });
      assert.equal(receipt.uid, "owner"); assert.equal(receipt.amount, 40);
      assert.equal((await db.doc("users/owner").get()).data().isPremium, false);
      assert.equal((await db.collection("familySpaces/f/movements").get()).size, 3);
      assert.equal((await db.doc("users/owner").get()).data().transactions, undefined);
    });
    await t.test("repetir el identificador devuelve el mismo resultado y permite cerrar", async () => {
      assert.deepEqual(await api.returnPersonalContribution({ auth, data: payload }), receipt);
      await api.manageLinkedSpace({ auth, data: { kind: "family", spaceId: "f", action: "close" } });
      assert.deepEqual(await api.returnPersonalContribution({ auth, data: payload }), receipt, "un resultado confirmado se puede recuperar aun cerrado");
      assert.equal((await db.collection("familySpaces/f/movements").get()).size, 3);
    });
    await t.test("dos solicitudes de Caja simultáneas solo confirman una", async () => {
      const result = await Promise.allSettled([200, 201].map(personalTransactionId => api.returnPersonalContribution({ auth,
        data: { ...payload, kind: "box", spaceId: "b", personalTransactionId } })));
      assert.equal(result.filter(item => item.status === "fulfilled").length, 1);
      assert.equal((await db.collection("boxSpaces/b/movements").get()).size, 3);
    });
    await t.test("no confirmado, usuario deshabilitado y dinero ajeno no autorizan devolución", async () => {
      await seed("familySpaces", "foreign");
      await db.doc("familySpaces/foreign/members/guest").set({ uid: "guest", rol: "member" });
      await assert.rejects(api.returnPersonalContribution({ auth: { uid: "owner", token: { email_verified: false } }, data: payload }), e => e.code === "unauthenticated");
      disabled = true;
      await assert.rejects(api.returnPersonalContribution({ auth, data: payload }), e => e.code === "unauthenticated"); disabled = false;
      await assert.rejects(api.returnPersonalContribution({ auth: { uid: "guest", token: { email_verified: true } }, data: { ...payload, spaceId: "foreign" } }), e => e.details?.reason === "return-changed");
      assert.equal((await db.collection("familySpaces/foreign/movements").get()).size, 2);
    });
    await t.test("ni Pro puede saltarse el servicio mediante una devolución SDK directa", async () => {
      await db.doc("users/owner").update({ isPremium: true });
      const client = env.authenticatedContext("owner", { email_verified: true }).firestore();
      const row = { tipo: "gasto", monto: 40, descripcion: "Devolver", method: "transfer", fecha: "2026-10-05", creadoPor: "owner", creadoEn: serverTimestamp(),
        personalTransactionId: 300, personalOwnerUid: "owner", personalReturnAmount: 40 };
      await assertFails(setDoc(doc(client, "familySpaces", "foreign", "movements", "direct-return"), row));
      await assertSucceeds(setDoc(doc(client, "familySpaces", "foreign", "movements", "ordinary"), {
        tipo: "gasto", monto: 1, descripcion: "Normal", method: "cash", fecha: "2026-10-05", creadoPor: "owner", creadoEn: serverTimestamp() }));
    });
    await t.test("historia de Caja privada: solo copia exacta y no puede reabrir la migración", async () => {
      const id = "owner_caja-private", root = db.doc(`boxSpaces/${id}`);
      await root.set({ ownerUid: "owner", nombre: "Caja", currency: "PEN", migrationComplete: false });
      await root.collection("members").doc("owner").set({ uid: "owner" });
      const original = { id: "old-return", cajaId: "caja-private", tipo: "gasto", monto: 40, descripcion: "Devuelto", fecha: "2026-10-04", creadoEn: 123,
        personalTransactionId: 400, personalReturnAmount: 40, method: "transfer" };
      await db.doc("cajas/owner").set({ movimientos: [original] });
      const client = env.authenticatedContext("owner", { email_verified: true }).firestore();
      const { id: _id, cajaId: _box, ...fields } = original; void _id; void _box;
      const row = { ...fields, creadoPor: "owner", personalOwnerUid: "owner", migrationSourceIndex: 0 };
      await assertFails(setDoc(doc(client, "boxSpaces", id, "movements", "forged"), row));
      await assertSucceeds(setDoc(doc(client, "boxSpaces", id, "movements", original.id), row));
      await assertFails(updateDoc(doc(client, "boxSpaces", id), { migrationComplete: true }));
      // Esta prueba aísla permisos. La confirmación administrativa completa se
      // ejecuta y valida por HTTP en private-box-migration.test.js.
      await root.update({ migrationComplete: true });
      await assertFails(updateDoc(doc(client, "boxSpaces", id), { migrationComplete: false }));
      await assertFails(setDoc(doc(client, "boxSpaces", id, "movements", "later"), row));
    });
    await t.test("salir anonimiza también el UID del comprobante de devolución", async () => {
      await seed("familySpaces", "anonymize");
      await db.doc("familySpaces/anonymize").update({ ownerUid: "different-owner" });
      const row = await api.returnPersonalContribution({ auth, data: { ...payload, spaceId: "anonymize", personalTransactionId: 500 } });
      await api.leaveLinkedSpace({ auth, data: { kind: "family", spaceId: "anonymize" } });
      const saved = (await db.doc(`familySpaces/anonymize/movements/${row.movementId}`).get()).data();
      assert.equal(saved.personalOwnerUid, "deleted"); assert.equal(saved.personalReturnReceipt.uid, "deleted");
      assert.deepEqual(await api.returnPersonalContribution({ auth, data: { ...payload, spaceId: "anonymize", personalTransactionId: 500 } }), row,
        "recupera solo su comprobante privado, sin devolverle acceso al grupo");
    });
    await t.test("deshacer una devolución invalida su confirmación y no resucita por reintento", async () => {
      await seed("familySpaces", "cancel");
      const input = { ...payload, spaceId: "cancel", personalTransactionId: 600 };
      const returned = await api.returnPersonalContribution({ auth, data: input });
      await api.changePersonalContribution({ auth, data: { kind: "family", spaceId: "cancel", movementId: returned.movementId, action: "delete" } });
      await assert.rejects(api.returnPersonalContribution({ auth, data: input }), error => error.details?.reason === "return-cancelled",
        "el reintento no devuelve una confirmación de dinero que se deshizo");
      const saved = (await db.doc(`personalReturnReceipts/owner/operations/${returned.movementId}`).get()).data();
      assert.equal(saved.cancelled, true); assert.ok(Number.isFinite(saved.cancelledAt));
      assert.equal((await db.doc(`familySpaces/cancel/movements/${returned.movementId}`).get()).exists, false);
      await db.doc("users/owner").update({ isPremium: false });
      await api.changePersonalContribution({ auth, data: { kind: "family", spaceId: "cancel", movementId: returned.movementId, action: "delete" } });
      const newReturn = await api.returnPersonalContribution({ auth, data: { ...input, personalTransactionId: 601 } });
      assert.equal(newReturn.amount, 40); assert.notEqual(newReturn.movementId, returned.movementId);
      assert.equal((await db.collection("familySpaces/cancel/movements").get()).size, 3);
    });
    await t.test("el comprobante es privado y su eliminación no toca otra cuenta", async () => {
      const client = env.authenticatedContext("owner", { email_verified: true }).firestore();
      const { getDoc } = require("firebase/firestore");
      await assertFails(getDoc(doc(client, "personalReturnReceipts", "owner", "operations", receipt.movementId)));
      await db.doc("personalReturnReceipts/other/operations/kept").set({ amount: 90 });
      const { cleanupDeletedCloudAccount } = require("../src/cloud-access");
      await cleanupDeletedCloudAccount(db, "owner");
      assert.equal((await db.collection("personalReturnReceipts/owner/operations").get()).empty, true);
      assert.equal((await db.doc("personalReturnReceipts/other/operations/kept").get()).exists, true);
    });
  } finally { await env.cleanup(); await deleteApp(app); }
});

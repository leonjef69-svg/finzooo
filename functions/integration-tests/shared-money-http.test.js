"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { createRequire } = require("node:module");
const { initializeApp: initAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { getFirestore: adminDb } = require("firebase-admin/firestore");
const requireRoot = createRequire(path.resolve(__dirname, "../../package.json"));
const { initializeApp, deleteApp } = requireRoot("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = requireRoot("firebase/auth");
const { getFunctions, connectFunctionsEmulator, httpsCallable } = requireRoot("firebase/functions");
const { DOCUMENTS } = require("../src/legal-acceptance");

test("Familia/Caja: callable HTTP real rechaza saldo insuficiente y conserva la sesión propietaria", { timeout: 120_000 }, async () => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  const projectId = "demo-fino-node22", uid = "shared-http-owner";
  const adminApp = initAdmin({ projectId }, "shared-http"), db = adminDb(adminApp);
  const app = initializeApp({ projectId, apiKey: "demo-only-key", authDomain: `${projectId}.firebaseapp.com` }, "shared-http");
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const functions = getFunctions(app, "southamerica-east1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const call = httpsCallable(functions, "mutateSharedMovement");
  try {
    await adminAuth(adminApp).createUser({ uid, email: `${uid}@example.test`, password: "SoloDemoLocal123!", emailVerified: true });
    await db.doc(`users/${uid}`).set({ isPremium: true, conservar: "dato original" });
    await db.doc(`legalAcceptances/${uid}`).set({ format: 1, uid, ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt: Date.now() - 1000 });
    await signInWithEmailAndPassword(auth, `${uid}@example.test`, "SoloDemoLocal123!");
    for (const kind of ["family", "box"]) {
      const spaceId = `http-${kind}`, root = db.doc(`${kind}Spaces/${spaceId}`);
      await root.set({ ownerUid: uid, currency: "PEN", nombre: "Solo demo" });
      await root.collection("members").doc(uid).set({ uid });
      await root.collection("movements").doc("initial").set({ tipo: "ingreso", monto: 100, creadoPor: uid, creadoEn: 1 });
      const request = { kind, spaceId, action: "create", movementId: "http-expense", movement: {
        tipo: "gasto", monto: 80, descripcion: "Prueba aislada", fecha: "2026-10-15", method: "cash" } };
      const first = (await call(request)).data;
      assert.equal(first.movementId, request.movementId);
      assert.equal((await root.collection("movements").doc(request.movementId).get()).data().creadoPor, uid);
      assert.deepEqual((await call(request)).data, first);
      await assert.rejects(call({ ...request, movementId: "too-much" }), error => error.details?.reason === "shared-insufficient-balance");
      assert.equal((await root.collection("movements").get()).size, 2);
    }
    assert.equal((await db.doc(`users/${uid}`).get()).data().conservar, "dato original");
  } finally { await deleteApp(app); await db.terminate(); await deleteAdmin(adminApp); }
});

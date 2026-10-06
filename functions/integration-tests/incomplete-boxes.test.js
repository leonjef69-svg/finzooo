"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { createRequire } = require("node:module"), { execFileSync } = require("node:child_process");
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const root = path.resolve(__dirname, "../.."), requireRoot = createRequire(path.join(root, "package.json"));
const { initializeApp, deleteApp } = requireRoot("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword, deleteUser } = requireRoot("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, deleteDoc, terminate, serverTimestamp } = requireRoot("firebase/firestore");
const { getFunctions, connectFunctionsEmulator, httpsCallable } = requireRoot("firebase/functions");
const { prepareIncompleteBoxDeletion } = require("../src/incomplete-box-cleanup");
const { privateBoxMigration, digestSource } = require("../src/private-box-migration");
const { sharedBoxMovement } = require("../src/private-box-source");

async function appCode(client) {
  const esbuild = requireRoot("esbuild");
  const built = await esbuild.build({ stdin: { contents: 'import {setAccountStorageAvailable} from "@/utils/storage"; setAccountStorageAvailable(true); export {deleteCloudAccount} from "@/utils/cloudSync"; export {validarBorradoCajasCompartidasDeCuenta,borrarCajasCompartidasDeCuenta} from "@/utils/cloudCajasCompartidas";', resolveDir: root, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", external: ["firebase/*"], alias: { "@": root,
      "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
      "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts"), "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts") },
    plugins: [{ name: "only-native-config", setup(build) {
      build.onLoad({ filter: /[\\/]utils[\\/]firebase\.ts$/ }, () => ({ loader: "ts", contents: "export const {auth,db,functions} = globalThis.__FINO_DEMO__;" }));
      if (process.env.FINO_TEST_INCOMPLETE_BASELINE) {
        assert.match(process.env.FINO_TEST_INCOMPLETE_BASELINE, /^[a-f0-9]{7,40}$/);
        build.onLoad({ filter: /[\\/]utils[\\/]cloudCajasCompartidas\.ts$/ }, () => ({ loader: "ts", contents: execFileSync("git", ["show", `${process.env.FINO_TEST_INCOMPLETE_BASELINE}:utils/cloudCajasCompartidas.ts`], { cwd: root, encoding: "utf8" }) }));
      }
    } }],
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", "globalThis", built.outputFiles[0].text)(module, module.exports, requireRoot, { __FINO_DEMO__: client });
  return module.exports;
}

async function eventually(check) {
  const end = Date.now() + 60_000;
  while (Date.now() < end) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 200)); }
  assert.fail("Auth no terminó la limpieza esperada");
}

test("Copias incompletas: SDK/HTTP, borrado de cuenta, legado, carreras e índices reales", { timeout: 360_000 }, async t => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080"); assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
  const projectId = "demo-fino-node22", uid = "incomplete-owner";
  const adminApp = initializeAdmin({ projectId }, "incomplete-admin"), dbAdmin = getAdminFirestore(adminApp), adminAuth = getAdminAuth(adminApp);
  const app = initializeApp({ projectId, apiKey: "demo-only-key", authDomain: `${projectId}.firebaseapp.com` }, "incomplete-client");
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const functions = getFunctions(app, "southamerica-east1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const box = { id: "pendiente", nombre: "Caja", creadaEn: 1 }, row = { id: "aporte", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-05", creadoEn: 2, personalTransactionId: 777 };
  const targetId = `${uid}_${box.id}`, ref = dbAdmin.doc(`boxSpaces/${targetId}`), source = dbAdmin.doc(`cajas/${uid}`);
  const original = { cajas: [box], movimientos: [row], cajasBorradas: [], movimientosBorrados: [] };
  const receipt = dbAdmin.doc(`privateBoxMigrations/${uid}/operations/${box.id}`);
  async function seed(protocol = 2) {
    await source.set(original); await receipt.delete();
    await ref.set({ ownerUid: uid, nombre: box.nombre, currency: "PEN", creadaEn: new Date(), migrationComplete: false, ...(protocol ? { migrationProtocol: protocol } : {}) });
    await ref.collection("members").doc(uid).set({ uid, rol: "owner", nombre: "Demo", unidoEn: new Date() });
    await ref.collection("movements").doc(row.id).set(sharedBoxMovement(row, uid));
    await dbAdmin.doc(`boxUsers/${uid}/spaces/${targetId}`).set({ boxId: targetId, unidoEn: new Date() });
  }
  const call = action => httpsCallable(functions, "prepareIncompleteBoxDeletion", { timeout: 550_000 })({ action });
  try {
    await adminAuth.createUser({ uid, email: `${uid}@example.test`, password: "SoloPruebaLocal123!", emailVerified: true });
    await dbAdmin.doc(`users/${uid}`).set({ isPremium: false }); await signInWithEmailAndPassword(auth, `${uid}@example.test`, "SoloPruebaLocal123!");
    const api = await appCode({ auth, db, functions });
    await seed();
    await t.test("Gratis comprueba una copia de S/100 sin inventar deuda ni borrar nada", async () => {
      const before = (await ref.get()).data(); await api.validarBorradoCajasCompartidasDeCuenta(uid);
      assert.deepEqual((await ref.get()).data(), before); assert.equal((await ref.collection("movements").get()).size, 1); assert.deepEqual((await source.get()).data(), original);
      await assert.rejects(getDocFromServer(doc(db, "cajas", uid)), error => error.code === "permission-denied");
    });
    if (process.env.FINO_TEST_INCOMPLETE_BASELINE) return;
    await t.test("limpia copia y enlaces huérfanos sin índice, no origen ni otro usuario", async () => {
      await dbAdmin.doc(`boxUsers/${uid}/spaces/absent`).set({ boxId: "absent", unidoEn: new Date() });
      await dbAdmin.doc("boxSpaces/another-user").set({ ownerUid: "another", migrationComplete: true });
      await dbAdmin.doc("boxInvites/another-kept").set({ boxId: "another-user" });
      await dbAdmin.doc("boxInvites/incomplete-copy").set({ boxId: targetId, createdBy: uid });
      await dbAdmin.doc(`boxUsers/${uid}/spaces/${targetId}`).delete();
      await api.borrarCajasCompartidasDeCuenta(uid);
      assert.equal((await ref.get()).data().migrationDeletionPending, true); assert.equal((await ref.get()).data().closed, true);
      assert.equal((await ref.collection("movements").get()).empty, true); assert.equal((await dbAdmin.doc(`boxUsers/${uid}/spaces/absent`).get()).exists, false);
      assert.deepEqual((await source.get()).data(), original); assert.equal((await dbAdmin.doc("boxSpaces/another-user").get()).exists, true);
      assert.equal((await dbAdmin.doc("boxInvites/another-kept").get()).exists, true); assert.equal((await dbAdmin.doc("boxInvites/incomplete-copy").get()).exists, false);
    });
    await t.test("reglas no dejan borrar la barrera, membresía o recrear índices tardíos", async () => {
      await assert.rejects(deleteDoc(doc(db, "boxSpaces", targetId)), error => error.code === "permission-denied");
      await assert.rejects(deleteDoc(doc(db, "boxSpaces", targetId, "members", uid)), error => error.code === "permission-denied");
      await assert.rejects(setDoc(doc(db, "boxUsers", uid, "spaces", targetId), { boxId: targetId, unidoEn: serverTimestamp() }), error => error.code === "permission-denied");
      await assert.rejects(setDoc(doc(db, "boxUsers", uid, "spaces", "fake"), { boxId: "fake", unidoEn: serverTimestamp() }), error => error.code === "permission-denied");
      await dbAdmin.doc(`users/${uid}`).update({ isPremium: true });
      await assert.rejects(setDoc(doc(db, "boxSpaces", `${uid}_late-legacy`), { ownerUid: uid, nombre: "Caja", currency: "PEN", creadaEn: serverTimestamp(), migrationComplete: false }), error => error.code === "permission-denied");
      await assert.rejects(privateBoxMigration(dbAdmin, uid, { action: "begin", sourceId: box.id, digest: digestSource(box, [row], "PEN"), currency: "PEN", attemptId: "intento-tardio-0001" }), /migration-not-owner/);
      await dbAdmin.doc(`users/${uid}`).update({ isPremium: false });
    });
    await t.test("legado distinto o con miembros/recibo se conserva; copia exacta se limpia", async () => {
      await seed(0); await ref.collection("movements").doc(row.id).update({ monto: 90 });
      await assert.rejects(call("inspect"), error => error.details?.reason === "incomplete-box-conflict");
      assert.equal((await ref.collection("movements").doc(row.id).get()).data().monto, 90); assert.equal((await ref.get()).data().closed, undefined);
      await ref.collection("movements").doc(row.id).set(sharedBoxMovement(row, uid));
      await ref.collection("members").doc("another").set({ rol: "member" });
      await assert.rejects(call("discard"), error => error.details?.reason === "incomplete-box-conflict"); await ref.collection("members").doc("another").delete();
      await receipt.set({ uid, sourceId: box.id }); await assert.rejects(call("discard"), error => error.details?.reason === "incomplete-box-conflict"); await receipt.delete();
      await call("inspect"); await call("discard"); assert.equal((await ref.get()).data().migrationProtocol, 3);
      assert.deepEqual((await source.get()).data(), original);
    });
    await t.test("finalizar contra limpiar nunca borra una Caja publicada ni devuelve sus aportes", async () => {
      for (let i = 0; i < 3; i++) {
        await seed();
        const finished = privateBoxMigration(dbAdmin, uid, { action: "finish", sourceId: box.id, digest: digestSource(box, [row], "PEN"), currency: "PEN" });
        const outcomes = await Promise.allSettled([finished, prepareIncompleteBoxDeletion(dbAdmin, uid, "discard")]);
        assert.ok(outcomes.some(result => result.status === "fulfilled"));
        const data = (await ref.get()).data();
        if (data.migrationComplete) { assert.equal((await ref.collection("movements").get()).size, 1); assert.equal((await source.get()).data().cajas.length, 0); }
        else { assert.equal(data.migrationDeletionPending, true); assert.equal((await ref.collection("movements").get()).empty, true); assert.deepEqual((await source.get()).data(), original); }
      }
    });
    await t.test("más de 100 raíces y 400 clones se recorren con Firestore real", async () => {
      await seed();
      for (let start = 0; start < 405; start += 200) { const batch = dbAdmin.batch(); for (let i = start; i < Math.min(start + 200, 405); i++) batch.set(ref.collection("movements").doc(`extra-${i}`), { monto: 1 }); await batch.commit(); }
      const batch = dbAdmin.batch(); for (let i = 0; i < 105; i++) batch.set(dbAdmin.doc(`boxSpaces/${uid}_extra-${i}`), { ownerUid: uid, migrationComplete: false, migrationProtocol: 2 }); await batch.commit();
      await call("discard"); assert.equal((await ref.collection("movements").get()).empty, true);
      const all = await dbAdmin.collection("boxSpaces").where("ownerUid", "==", uid).get(); assert.equal(all.size, 106);
      assert.ok(all.docs.every(doc => doc.data().migrationDeletionPending === true));
    });
    await t.test("API limita autoridad al UID autenticado y no acepta borrado Auth falso", async () => {
      await assert.rejects(call("deleted"), error => error.code === "functions/invalid-argument");
      const result = await httpsCallable(functions, "prepareIncompleteBoxDeletion")({ action: "inspect", uid: "another" }); assert.equal(result.data.uid, uid);
      assert.equal((await dbAdmin.doc("boxSpaces/another-user").get()).exists, true);
    });
    await t.test("el borrado completo por SDK/HTTP y evento Auth retira activos, barreras y tokens atrasados", async () => {
      await seed(); await receipt.delete();
      const oldToken = await auth.currentUser.getIdToken();
      await api.deleteCloudAccount(uid); assert.equal((await source.get()).exists, false);
      assert.equal((await dbAdmin.doc(`users/${uid}`).get()).exists, false);
      await deleteUser(auth.currentUser);
      await eventually(async () => !(await dbAdmin.doc(`premiumTrialClaims/${uid}`).get()).exists);
      assert.equal((await dbAdmin.collection("boxSpaces").where("ownerUid", "==", uid).get()).empty, true);
      assert.equal((await dbAdmin.collection(`boxUsers/${uid}/spaces`).get()).empty, true);
      assert.equal((await ref.collection("members").get()).empty, true); assert.equal((await ref.collection("movements").get()).empty, true);
      const response = await fetch(`http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/boxUsers/${uid}/spaces/${targetId}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${oldToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ fields: { boxId: { stringValue: targetId }, unidoEn: { timestampValue: new Date().toISOString() } } }),
      });
      assert.equal(response.status, 403); assert.equal((await dbAdmin.doc("boxSpaces/another-user").get()).exists, true);
    });
  } finally { await terminate(db); await deleteApp(app); await dbAdmin.terminate(); await deleteAdmin(adminApp); }
});

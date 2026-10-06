"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { createRequire } = require("node:module"), { createHash } = require("node:crypto");
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const root = path.resolve(__dirname, "../.."), requireRoot = createRequire(path.join(root, "package.json"));
const { initializeApp, deleteApp } = requireRoot("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = requireRoot("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, getDocFromServer, deleteDoc, terminate } = requireRoot("firebase/firestore");
const { getFunctions, connectFunctionsEmulator } = requireRoot("firebase/functions");
let migration = require("../src/private-box-migration");
if (process.env.FINO_TEST_CANCEL_BASELINE) {
  assert.match(process.env.FINO_TEST_CANCEL_BASELINE, /^[a-f0-9]{7,40}$/);
  const Module = require("node:module"), filename = path.join(__dirname, "../src/private-box-migration.js");
  const old = new Module(filename, module); old.filename = filename; old.paths = module.paths;
  old._compile(require("node:child_process").execFileSync("git", ["show", `${process.env.FINO_TEST_CANCEL_BASELINE}:functions/src/private-box-migration.js`], { cwd: root, encoding: "utf8" }), filename);
  migration = old.exports;
}
const { privateBoxMigration, digestSource } = migration;
const { sharedBoxMovement } = require("../src/private-box-source");
const { execFileSync } = require("node:child_process");

async function appCode(client) {
  const esbuild = requireRoot("esbuild");
  const built = await esbuild.build({ stdin: { contents: 'export { compartirCajaExistente } from "@/utils/cloudCajasCompartidas"; export { cancelarConversionCaja } from "@/utils/boxMigration"; export { subirCajas } from "@/utils/cloudCajas";', resolveDir: root, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", external: ["firebase/*", "node:crypto"], alias: { "@": root },
    plugins: [{ name: "native-config-only", setup(build) {
      build.onLoad({ filter: /[\\/]utils[\\/]firebase\.ts$/ }, () => ({ loader: "ts", contents: "export const {auth,db,functions} = globalThis.__FINO_DEMO__;" }));
      build.onLoad({ filter: /[\\/]utils[\\/]storage\.ts$/ }, () => ({ loader: "ts", contents: "export const getAccountStorageSession = () => globalThis.__FINO_DEMO__.session; export const hasUnreadableLocalData = () => false;" }));
      build.onResolve({ filter: /^expo-crypto$/ }, () => ({ path: "crypto-native", namespace: "test-native" }));
      build.onLoad({ filter: /.*/, namespace: "test-native" }, () => ({ loader: "js", contents: 'export const CryptoDigestAlgorithm = { SHA256: "sha256" }; export const digestStringAsync = async (algorithm,text) => require("node:crypto").createHash(algorithm).update(text,"utf8").digest("hex"); export const getRandomBytes = n => require("node:crypto").randomBytes(n); export const randomUUID = () => require("node:crypto").randomUUID();' }));
      if (process.env.FINO_TEST_MIGRATION_BASELINE) build.onLoad({ filter: /[\\/]utils[\\/]cloudCajasCompartidas\.ts$/ }, () => ({ loader: "ts", contents: execFileSync("git", ["show", `${process.env.FINO_TEST_MIGRATION_BASELINE}:utils/cloudCajasCompartidas.ts`], { cwd: root, encoding: "utf8" }) }));
    } }],
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", "globalThis", built.outputFiles[0].text)(module, module.exports, requireRoot, { __FINO_DEMO__: client });
  return module.exports;
}

test("Conversión real: servidor, SDK, respuesta perdida, permisos y copia incorrecta", { timeout: 360_000 }, async t => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080"); assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
  const projectId = "demo-fino-node22", uid = "migration-owner";
  const adminApp = initializeAdmin({ projectId }, "migration-admin"), admin = getAdminFirestore(adminApp), adminAuth = getAdminAuth(adminApp);
  const app = initializeApp({ projectId, apiKey: "demo-only-key", authDomain: `${projectId}.firebaseapp.com` }, "migration-client");
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const functions = getFunctions(app, "southamerica-east1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const box = { id: "caja-convertir", nombre: "A 🌟", creadaEn: 1, updatedAt: 3 };
  const row = { id: "mov-aporte", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", method: "transfer", personalTransactionId: 10, fecha: "2026-10-05", creadoEn: 2 };
  const targetId = `${uid}_${box.id}`, origin = admin.doc(`cajas/${uid}`), target = admin.doc(`boxSpaces/${targetId}`);
  const initial = { cajas: [box], movimientos: [row], cajasBorradas: [], movimientosBorrados: [], syncFormat: 2 };
  const payload = { sourceId: box.id, digest: digestSource(box, [row], "PEN"), currency: "PEN", action: "finish" };
  async function seed(protocol = 2) {
    await origin.set(initial); await admin.doc(`privateBoxMigrations/${uid}/operations/${box.id}`).delete();
    await target.set({ nombre: box.nombre, ownerUid: uid, currency: "PEN", creadaEn: new Date(), migrationComplete: false, ...(protocol ? { migrationProtocol: protocol } : {}) });
    await target.collection("members").doc(uid).set({ uid, rol: "owner", nombre: "A", unidoEn: new Date() });
    const rows = await target.collection("movements").get(); const batch = admin.batch(); for (const item of rows.docs) batch.delete(item.ref); await batch.commit();
  }
  try {
    await adminAuth.createUser({ uid, email: `${uid}@example.test`, password: "SoloPruebaLocal123!", emailVerified: true });
    await admin.doc(`users/${uid}`).set({ isPremium: true }); await signInWithEmailAndPassword(auth, `${uid}@example.test`, "SoloPruebaLocal123!");
    const client = { auth, db, functions, session: 1 }, api = await appCode(client);
    if (process.env.FINO_TEST_CANCEL_BASELINE) {
      // El helper anterior debe confirmar la misma operación que el actual
      // ya comprobó con Firestore real; falla por no admitir cancelar.
      await seed(); await target.delete(); await admin.doc(`users/${uid}`).update({ isPremium: false });
      const result = await privateBoxMigration(admin, uid, { ...payload, action: "cancel" });
      assert.equal(result.cancelled, true); return;
    }
    await t.test("una copia incompleta o con el mismo ID y monto distinto no retira el origen", async () => {
      await seed(); await target.collection("movements").doc(row.id).set({ ...sharedBoxMovement(row, uid), monto: 90 });
      await assert.rejects(privateBoxMigration(admin, uid, payload), /migration-copy-incomplete/);
      assert.equal((await origin.get()).data().movimientos[0].monto, 100); assert.equal((await target.get()).data().migrationComplete, false);
      // En la versión anterior el SDK intentaba marcarla terminada sin comprobar
      // el monto. Las reglas nuevas también impiden ese atajo.
      if (process.env.FINO_TEST_MIGRATION_BASELINE) {
        await api.compartirCajaExistente(uid, "A", box, [row]);
        assert.equal((await target.collection("movements").doc(row.id).get()).data().monto, 100); return;
      }
    });
    if (process.env.FINO_TEST_MIGRATION_BASELINE) return;
    await t.test("las reglas no dejan finalizar, invitar, borrar clones ni falsificar importes", async () => {
      await seed();
      await assert.rejects(updateDoc(doc(db, "boxSpaces", targetId), { migrationComplete: true }), e => e.code === "permission-denied");
      await assert.rejects(setDoc(doc(db, "boxInvites", "migration-test"), { boxId: targetId, createdBy: uid, expiresAt: Date.now() + 10000 }), e => e.code === "permission-denied");
      await assert.rejects(setDoc(doc(db, "boxSpaces", targetId, "movements", row.id), { ...sharedBoxMovement(row, uid), monto: 90, migrationSourceIndex: 0 }), e => e.code === "permission-denied");
      await setDoc(doc(db, "boxSpaces", targetId, "movements", row.id), { ...sharedBoxMovement(row, uid), migrationSourceIndex: 0 });
      await assert.rejects(deleteDoc(doc(db, "boxSpaces", targetId, "movements", row.id)), e => e.code === "permission-denied");
    });
    await t.test("el SDK repara únicamente clones nuevos y el servidor retira el origen atómicamente", async () => {
      await target.collection("movements").doc(row.id).update({ monto: 90 });
      const result = await api.compartirCajaExistente(uid, "A", box, [row]);
      assert.equal(result.conversion.targetId, targetId); assert.equal((await target.get()).data().migrationComplete, true);
      const privateData = (await origin.get()).data(); assert.equal(privateData.cajas.length, 0); assert.equal(privateData.syncFormat, 3);
      assert.equal((await target.collection("movements").doc(row.id).get()).data().monto, 100);
      assert.equal(privateData.conversiones[box.id].links[0].personalId, 10);
    });
    await t.test("respuesta perdida se recupera sin Pro, sin volver a leer/subir el historial ni duplicar", async () => {
      const receipt = (await admin.doc(`privateBoxMigrations/${uid}/operations/${box.id}`).get()).data();
      await admin.doc(`users/${uid}`).update({ isPremium: false });
      const result = await api.compartirCajaExistente(uid, "A", box, [row], "PEN", false);
      assert.equal(result.conversion.completedAt, receipt.completedAt); assert.equal((await target.collection("movements").get()).size, 1);
      await assert.rejects(getDocFromServer(doc(db, "cajas", uid)), e => e.code === "permission-denied");
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, digest: createHash("sha256").update("otro").digest("hex"), action: "status" }), /migration-source-changed/);
      await admin.doc(`users/${uid}`).update({ isPremium: true });
    });
    await t.test("el SDK atrasado conserva sus ediciones y no borra ni falsifica la confirmación", async () => {
      const converted = (await origin.get()).data(); assert.equal(await api.subirCajas(uid, initial), false);
      assert.equal((await origin.get()).data().syncFormat, 3);
      await assert.rejects(setDoc(doc(db, "cajas", uid), { ...converted, syncFormat: 2 }), e => e.code === "permission-denied");
      await assert.rejects(setDoc(doc(db, "cajas", uid), { ...converted, conversiones: {} }), e => e.code === "permission-denied");
      assert.equal(await api.subirCajas(uid, converted), true);
    });
    await t.test("cambio del origen, miembro ajeno y cuenta cerrándose impiden finalizar", async () => {
      await seed(); await target.collection("movements").doc(row.id).set(sharedBoxMovement(row, uid));
      await origin.update({ movimientos: [{ ...row, monto: 120, updatedAt: 5 }] });
      await assert.rejects(privateBoxMigration(admin, uid, payload), /migration-source-changed/);
      await origin.set(initial); await target.collection("members").doc("other").set({ uid: "other", rol: "member" });
      await assert.rejects(privateBoxMigration(admin, uid, payload), /migration-members-conflict/);
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "reset" }), /migration-reset-forbidden/);
      await target.collection("members").doc("other").delete(); await admin.doc(`users/${uid}`).update({ accountDeletionPending: true });
      await assert.rejects(privateBoxMigration(admin, uid, payload), /migration-account-closing/);
      await admin.doc(`users/${uid}`).update({ accountDeletionPending: false });
    });
    await t.test("una copia heredada distinta no se purga ni se publica", async () => {
      await seed(0); await target.collection("movements").doc(row.id).set({ ...sharedBoxMovement(row, uid), monto: 90 });
      await assert.rejects(api.compartirCajaExistente(uid, "A", box, [row]));
      assert.equal((await target.collection("movements").doc(row.id).get()).data().monto, 90);
      assert.equal((await origin.get()).data().cajas.length, 1);
    });
    await t.test("dos confirmaciones concurrentes reciben el mismo comprobante", async () => {
      await seed(); await target.collection("movements").doc(row.id).set(sharedBoxMovement(row, uid));
      await admin.doc(`users/${uid}`).update({ isPremium: false });
      const results = await Promise.all([privateBoxMigration(admin, uid, payload), privateBoxMigration(admin, uid, payload)]);
      assert.deepEqual(results[0], results[1]); assert.equal((await origin.get()).data().cajas.length, 0);
    });
    await t.test("limpieza interrumpida con clones correctos se reanuda y no queda bloqueada", async () => {
      await admin.doc(`users/${uid}`).update({ isPremium: true }); await seed();
      await target.update({ migrationResetting: true }); await target.collection("movements").doc(row.id).set(sharedBoxMovement(row, uid));
      const result = await api.compartirCajaExistente(uid, "A", box, [row]);
      assert.equal(result.conversion.targetId, targetId); assert.equal((await target.get()).data().migrationResetting, false);
    });
    await t.test("405 movimientos cruzan dos lotes sin perder registros ni otras Cajas", async () => {
      await seed(); const rows = Array.from({ length: 405 }, (_, i) => ({ ...row, id: `large-${i}`, personalTransactionId: undefined, monto: 1 }));
      const other = { ...box, id: "otra-caja" };
      await origin.set({ ...initial, cajas: [box, other], movimientos: JSON.parse(JSON.stringify(rows)) });
      const result = await api.compartirCajaExistente(uid, "A", box, rows);
      assert.equal(result.conversion.targetId, targetId); assert.equal((await target.collection("movements").get()).size, 405);
      assert.deepEqual((await origin.get()).data().cajas.map(box => box.id), [other.id]);
      assert.equal((await origin.get()).data().movimientos.length, 0);
    });
    await t.test("crea y convierte una Caja compartida completamente nueva con SDK real", async () => {
      const fresh = { ...box, id: "caja-nueva" }, freshRow = { ...row, id: "mov-nuevo", cajaId: fresh.id, personalTransactionId: 1010 };
      const ref = admin.doc(`boxSpaces/${uid}_${fresh.id}`);
      assert.equal((await ref.get()).exists, false);
      await origin.set({ ...initial, cajas: [fresh], movimientos: [freshRow] });
      const localPending = { ...fresh, sharingPending: true };
      assert.equal(await api.subirCajas(uid, { ...initial, cajas: [localPending], movimientos: [freshRow] }), true);
      assert.equal((await origin.get()).data().cajas[0].sharingPending, undefined, "el marcador local no viaja a Firebase");
      const result = await api.compartirCajaExistente(uid, "A", localPending, [freshRow]);
      assert.equal(result.id, ref.id); assert.equal((await ref.get()).data().migrationComplete, true);
      assert.equal((await origin.get()).data().cajas.length, 0);
      const unrelated = admin.doc("boxSpaces/other_private-box"); await unrelated.set({ ownerUid: "other", nombre: "Privada" });
      await assert.rejects(getDocFromServer(doc(db, "boxSpaces", unrelated.id)), error => error.code === "permission-denied");
      await assert.rejects(getDocFromServer(doc(db, "boxSpaces", "other_missing-box")), error => error.code === "permission-denied");
    });
    await t.test("cancelar sin destino ni Pro crea barrera, no cambia el origen y bloquea el SDK atrasado", async () => {
      await seed(); await target.delete(); await admin.doc(`users/${uid}`).update({ isPremium: false });
      const before = (await origin.get()).data();
      const result = await privateBoxMigration(admin, uid, { ...payload, action: "cancel" });
      assert.equal(result.cancelled, true); assert.deepEqual((await origin.get()).data(), before);
      assert.equal(await api.cancelarConversionCaja(uid, { ...box, sharingPending: true }, [row], "PEN"), null, "HTTP real y reintento sin Pro");
      await admin.doc(`users/${uid}`).update({ isPremium: true });
      await assert.rejects(setDoc(doc(db, "boxSpaces", targetId), { nombre: box.nombre, ownerUid: uid, currency: "PEN", creadaEn: new Date(), migrationComplete: false, migrationProtocol: 2 }), e => e.code === "permission-denied");
      await assert.rejects(privateBoxMigration(admin, uid, payload), /migration-cancelled/);
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "reset" }), /migration-cancelled/);
      await assert.rejects(setDoc(doc(db, "boxSpaces", targetId, "movements", row.id), { ...sharedBoxMovement(row, uid), migrationSourceIndex: 0 }), e => e.code === "permission-denied");
    });
    await t.test("cancelar limpia más de 400 clones, retira el índice y preserva todo el dinero privado", async () => {
      await seed(); await admin.doc(`users/${uid}`).update({ isPremium: false });
      await admin.doc(`boxUsers/${uid}/spaces/${targetId}`).set({ boxId: targetId });
      for (let start = 0; start < 405; start += 200) {
        const batch = admin.batch(); for (let i = start; i < Math.min(start + 200, 405); i++) batch.set(target.collection("movements").doc(`clon-${i}`), sharedBoxMovement(row, uid)); await batch.commit();
      }
      const before = (await origin.get()).data(); await privateBoxMigration(admin, uid, { ...payload, action: "cancel" });
      assert.equal((await target.collection("movements").get()).size, 0); assert.equal((await admin.doc(`boxUsers/${uid}/spaces/${targetId}`).get()).exists, false);
      assert.deepEqual((await origin.get()).data(), before); assert.equal((await target.get()).data().migrationCancelled, true);
    });
    await t.test("un intento nuevo funciona; inicio, copia y confirmación del cancelado nunca lo reactivan", async () => {
      await seed(); await admin.doc(`users/${uid}`).update({ isPremium: true });
      const oldId = "intento-cancelado-001", nextId = "intento-nuevo-000001";
      await privateBoxMigration(admin, uid, { ...payload, action: "begin", attemptId: oldId });
      await target.collection("movements").doc(row.id).set({ ...sharedBoxMovement(row, uid), migrationAttemptId: oldId });
      await privateBoxMigration(admin, uid, { ...payload, action: "cancel", attemptId: oldId });
      await privateBoxMigration(admin, uid, { ...payload, action: "begin", attemptId: nextId });
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "begin", attemptId: oldId }), /migration-cancelled/);
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, attemptId: oldId }), /migration-attempt-conflict/);
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "cancel", attemptId: oldId }), /migration-attempt-conflict/);
      await assert.rejects(setDoc(doc(db, "boxSpaces", targetId, "movements", row.id), { ...sharedBoxMovement(row, uid), migrationSourceIndex: 0, migrationAttemptId: oldId }), e => e.code === "permission-denied");
      await assert.rejects(setDoc(doc(db, "boxSpaces", targetId, "movements", row.id), { ...sharedBoxMovement(row, uid), migrationSourceIndex: 0 }), e => e.code === "permission-denied");
      const pending = { ...box, sharingPending: true, sharingAttempt: nextId };
      const result = await api.compartirCajaExistente(uid, "A", pending, [row]);
      assert.equal(result.conversion.targetId, targetId); assert.equal((await target.get()).data().migrationProtocol, 3);
      assert.equal((await origin.get()).data().cajas.length, 0);
    });
    await t.test("cancelar una copia terminada devuelve su recibo sin volver a hacerla privada", async () => {
      await admin.doc(`users/${uid}`).update({ isPremium: false });
      const saved = (await admin.doc(`privateBoxMigrations/${uid}/operations/${box.id}`).get()).data();
      const result = await api.cancelarConversionCaja(uid, { ...box, sharingPending: true, sharingAttempt: "intento-nuevo-000001" }, [row], "PEN");
      assert.deepEqual(result, saved); assert.equal((await origin.get()).data().cajas.length, 0); assert.equal((await target.get()).data().migrationComplete, true);
    });
    await t.test("cancelación y finalización concurrentes dejan exactamente una copia utilizable", async () => {
      for (let i = 0; i < 3; i++) {
        await seed(); await target.collection("movements").doc(row.id).set(sharedBoxMovement(row, uid));
        const results = await Promise.allSettled([privateBoxMigration(admin, uid, { ...payload, action: "cancel" }), privateBoxMigration(admin, uid, payload)]);
        const remote = (await target.get()).data(), source = (await origin.get()).data();
        assert.equal(remote.migrationComplete === true, source.cajas.length === 0);
        assert.ok(results.some(result => result.status === "fulfilled"));
        if (remote.migrationComplete) assert.equal((await admin.doc(`privateBoxMigrations/${uid}/operations/${box.id}`).get()).exists, true);
        else { assert.equal(remote.migrationCancelled, true); assert.equal(source.movimientos[0].monto, 100); }
      }
    });
    await t.test("no cancela un espacio heredado, ajeno, con miembros o una cuenta en borrado", async () => {
      await seed(0); await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "cancel" }), /migration-cancel-forbidden/);
      await seed(); await target.update({ ownerUid: "other" }); await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "cancel" }), /migration-cancel-forbidden/);
      await seed(); await target.collection("members").doc("other").set({ rol: "member" });
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "cancel" }), /migration-members-conflict/);
      await target.collection("members").doc("other").delete(); await admin.doc(`users/${uid}`).update({ accountDeletionPending: true });
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "cancel" }), /migration-account-closing/);
      assert.equal((await origin.get()).data().movimientos[0].monto, 100); await admin.doc(`users/${uid}`).update({ accountDeletionPending: false });
      const user = (await admin.doc(`users/${uid}`).get()).data(); await admin.doc(`users/${uid}`).delete();
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "cancel" }), /migration-account-missing/);
      await admin.doc(`testerPremium/${uid}`).set({ active: true, grantedAt: new Date() });
      const testerAttempt = "intento-tester-00001";
      await privateBoxMigration(admin, uid, { ...payload, action: "begin", attemptId: testerAttempt });
      await admin.doc(`testerPremium/${uid}`).update({ active: false });
      assert.equal((await privateBoxMigration(admin, uid, { ...payload, action: "cancel", attemptId: testerAttempt })).cancelled, true,
        "un tester sin copia Personal cancela aunque venza su acceso");
      await admin.doc(`testerPremium/${uid}`).delete();
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, action: "cancel", attemptId: testerAttempt }), /migration-account-missing/);
      assert.equal((await target.get()).data().migrationComplete, false); await admin.doc(`users/${uid}`).set(user);
    });
    await t.test("el límite frena nuevos intentos abusivos pero permite recuperar cancelaciones confirmadas", async () => {
      await seed(); await target.delete();
      const proof = await privateBoxMigration(admin, uid, { ...payload, action: "cancel" }); assert.equal(proof.cancelled, true);
      await admin.doc(`privateBoxMigrations/${uid}`).set({ quotaDay: Math.floor(Date.now() / 86400000), quotaCount: 30 });
      assert.equal((await privateBoxMigration(admin, uid, { ...payload, action: "cancel" })).cancelled, true);
      const id = "caja-fuera-cuota";
      await assert.rejects(privateBoxMigration(admin, uid, { ...payload, sourceId: id, action: "cancel" }), /migration-too-many-attempts/);
      assert.equal((await admin.doc(`boxSpaces/${uid}_${id}`).get()).exists, false);
      await admin.doc(`privateBoxMigrations/${uid}`).delete();
    });
  } finally { await terminate(db); await deleteApp(app); await admin.terminate(); await deleteAdmin(adminApp); }
});

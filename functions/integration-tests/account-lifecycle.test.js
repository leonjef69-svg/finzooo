"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const root = path.resolve(__dirname, "../..");
const requireRoot = createRequire(path.join(root, "package.json"));
const { initializeApp, deleteApp } = requireRoot("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword, deleteUser } = requireRoot("firebase/auth");
const { getFirestore, connectFirestoreEmulator, getDoc, doc } = requireRoot("firebase/firestore");
const { getFunctions, connectFunctionsEmulator, httpsCallable } = requireRoot("firebase/functions");
const esbuild = requireRoot("esbuild");
const projectId = "demo-fino-node22";

async function clientDeletion(client) {
  const built = await esbuild.build({ stdin: { contents: 'export { deleteCloudAccount } from "@/utils/cloudSync";',
    resolveDir: root, sourcefile: "account-cloud-deletion.ts", loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    external: ["firebase/*"], alias: { "@": root,
      "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
      "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts"),
      "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts") },
    plugins: [{ name: "only-demo-firebase", setup(build) {
      build.onLoad({ filter: /[\\/]utils[\\/]firebase\.ts$/ }, () => ({ loader: "ts",
        contents: "export const { auth, db, functions } = globalThis.__FINO_DEMO_CLIENT__;" }));
      if (process.env.FINO_TEST_BASELINE) {
        const baseline = process.env.FINO_TEST_BASELINE === "1" ? "HEAD" : process.env.FINO_TEST_BASELINE;
        if (baseline !== "HEAD" && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresión requiere HEAD o un hash de Git.");
        build.onLoad({ filter: /[\\/]utils[\\/]cloudFamilia\.ts$/ }, () => ({ loader: "ts",
          contents: execFileSync("git", ["show", `${baseline}:utils/cloudFamilia.ts`], { cwd: root, encoding: "utf8" }) }));
      }
    } }],
  });
  const module = { exports: {} };
  // Solo la configuración se sustituye. Las funciones de borrado y los SDK
  // que leen/escriben/llaman por HTTP son los originales del proyecto.
  const run = new Function("module", "exports", "require", "globalThis", built.outputFiles[0].text);
  run(module, module.exports, requireRoot, { __FINO_DEMO_CLIENT__: client });
  return module.exports.deleteCloudAccount;
}

async function eventually(check, message) {
  const end = Date.now() + 25_000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.fail(message);
}

// Incluye 405 escrituras de preparación y arranques de varios trabajadores.
// En Windows lento pueden superar 3 minutos; no alarga ninguna llamada de la app.
test("Node 22, llamadas HTTP y eliminación real en Auth/Firestore emulados", { timeout: 360_000 }, async t => {
  assert.equal(Number(process.versions.node.split(".")[0]), 22);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099", "solo Auth local");
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080", "solo Firestore local");
  const adminApp = initializeAdmin({ projectId }, "account-lifecycle");
  const adminAuth = getAdminAuth(adminApp), admin = getAdminFirestore(adminApp);
  const apps = [];
  async function account(uid, verified = true) {
    await adminAuth.createUser({ uid, email: `${uid}@example.test`, password: "SoloPruebaLocal123!", emailVerified: verified });
    const app = initializeApp({ projectId, apiKey: "demo-only-key", authDomain: `${projectId}.firebaseapp.com` }, uid);
    apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
    const functions = getFunctions(app, "southamerica-east1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    await signInWithEmailAndPassword(auth, `${uid}@example.test`, "SoloPruebaLocal123!");
    return { auth, db, functions };
  }
  const expired = { hasOnboarded: true, isPremium: false, premiumTrialStartedAt: Date.now() - 90_000_000,
    historyFormat: 2, budgets: { "2026-10": 500 } };
  async function seedSpace(uid, kind, id, spent) {
    const rootName = kind === "family" ? "familySpaces" : "boxSpaces";
    await admin.doc(`${rootName}/${id}`).set({ ownerUid: uid, nombre: "Casa demo", currency: "PEN" });
    await admin.doc(`${rootName}/${id}/members/${uid}`).set({ uid, rol: "owner" });
    await admin.doc(`${rootName}/${id}/members/other`).set({ uid: "other", rol: "member" });
    await admin.doc(`${rootName}/${id}/movements/contribution`).set({ tipo: "ingreso", monto: 100,
      personalTransactionId: 10, personalOwnerUid: uid, creadoPor: uid, creadoEn: 1 });
    await admin.doc(`${rootName}/${id}/movements/spent`).set({ tipo: "gasto", monto: spent, creadoPor: uid, creadoEn: 2 });
    if (kind === "family") {
      await admin.doc(`familyUsers/${uid}`).set({ activeFamilyId: id });
      await admin.doc(`familyUsers/other`).set({ activeFamilyId: id });
      for (const member of [uid, "other"]) await admin.doc(`familyUsers/${member}/spaces/${id}`).set({ familyId: id });
    } else for (const member of [uid, "other"]) await admin.doc(`boxUsers/${member}/spaces/${id}`).set({ boxId: id });
  }
  try {
    const owner = await account("owner");
    await account("other");
    await admin.doc("users/owner").set(expired);
    await admin.doc("users/other").set({ ...expired, isPremium: true });
    for (let index = 0; index < 405; index++) await admin.doc(`users/owner/history/${index}`).set({ id: index, deleted: true });
    for (const collection of ["negocios", "cajas", "testerPremium"]) {
      await admin.doc(`${collection}/owner`).set({ fixture: true });
      await admin.doc(`${collection}/other`).set({ fixture: true });
    }
    await admin.doc("premiumTrialClaims/owner").set({ startedAt: expired.premiumTrialStartedAt });
    await admin.doc("telegramUsers/owner").set({ active: true, chatId: "chat-owner" });
    await admin.doc("telegramConnections/chat-owner").set({ uid: "owner" });
    await admin.doc("telegramDrafts/chat-owner").set({ uid: "owner" });
    await admin.doc("telegramUndo/chat-owner").set({ uid: "owner" });
    await admin.doc("telegramLinkRequests/owner-code").set({ uid: "owner" });
    await admin.doc("telegramDrafts/other-kept").set({ uid: "other" });
    await seedSpace("owner", "family", "family-owner", 60);
    await seedSpace("owner", "box", "box-owner", 100);
    const call = (name, payload) => httpsCallable(owner.functions, name, { timeout: 90_000 })(payload);
    await t.test("la llamada autenticada no descarga la copia financiera de Gratis", async () => {
      const { data } = await call("getCloudAccess");
      assert.equal(data.uid, "owner"); assert.equal(data.canSync, false); assert.equal("budgets" in data, false);
      await assert.rejects(getDoc(doc(owner.db, "users", "owner")), error => error.code === "permission-denied");
      await assert.rejects(getDoc(doc(owner.db, "familyUsers", "other")), error => error.code === "permission-denied", "el índice privado sigue cerrado al dueño del grupo");
    });
    await t.test("finalización no permite borrar un grupo ajeno ni saltarse la preparación", async () => {
      await admin.doc("familySpaces/foreign").set({ ownerUid: "other", deleting: true });
      await admin.doc("familySpaces/foreign/members/other").set({ uid: "other" });
      await assert.rejects(call("finalizeLinkedSpaceDeletion", { kind: "family", spaceId: "foreign", uid: "other" }), error => error.code === "functions/permission-denied");
      await assert.rejects(call("finalizeLinkedSpaceDeletion", { kind: "family", spaceId: "family-owner" }), error => error.code === "functions/failed-precondition");
      assert.equal((await admin.doc("familySpaces/foreign/members/other").get()).exists, true);
    });
    const deletion = await clientDeletion(owner);
    await t.test("saldo disponible aborta antes de borrar datos", async () => {
      await assert.rejects(deletion("owner"), /unsettled-personal-contributions/);
      assert.equal((await admin.doc("users/owner").get()).exists, true);
      assert.equal((await admin.doc("telegramUsers/owner").get()).exists, true);
    });
    const payload = { kind: "family", spaceId: "family-owner", amount: 40, personalTransactionId: 100,
      currency: "PEN", fecha: "2026-10-05", description: "Devolución demo" };
    await t.test("sin Pro devuelve S/40 por HTTP una sola vez con token de Auth emulado", async () => {
      const first = await call("returnPersonalContribution", payload);
      const repeated = await call("returnPersonalContribution", payload);
      assert.deepEqual(first.data, repeated.data);
      assert.equal(first.data.amount, 40);
      assert.equal((await admin.collection("familySpaces/family-owner/movements").get()).size, 3);
    });
    await t.test("borrado real del cliente elimina sus grupos y no los datos de otra cuenta", async () => {
      await assert.doesNotReject(deletion("owner"));
      for (const name of ["users", "negocios", "cajas", "telegramUsers"]) assert.equal((await admin.doc(`${name}/owner`).get()).exists, false, name);
      assert.equal((await admin.collection("users/owner/history").get()).empty, true);
      for (const name of ["familySpaces/family-owner", "boxSpaces/box-owner"]) {
        assert.equal((await admin.doc(name).get()).exists, false, name);
        assert.equal((await admin.collection(`${name}/members`).get()).empty, true);
        assert.equal((await admin.collection(`${name}/movements`).get()).empty, true);
      }
      assert.equal((await admin.doc("familyUsers/other").get()).data().activeFamilyId, "");
      assert.equal((await admin.doc("boxUsers/other/spaces/box-owner").get()).exists, false);
      assert.equal((await admin.doc("users/other").get()).exists, true);
    });
    await t.test("eliminar Auth dispara la limpieza auténtica de permisos y comprobantes", async () => {
      assert.equal((await admin.doc("premiumTrialClaims/owner").get()).data().deletionPending, true);
      assert.equal((await admin.collection("personalReturnReceipts/owner/operations").get()).size, 1);
      await admin.doc("privateBoxMigrations/owner/operations/local-box").set({ uid: "owner", targetId: "owner_local-box" });
      await admin.doc("privateBoxMigrations/owner/attempts/cancelled-attempt").set({ uid: "owner", cancelled: true });
      await admin.doc("boxSpaces/owner_cancelled").set({ ownerUid: "owner", migrationCancelled: true, migrationProtocol: 3, migrationComplete: false });
      await admin.doc("boxSpaces/owner_cancelled/members/owner").set({ uid: "owner", rol: "owner" });
      await admin.doc("boxSpaces/owner_cancelled/movements/clon").set({ monto: 100 });
      await admin.doc("boxSpaces/other_cancelled").set({ ownerUid: "other", migrationCancelled: true, migrationProtocol: 3, migrationComplete: false });
      await deleteUser(owner.auth.currentUser);
      await eventually(async () => !(await admin.doc("premiumTrialClaims/owner").get()).exists,
        "el evento de Auth debe terminar la limpieza");
      assert.equal((await admin.collection("personalReturnReceipts/owner/operations").get()).empty, true);
      assert.equal((await admin.collection("privateBoxMigrations/owner/operations").get()).empty, true);
      assert.equal((await admin.collection("privateBoxMigrations/owner/attempts").get()).empty, true);
      assert.equal((await admin.doc("boxSpaces/owner_cancelled").get()).exists, false);
      assert.equal((await admin.collection("boxSpaces/owner_cancelled/members").get()).empty, true);
      assert.equal((await admin.collection("boxSpaces/owner_cancelled/movements").get()).empty, true);
      assert.equal((await admin.doc("boxSpaces/other_cancelled").get()).exists, true);
      assert.equal((await admin.doc("testerPremium/owner").get()).exists, false);
      const telegramRemoved = ["telegramConnections/chat-owner", "telegramDrafts/chat-owner", "telegramUndo/chat-owner", "telegramLinkRequests/owner-code"];
      // El evento borra por colecciones/lotes; la conexión desaparece antes de
      // limpiar los códigos. Esperar TODO, sin quitar ninguna comprobación.
      await eventually(async () => (await Promise.all(telegramRemoved.map(name => admin.doc(name).get()))).every(snap => !snap.exists),
        "el evento Firestore debe limpiar Telegram");
      for (const name of telegramRemoved) {
        assert.equal((await admin.doc(name).get()).exists, false, name);
      }
      assert.equal((await admin.doc("telegramDrafts/other-kept").get()).exists, true);
      assert.equal((await admin.doc("testerPremium/other").get()).exists, true);
      assert.equal((await admin.doc("users/other").get()).exists, true);
    });
    await t.test("deshacer por HTTP invalida reintentos y permite una devolución nueva", async () => {
      const undo = await account("undo-owner");
      await admin.doc("users/undo-owner").set({ isPremium: true });
      const invoke = (name, data) => httpsCallable(undo.functions, name, { timeout: 90_000 })(data);
      for (const kind of ["family", "box"]) {
        const id = `undo-${kind}`, rootName = kind === "family" ? "familySpaces" : "boxSpaces";
        await admin.doc(`${rootName}/${id}`).set({ ownerUid: "undo-owner", nombre: "Demo", currency: "PEN" });
        await admin.doc(`${rootName}/${id}/members/undo-owner`).set({ uid: "undo-owner", rol: "owner" });
        await admin.doc(`${rootName}/${id}/movements/contribution`).set({ tipo: "ingreso", monto: 100,
          personalTransactionId: 10, personalOwnerUid: "undo-owner", creadoPor: "undo-owner", creadoEn: 1 });
        await admin.doc(`${rootName}/${id}/movements/spent`).set({ tipo: "gasto", monto: 60, creadoPor: "undo-owner", creadoEn: 2 });
        await admin.doc("users/undo-owner").update({ isPremium: true });
        const request = { ...payload, kind, spaceId: id, personalTransactionId: kind === "family" ? 700 : 800 };
        const returned = (await invoke("returnPersonalContribution", request)).data;
        const deletion = { kind, spaceId: id, movementId: returned.movementId, action: "delete" };
        await invoke("changePersonalContribution", deletion);
        await assert.rejects(invoke("returnPersonalContribution", request), error => error.details?.reason === "return-cancelled");
        await admin.doc("users/undo-owner").update({ isPremium: false });
        await invoke("changePersonalContribution", deletion); // Solo confirma la anulación previa, no cambia dinero.
        const fresh = (await invoke("returnPersonalContribution", { ...request, personalTransactionId: request.personalTransactionId + 1 })).data;
        assert.equal(fresh.amount, 40); assert.notEqual(fresh.movementId, returned.movementId);
        assert.equal((await admin.collection(`${rootName}/${id}/movements`).get()).size, 3);
      }
    });
    await t.test("correo sin confirmar no puede usar la devolución por HTTP", async () => {
      const unverified = await account("unverified", false);
      await assert.rejects(httpsCallable(unverified.functions, "returnPersonalContribution")(payload), error => error.code === "functions/unauthenticated");
    });
  } finally {
    await Promise.all(apps.map(deleteApp));
    await deleteAdmin(adminApp);
  }
});

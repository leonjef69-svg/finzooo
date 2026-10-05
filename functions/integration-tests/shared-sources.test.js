"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const root = path.resolve(__dirname, "../..");
const requireRoot = createRequire(path.join(root, "package.json"));
const { initializeApp, deleteApp } = requireRoot("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = requireRoot("firebase/auth");
const { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork, getDocFromServer, doc, terminate } = requireRoot("firebase/firestore");
const esbuild = requireRoot("esbuild");

async function sources(client) {
  const built = await esbuild.build({ stdin: { contents: `
    export { listarMovimientosFamilia, observarCierreFamilia } from "@/utils/cloudFamilia";
    export { escucharMovimientosCaja, confirmarCajaAbierta, observarCierreCaja } from "@/utils/cloudCajasCompartidas";`,
    resolveDir: root, sourcefile: "shared-sources.ts", loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    external: ["firebase/*"], alias: { "@": root,
      "react-native": path.join(root, "pruebas/stubs/rn.ts"),
      "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts") },
    plugins: [{ name: "only-demo-config", setup(build) {
      build.onLoad({ filter: /[\\/]utils[\\/]firebase\.ts$/ }, () => ({ loader: "ts",
        contents: "export const { auth, db, functions } = globalThis.__FINO_DEMO_CLIENT__;" }));
    } }],
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", "globalThis", built.outputFiles[0].text)(module, module.exports, requireRoot, { __FINO_DEMO_CLIENT__: client });
  return module.exports;
}

async function eventually(check, message) {
  const end = Date.now() + 12_000;
  while (Date.now() < end) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(message);
}

test("fuentes compartidas reales: caché no confirma saldos, metadatos y purga de cierre", { timeout: 90_000 }, async t => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  const projectId = "demo-fino-node22", uid = "sources-owner";
  const adminApp = initializeAdmin({ projectId }, "sources-validation");
  const admin = getAdminFirestore(adminApp), adminAuth = getAdminAuth(adminApp);
  const app = initializeApp({ projectId, apiKey: "demo-only-key", authDomain: `${projectId}.firebaseapp.com` }, "sources-validation");
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const stops = [];
  try {
    await adminAuth.createUser({ uid, email: `${uid}@example.test`, password: "SoloPruebaLocal123!", emailVerified: true });
    await admin.doc(`users/${uid}`).set({ isPremium: true });
    await signInWithEmailAndPassword(auth, `${uid}@example.test`, "SoloPruebaLocal123!");
    for (const kind of ["family", "box"]) {
      await admin.doc(`${kind}Spaces/sources-${kind}`).set({ ownerUid: uid, nombre: "Fuente demo", currency: "PEN" });
      await admin.doc(`${kind}Spaces/sources-${kind}/members/${uid}`).set({ uid, rol: "owner" });
      await admin.doc(`${kind}Spaces/sources-${kind}/movements/return-old`).set({ tipo: "gasto", monto: 40,
        personalOwnerUid: uid, personalTransactionId: 10, personalReturnAmount: 40, creadoEn: 1 });
    }
    const api = await sources({ auth, db, functions: {} });
    const errors = [], events = [];
    const stop = api.escucharMovimientosCaja("sources-box", (rows, confirmed) => events.push({ rows, confirmed }), error => errors.push(error));
    stops.push(stop);
    await eventually(() => events.some(item => item.confirmed), "la primera consulta llegó del servidor");
    await getDocFromServer(doc(db, "boxSpaces", "sources-box"));
    stop();
    await t.test("sin conexión muestra caché sin autorizar conciliación; volver a red confirma aun sin cambiar documentos", async () => {
      await disableNetwork(db);
      events.length = 0;
      stops.push(api.escucharMovimientosCaja("sources-box", (rows, confirmed) => events.push({ rows, confirmed }), error => errors.push(error)));
      await eventually(() => events.length > 0, "caché local entregada");
      assert.equal(events.at(-1).confirmed, false);
      assert.equal(events.at(-1).rows[0].personalTransactionId, 10);
      await enableNetwork(db);
      await eventually(() => events.at(-1)?.confirmed === true, "incluye cambios de metadatos: confirma los mismos documentos al reconectar");
      assert.equal(await api.confirmarCajaAbierta("sources-box"), true);
    });
    await t.test("un borrado remoto actualiza la lista confirmada y el cierre no permite interpretar su purga como aporte deshecho", async () => {
      await admin.doc("boxSpaces/sources-box/movements/return-old").delete();
      await eventually(() => events.at(-1)?.confirmed === true && events.at(-1).rows.length === 0, "el retorno remoto eliminado ya no está en la fuente");
      await admin.doc("boxSpaces/sources-box").update({ closed: true });
      assert.equal(await api.confirmarCajaAbierta("sources-box"), false);
      assert.equal(errors.length, 0);
    });
    await t.test("Familia exige servidor y espacio abierto, no considera una purga una lista válida de aportes", async () => {
      const rows = await api.listarMovimientosFamilia("sources-family", true);
      assert.equal(rows[0].personalTransactionId, 10);
      await disableNetwork(db);
      await assert.rejects(api.listarMovimientosFamilia("sources-family", true), error => error.code === "unavailable");
      await enableNetwork(db);
      await admin.doc("familySpaces/sources-family").update({ closed: true });
      await admin.doc("familySpaces/sources-family/movements/return-old").delete();
      await assert.rejects(api.listarMovimientosFamilia("sources-family", true), /family-unconfirmed/);
    });
  } finally {
    for (const stop of stops) stop();
    await terminate(db); await deleteApp(app); await admin.terminate(); await deleteAdmin(adminApp);
  }
});

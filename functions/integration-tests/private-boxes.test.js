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
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = requireRoot("firebase/auth");
const { getFirestore, connectFirestoreEmulator, disableNetwork, enableNetwork, getDocFromServer, doc, setDoc, deleteDoc, terminate } = requireRoot("firebase/firestore");
const esbuild = requireRoot("esbuild");

async function code(client) {
  const built = await esbuild.build({ stdin: { contents: 'export { bajarCajas, subirCajas } from "@/utils/cloudCajas"; export { loadPrivateBoxRepairCloud, assertPrivateBoxRepairCloud } from "@/utils/privateBoxRepairCloud"; export { resolvePrivateBoxConflict, privateBoxLinkCandidates } from "@/utils/privateBoxRepair";',
    resolveDir: root, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    external: ["firebase/*"], alias: { "@": root },
    plugins: [{ name: "demo-config-and-native-session", setup(build) {
      build.onLoad({ filter: /[\\/]utils[\\/]firebase\.ts$/ }, () => ({ loader: "ts",
        contents: "export const { auth, db } = globalThis.__FINO_DEMO__;" }));
      build.onLoad({ filter: /[\\/]utils[\\/]storage\.ts$/ }, () => ({ loader: "ts", contents: `
        export const getAccountStorageSession = () => globalThis.__FINO_DEMO__.native.session;
        export const hasUnreadableLocalData = () => globalThis.__FINO_DEMO__.native.unreadable;` }));
      const baseline = process.env.FINO_TEST_CAJAS_BASELINE;
      if (baseline) {
        if (!/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere un hash de Git.");
        build.onLoad({ filter: /[\\/]utils[\\/](?:cloudCajas|cajas)\.ts$/ }, ({ path: file }) => ({ loader: "ts",
          contents: execFileSync("git", ["show", `${baseline}:utils/${path.basename(file)}`], { cwd: root, encoding: "utf8" }) }));
      }
    } }],
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", "globalThis", built.outputFiles[0].text)(module, module.exports, requireRoot, { __FINO_DEMO__: client });
  return module.exports;
}

test("Cajas privadas con SDK/Firestore reales: versiones, transacción, borrados y cliente antiguo", { timeout: 120_000 }, async t => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  const projectId = "demo-fino-node22", uid = "private-sync-owner";
  const adminApp = initializeAdmin({ projectId }, "private-boxes-validation");
  const admin = getAdminFirestore(adminApp), adminAuth = getAdminAuth(adminApp);
  const clients = [];
  async function client(name) {
    const app = initializeApp({ projectId, apiKey: "demo-only-key", authDomain: `${projectId}.firebaseapp.com` }, name);
    const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
    const instance = { app, auth, db, native: { session: 1, unreadable: false } }; clients.push(instance);
    await signInWithEmailAndPassword(auth, `${uid}@example.test`, "SoloPruebaLocal123!");
    instance.api = await code(instance); return instance;
  }
  const box = { id: "caja-a", nombre: "A", creadaEn: 1, updatedAt: 10 };
  const row = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-05", creadoEn: 1, updatedAt: 10 };
  const initial = { cajas: [box], movimientos: [row], cajasBorradas: [], movimientosBorrados: [] };
  const ref = admin.doc(`cajas/${uid}`);
  try {
    await adminAuth.createUser({ uid, email: `${uid}@example.test`, password: "SoloPruebaLocal123!", emailVerified: true });
    await admin.doc(`users/${uid}`).set({ isPremium: true });
    await ref.set(initial);
    const a = await client("private-sync-a"), b = await client("private-sync-b");
    await t.test("una edición nueva gana a un teléfono atrasado y marca el formato 2", async () => {
      const recent = { ...initial, cajas: [{ ...box, nombre: "Editada", updatedAt: 20 }], movimientos: [{ ...row, monto: 120, updatedAt: 20 }] };
      assert.equal(await b.api.subirCajas(uid, recent), true);
      let confirmed;
      assert.equal(await a.api.subirCajas(uid, initial, undefined, value => { confirmed = value; }), true);
      if (!process.env.FINO_TEST_CAJAS_BASELINE) assert.equal(confirmed.movimientos[0].monto, 120, "entrega al teléfono la unión realmente confirmada");
      const server = (await ref.get()).data();
      assert.equal(server.movimientos[0].monto, 120); assert.equal(server.cajas[0].nombre, "Editada"); assert.equal(server.syncFormat, 2);
    });
    // La regresión reproduce únicamente la primera falla; en la ejecución
    // normal se corren todos los casos sin omitir ninguno.
    if (process.env.FINO_TEST_CAJAS_BASELINE) return;
    let combined;
    await t.test("dos SDK escribiendo simultáneamente conservan ambos movimientos y eliminan undefined", async () => {
      const extra = id => ({ ...row, id, monto: 30, creadoEn: 2, updatedAt: 30, personalTransactionId: undefined });
      const result = await Promise.all([
        a.api.subirCajas(uid, { ...initial, movimientos: [row, extra("mov-a-new")] }),
        b.api.subirCajas(uid, { ...initial, movimientos: [row, extra("mov-b-new")] }),
      ]);
      assert.deepEqual(result, [true, true]); combined = await a.api.bajarCajas(uid);
      assert.equal(combined.movimientos.length, 3); assert.equal(combined.movimientos.find(item => item.id === row.id).monto, 120);
      assert.equal(combined.movimientos.some(item => "personalTransactionId" in item), false);
    });
    await t.test("empate diferente y gasto concurrente que excede saldo no reemplazan ninguna copia", async () => {
      const errors = [];
      assert.equal(await a.api.subirCajas(uid, { ...combined, movimientos: combined.movimientos.map(item => item.id === row.id ? { ...item, monto: 119 } : item) }, error => errors.push(error.message)), false);
      assert.deepEqual(errors, ["cajas-sync-conflict"]); assert.equal((await ref.get()).data().movimientos.find(item => item.id === row.id).monto, 120);
      const expense = id => ({ ...row, id, tipo: "gasto", monto: 150, creadoEn: 4, updatedAt: 40 });
      assert.equal(await a.api.subirCajas(uid, { ...combined, movimientos: [...combined.movimientos, expense("mov-spent-a")] }), true);
      assert.equal(await b.api.subirCajas(uid, { ...combined, movimientos: [...combined.movimientos, expense("mov-spent-b")] }), false);
      assert.equal((await ref.get()).data().movimientos.some(item => item.id === "mov-spent-b"), false);
      await ref.set(combined);
    });
    await t.test("un borrado no reaparece desde el otro SDK y la versión vieja no quita el marcador", async () => {
      const deletion = { ...combined, movimientos: combined.movimientos.filter(item => item.id !== "mov-a-new"), movimientosBorrados: ["mov-a-new"] };
      assert.equal(await a.api.subirCajas(uid, deletion), true); assert.equal(await b.api.subirCajas(uid, combined), true);
      assert.equal((await ref.get()).data().movimientos.some(item => item.id === "mov-a-new"), false);
      await assert.rejects(setDoc(doc(a.db, "cajas", uid), initial), error => error.code === "permission-denied");
      await assert.rejects(setDoc(doc(a.db, "cajas", uid), { ...initial, syncFormat: 1 }), error => error.code === "permission-denied");
      await assert.rejects(setDoc(doc(a.db, "cajas", uid), { ...initial, syncFormat: 3 }), error => error.code === "permission-denied");
    });
    await t.test("caché sin conexión y documento incompleto no se confirman como ausencia", async () => {
      await a.api.bajarCajas(uid); await disableNetwork(a.db);
      await assert.rejects(a.api.bajarCajas(uid), error => error.code === "unavailable"); await enableNetwork(a.db);
      const saved = (await ref.get()).data(); await ref.update({ cajas: "corrupta" });
      await assert.rejects(a.api.bajarCajas(uid), /cajas-invalid-data/);
      assert.equal(await a.api.subirCajas(uid, saved), false); assert.equal((await ref.get()).data().cajas, "corrupta");
      await ref.set(saved);
    });
    await t.test("reparación lee Personal confirmado y no impone una mitad local sobre una edición remota", async () => {
      const personal = { id: 10, type: "expense", amount: 100, date: "2026-10-06", internalTransfer: "box", internalTransferLink: "mov-a", internalTransferSpaceId: "caja-a" };
      await admin.doc(`users/${uid}`).update({ transactions: [personal], deletedTransactionIds: [] });
      const proof = await a.api.loadPrivateBoxRepairCloud(uid, [10]);
      assert.deepEqual(proof.transactions, [personal]);
      assert.throws(() => a.api.assertPrivateBoxRepairCloud([{ ...personal, amount: 80 }], proof), /source-changed/);
      assert.throws(() => a.api.assertPrivateBoxRepairCloud([], proof), /source-changed/);
      assert.doesNotThrow(() => a.api.assertPrivateBoxRepairCloud([personal], proof));
      await disableNetwork(a.db);
      await assert.rejects(a.api.loadPrivateBoxRepairCloud(uid, [10]), error => error.code === "unavailable");
      await enableNetwork(a.db);
    });
    await t.test("un enlace antiguo elegido conserva su dinero y la copia SDK acepta el ID comprobado", async () => {
      const personal = { id: 10, type: "expense", amount: 100, date: row.fecha, internalTransfer: "box", notes: "Conservar" };
      await admin.doc(`users/${uid}`).set({ isPremium: true, transactions: [personal], deletedTransactionIds: [] });
      await ref.set(initial);
      const proof = await a.api.loadPrivateBoxRepairCloud(uid, [10]);
      assert.doesNotThrow(() => a.api.assertPrivateBoxRepairCloud([personal], proof));
      assert.equal(a.api.privateBoxLinkCandidates(initial, [personal], [], row.id).length, 1);
      const selected = a.api.resolvePrivateBoxConflict(initial, [personal], [], uid, { movementId: row.id, personalId: personal.id, from: "link" });
      assert.equal(selected.upserts[0].amount, 100); assert.equal(selected.upserts[0].notes, "Conservar");
      assert.equal(await a.api.subirCajas(uid, selected.data), true);
      const saved = (await ref.get()).data();
      assert.equal(saved.movimientos.length, 1); assert.equal(saved.movimientos[0].personalTransactionId, 10); assert.equal(saved.movimientos[0].monto, 100);
      await assert.rejects(a.api.loadPrivateBoxRepairCloud("otra-cuenta", [10]), /account-task-obsolete/);
    });
    await t.test("historial separado consulta solo los IDs pedidos y una marca remota no se resucita", async () => {
      const personal = { id: 10, type: "expense", amount: 100, date: "2026-10-06", internalTransfer: "box" };
      await admin.doc(`users/${uid}`).set({ isPremium: true, historyFormat: 2 });
      await admin.doc(`users/${uid}/history/10`).set({ id: 10, deleted: false, transaction: personal });
      await admin.doc(`users/${uid}/history/11`).set({ id: 11, deleted: true });
      await admin.doc(`users/${uid}/history/12`).set({ id: 12, deleted: false, transaction: { ...personal, id: 12 } });
      const proof = await a.api.loadPrivateBoxRepairCloud(uid, [10, 11, 999]);
      assert.deepEqual(proof.transactions, [personal]); assert.deepEqual(proof.deletedIds, [11]);
      assert.throws(() => a.api.assertPrivateBoxRepairCloud([personal], proof), /source-changed/);
    });
    await t.test("archivo local ilegible no se sube; Gratis no lee la nube, pero puede borrar su copia", async () => {
      a.native.unreadable = true; assert.equal(await a.api.subirCajas(uid, combined), false); a.native.unreadable = false;
      await admin.doc(`users/${uid}`).update({ isPremium: false });
      await assert.rejects(getDocFromServer(doc(a.db, "cajas", uid)), error => error.code === "permission-denied");
      await deleteDoc(doc(a.db, "cajas", uid)); assert.equal((await ref.get()).exists, false);
    });
  } finally {
    for (const c of clients) { await terminate(c.db); await deleteApp(c.app); }
    await admin.terminate(); await deleteAdmin(adminApp);
  }
});

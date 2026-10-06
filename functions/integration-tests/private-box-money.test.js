"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { createRequire } = require("node:module"), { execFileSync } = require("node:child_process");
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const root = path.resolve(__dirname, "../.."), requireRoot = createRequire(path.join(root, "package.json"));
const { initializeApp, deleteApp } = requireRoot("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = requireRoot("firebase/auth");
const { getFunctions, connectFunctionsEmulator, httpsCallable } = requireRoot("firebase/functions");
const { getFirestore, connectFirestoreEmulator, terminate } = requireRoot("firebase/firestore");
const { resolvePrivateBoxMoney } = require("../src/private-box-money");
const { moneyResult } = require("../src/private-box-money-shared");
const esbuild = requireRoot("esbuild");
const copy = value => structuredClone(value);
const baseline = process.env.FINO_TEST_MONEY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");

test("Corrección de dinero: SDK/HTTP y transacciones reales sin medias transferencias", { timeout: 120_000 }, async t => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099"); assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  const projectId = "demo-fino-node22", uid = "money-review-owner";
  const adminApp = initializeAdmin({ projectId }, "money-review-validation"), admin = getAdminFirestore(adminApp), adminAuth = getAdminAuth(adminApp);
  const clients = [];
  const box = { id: "caja-money", nombre: "Viaje", creadaEn: 1, updatedAt: 10 };
  const p = { id: 10, type: "expense", amount: 100, date: "2026-10-06", category: "otros", method: "transfer", description: "Aporte", notes: "Conservar", internalTransfer: "box", internalTransferLink: "mov-money", internalTransferSpaceId: box.id, updatedAt: 10 };
  const m = { id: "mov-money", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: p.date, creadoEn: 2, personalTransactionId: p.id, updatedAt: 10 };
  const entry = { id: "money-operation-first", uid, currency: "PEN", box, local: { personal: p, movement: m },
    remote: { personal: { ...p, amount: 80 }, movement: { ...m, monto: 80 } }, chosen: "local-personal", createdAt: 100, version: 100 };
  const rootRef = admin.doc(`users/${uid}`), boxesRef = admin.doc(`cajas/${uid}`);
  async function seed(format = 1, currency = "PEN") {
    await rootRef.set({ hasOnboarded: true, isPremium: true, userCurrency: currency, future: "Conservar",
      ...(format === 2 ? { historyFormat: 2 } : { transactions: [entry.remote.personal], deletedTransactionIds: [99] }) });
    await boxesRef.set({ cajas: [box], movimientos: [entry.remote.movement], cajasBorradas: [], movimientosBorrados: ["mov-old"], future: { preserved: true } });
    if (format === 2) await rootRef.collection("history").doc("10").set({ id: 10, deleted: false, transaction: entry.remote.personal });
    await admin.doc(`premiumTrialClaims/${uid}`).delete();
  }
  async function client(name, owner = uid) {
    const app = initializeApp({ projectId, apiKey: "demo-only-key", authDomain: `${projectId}.firebaseapp.com` }, name);
    const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
    const functions = getFunctions(app, "southamerica-east1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    const result = { app, db, auth, functions, call: httpsCallable(functions, "resolvePrivateBoxMoney", { timeout: 120_000 }) }; clients.push(result);
    await signInWithEmailAndPassword(auth, `${owner}@example.test`, "SoloPruebaLocal123!"); return result;
  }
  async function oldUpload(client) {
    const built = await esbuild.build({ stdin: { contents: 'export { subirCajas } from "@/utils/cloudCajas";', resolveDir: root, loader: "ts" },
      bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", external: ["firebase/*"], alias: { "@": root },
      plugins: [{ name: "previous-real-client", setup(build) {
        build.onLoad({ filter: /[\\/]utils[\\/]firebase\.ts$/ }, () => ({ loader: "ts", contents: "export const {auth,db}=globalThis.client;" }));
        build.onLoad({ filter: /[\\/]utils[\\/]storage\.ts$/ }, () => ({ loader: "ts", contents: "export const getAccountStorageSession=()=>1; export const hasUnreadableLocalData=()=>false; export const STORAGE_KEYS={cajasDinero:'cajas'}; export const loadJSON=async(_key,fallback)=>fallback;" }));
        build.onLoad({ filter: /[\\/]utils[\\/](?:cloudCajas|cajas)\.ts$/ }, ({ path: file }) => ({ loader: "ts", contents: execFileSync("git", ["show", `${baseline}:utils/${path.basename(file)}`], { cwd: root, encoding: "utf8" }) }));
      } }] });
    const module = { exports: {} };
    new Function("module", "exports", "require", "globalThis", built.outputFiles[0].text)(module, module.exports, requireRoot, { client });
    const selected = moneyResult(entry);
    assert.equal(await module.exports.subirCajas(uid, { cajas: [box], movimientos: [selected.movement], cajasBorradas: [], movimientosBorrados: ["mov-old"] }), true);
  }
  try {
    await adminAuth.createUser({ uid, email: `${uid}@example.test`, password: "SoloPruebaLocal123!", emailVerified: true });
    const a = await client("money-review-a"), b = await client("money-review-b");
    await t.test("elegir S/100 no deja Caja S/100 y Personal S/80", async () => {
      await seed();
      if (baseline) await oldUpload(a); else await a.call(entry);
      const personal = (await rootRef.get()).data().transactions[0], move = (await boxesRef.get()).data().movimientos[0];
      assert.equal(personal.amount, 100, "la corrección debe guardar también la mitad Personal"); assert.equal(move.monto, 100);
      assert.equal(personal.updatedAt, entry.version); assert.equal(move.updatedAt, entry.version);
      assert.equal(personal.notes, p.notes); assert.deepEqual((await boxesRef.get()).data().future, { preserved: true });
    });
    // Regresión: solo la operación anterior; normal: todos los casos.
    if (baseline) return;
    await t.test("respuesta perdida se confirma otra vez sin escritura ni duplicación", async () => {
      const before = [await rootRef.get(), await boxesRef.get()]; const result = await b.call(entry);
      assert.equal(result.data.confirmed, true); assert.equal(result.data.amount, 100);
      const after = [await rootRef.get(), await boxesRef.get()];
      assert.deepEqual(after.map(item => item.updateTime.toMillis()), before.map(item => item.updateTime.toMillis()));
      assert.equal(after[0].data().transactions.length, 1); assert.equal(after[1].data().movimientos.length, 1);
    });
    await t.test("dos elecciones simultáneas solo permiten un resultado", async () => {
      await seed(); const result = await Promise.allSettled([a.call(entry), b.call({ ...entry, id: "money-operation-second", chosen: "remote-personal", version: 101 })]);
      assert.equal(result.filter(item => item.status === "fulfilled").length, 1);
      const personal = (await rootRef.get()).data().transactions[0], move = (await boxesRef.get()).data().movimientos[0];
      assert.equal(personal.amount, move.monto); assert.equal(personal.updatedAt, move.updatedAt);
    });
    await t.test("edición posterior en Personal, movimiento o Caja no se sobrescribe", async () => {
      for (const change of [() => rootRef.update({ transactions: [{ ...entry.remote.personal, amount: 70 }] }),
        () => boxesRef.update({ movimientos: [{ ...entry.remote.movement, updatedAt: 11 }] }), () => boxesRef.update({ cajas: [{ ...box, nombre: "Cambió" }] })]) {
        await seed(); await change(); const before = [await rootRef.get(), await boxesRef.get()];
        await assert.rejects(a.call(entry), error => error.details?.reason === "money-source-changed");
        const after = [await rootRef.get(), await boxesRef.get()]; assert.deepEqual(after.map(item => item.data()), before.map(item => item.data()));
      }
      await seed(); await rootRef.update({ transactions: [{ ...entry.remote.personal, notes: NaN }] });
      await assert.rejects(a.call(entry), error => error.details?.reason === "money-invalid-source");
      assert.equal(Number.isNaN((await rootRef.get()).data().transactions[0].notes), true, "un dato ilegible no se reemplaza silenciosamente por null");
      assert.equal((await boxesRef.get()).data().movimientos[0].monto, 80);
    });
    await t.test("gasto concurrente que haría saldo negativo y devolución posterior bloquean la corrección", async () => {
      await seed(); await boxesRef.update({ movimientos: [entry.remote.movement, { ...m, id: "spent", tipo: "gasto", monto: 90, personalTransactionId: null }] });
      await assert.rejects(a.call({ ...entry, chosen: "remote-box" }), error => error.details?.reason === "money-negative-balance");
      assert.equal((await rootRef.get()).data().transactions[0].amount, 80);
      await seed(); await boxesRef.update({ movimientos: [entry.remote.movement, { ...m, id: "returned", tipo: "gasto", monto: 20, personalTransactionId: 11, personalReturnAmount: 20 }] });
      await assert.rejects(a.call(entry), error => error.details?.reason === "money-return-conflict");
    });
    await t.test("historial separado confirma el par, conserva otros documentos y publica syncAt", async () => {
      await seed(2); await rootRef.collection("history").doc("20").set({ id: 20, deleted: false, transaction: { ...p, id: 20, internalTransferLink: "otra" } });
      await a.call(entry); const row = (await rootRef.collection("history").doc("10").get()).data();
      assert.equal(row.transaction.amount, 100); assert.equal(typeof row.syncAt.toMillis, "function"); assert.equal((await rootRef.get()).data().transactions, undefined);
      assert.equal((await rootRef.collection("history").doc("20").get()).data().transaction.internalTransferLink, "otra");
      await rootRef.collection("history").doc("11").set({ id: 11, deleted: false, transaction: { ...p, id: 11 } });
      await assert.rejects(a.call(entry), error => error.details?.reason === "money-source-changed");
      await rootRef.collection("history").doc("11").delete();
      await rootRef.collection("history").doc("10").set({ id: 10, deleted: true });
      await assert.rejects(a.call(entry), error => error.details?.reason === "money-source-changed");
    });
    await t.test("una excepción tras preparar el primer update revierte ambos con Firestore real", async () => {
      await seed(); const before = [await rootRef.get(), await boxesRef.get()]; let count = 0;
      const wrapped = { doc: admin.doc.bind(admin), collection: admin.collection.bind(admin), runTransaction: work => admin.runTransaction(tx => work({
        get: tx.get.bind(tx), update: (ref, value) => { count++; if (count === 2) throw Error("injected-interruption"); return tx.update(ref, value); } })) };
      await assert.rejects(resolvePrivateBoxMoney(wrapped, uid, entry), /injected-interruption/);
      const after = [await rootRef.get(), await boxesRef.get()]; assert.deepEqual(after.map(item => item.data()), before.map(item => item.data()));
    });
    await t.test("otra cuenta, token sin cuenta y Gratis no pueden corregir datos ajenos", async () => {
      await seed(); const guestUid = "money-review-guest";
      await adminAuth.createUser({ uid: guestUid, email: `${guestUid}@example.test`, password: "SoloPruebaLocal123!", emailVerified: true });
      const guest = await client("money-review-guest-client", guestUid);
      await assert.rejects(guest.call(entry), error => error.code === "functions/invalid-argument");
      await rootRef.update({ isPremium: false });
      await assert.rejects(a.call(entry), error => error.code === "functions/permission-denied");
      await rootRef.update({ isPremium: true }); await adminAuth.deleteUser(guestUid);
      await assert.rejects(guest.call({ ...entry, uid: guestUid }), error => /user-not-found|internal|unauthenticated/.test(error.code));
      assert.equal((await rootRef.get()).data().transactions[0].amount, 80);
    });
    await t.test("marcas de borrado y cuenta cerrándose no reabren movimientos", async () => {
      for (const change of [() => boxesRef.update({ cajasBorradas: [box.id] }), () => boxesRef.update({ movimientosBorrados: [m.id] }),
        () => rootRef.update({ accountDeletionPending: true }), () => admin.doc(`premiumTrialClaims/${uid}`).set({ deletionPending: true })]) {
        await seed(); await change(); await assert.rejects(a.call(entry)); assert.equal((await boxesRef.get()).data().movimientos[0].monto, 80);
      }
    });
    await t.test("fecha inválida, elección desconocida, campos distintos y petición demasiado grande se rechazan", async () => {
      await seed();
      for (const change of [value => { value.local.personal.date = "2026-02-30"; }, value => { value.chosen = "inventado"; },
        value => { value.local.personal.notes = "Otra nota"; }, value => { value.extra = "x".repeat(150000); }]) {
        const value = copy(entry); change(value); await assert.rejects(a.call(value), error => error.code === "functions/invalid-argument");
      }
      assert.equal((await rootRef.get()).data().transactions[0].amount, 80); assert.equal((await boxesRef.get()).data().movimientos[0].monto, 80);
    });
  } finally {
    for (const client of clients) { await terminate(client.db); await deleteApp(client.app); }
    await admin.terminate(); await deleteAdmin(adminApp);
  }
});

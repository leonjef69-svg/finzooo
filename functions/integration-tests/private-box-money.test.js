"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { createRequire } = require("node:module"), { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
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
  async function reviewClient(client) {
    const native = { session: 1, unreadable: false, current: true, rows: [copy(entry.local.personal)], currency: "PEN",
      boxes: { cajas: [box], movimientos: [entry.local.movement], cajasBorradas: [], movimientosBorrados: [], revisionesImporte: [{ ...copy(entry), estado: "pendiente" }] } };
    const env = { ...client, native };
    const built = await esbuild.build({ stdin: { contents: 'export * from "@/utils/cloudPrivateBoxMoney"; export * from "@/utils/privateBoxSync";', resolveDir: root, loader: "ts" },
      bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", external: ["firebase/*"], alias: { "@": root },
      plugins: [{ name: "real-money-client-native-session", setup(build) {
        build.onLoad({ filter: /[\\/]utils[\\/]firebase\.ts$/ }, () => ({ loader: "ts", contents: "export const {auth,db,functions}=globalThis.client;" }));
        build.onLoad({ filter: /[\\/]utils[\\/]storage\.ts$/ }, () => ({ loader: "ts", contents: `
          const native=globalThis.client.native;
          export const getAccountStorageSession=()=>native.session;
          export const hasUnreadableLocalData=()=>native.unreadable;
          export const STORAGE_KEYS={cajasDinero:'cajas'};
          export const loadJSON=async(_key,fallback)=>native.boxes == null ? fallback : structuredClone(native.boxes);` }));
      } }] });
    const module = { exports: {} };
    new Function("module", "exports", "require", "globalThis", built.outputFiles[0].text)(module, module.exports, requireRoot, { client: env });
    const api = module.exports, selected = { ...copy(entry), estado: "pendiente" };
    const local = () => ({ transactions: native.rows, deletedIds: [], currency: native.currency });
    return { api, native, selected, local, request: lease => api.requestPrivateBoxMoneyReview(uid, selected, lease, local, () => native.current) };
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
    await t.test("cliente original exige originales en disco antes de llamar al servidor", async () => {
      await seed(); const client = await reviewClient(a), { api, native } = client;
      delete native.boxes.revisionesImporte;
      const before = [await rootRef.get(), await boxesRef.get()];
      await assert.rejects(api.withPrivateBoxMoneyReview(uid, client.request), /cajas-money-changed/);
      const after = [await rootRef.get(), await boxesRef.get()];
      assert.deepEqual(after.map(row => row.updateTime.toMillis()), before.map(row => row.updateTime.toMillis()));
      assert.equal(after[0].data().transactions[0].amount, 80);
    });
    await t.test("cliente original consulta fuentes exactas en ambos formatos sin descargar todo el historial", async () => {
      for (const format of [1, 2]) {
        await seed(format); const client = await reviewClient(a), { api, selected, native } = client;
        await api.withPrivateBoxMoneyReview(uid, async lease => {
          const sources = await api.loadPrivateBoxMoneySources(uid, m.id, p.id, "PEN", lease);
          assert.deepEqual(sources.transactions, [entry.remote.personal]); assert.equal(sources.data.movimientos[0].monto, 80);
          const ack = await client.request(lease);
          api.assertPrivateBoxMoneyReceipt(uid, selected, ack, lease);
          assert.throws(() => api.assertPrivateBoxMoneyReceipt(uid, selected, copy(ack), lease), /unconfirmed/);
          assert.equal(native.boxes.revisionesImporte[0].estado, "pendiente", "HTTP no se presenta como guardado local final");
          const remotePersonal = format === 2 ? (await rootRef.collection("history").doc("10").get()).data().transaction : (await rootRef.get()).data().transactions[0];
          assert.equal(remotePersonal.amount, 100); assert.equal((await boxesRef.get()).data().movimientos[0].monto, 100);
        });
      }
    });
    await t.test("cliente original recupera confirmación perdida sin volver a escribir ni duplicar", async () => {
      await seed(); const client = await reviewClient(a), { api, native, selected } = client;
      let oldAck, oldLease;
      await api.withPrivateBoxMoneyReview(uid, async lease => { oldLease = lease; oldAck = await client.request(lease); });
      // Simula que no se llegó al lote local. Los cuatro originales siguen intactos.
      assert.equal(native.boxes.revisionesImporte[0].estado, "pendiente");
      const before = [await rootRef.get(), await boxesRef.get()];
      await api.withPrivateBoxMoneyReview(uid, async lease => {
        assert.throws(() => api.assertPrivateBoxMoneyReceipt(uid, selected, oldAck, oldLease), /review-changed/);
        const ack = await client.request(lease); api.assertPrivateBoxMoneyReceipt(uid, selected, ack, lease);
      });
      const after = [await rootRef.get(), await boxesRef.get()];
      assert.deepEqual(after.map(row => row.updateTime.toMillis()), before.map(row => row.updateTime.toMillis()));
      assert.equal(after[0].data().transactions.length, 1); assert.equal(after[1].data().movimientos.length, 1);
    });
    await t.test("cliente original no confirma localmente una respuesta si la pantalla se cerró durante HTTP", async () => {
      await seed(); const client = await reviewClient(a), { api, native, selected } = client;
      let reads = 0;
      await assert.rejects(api.withPrivateBoxMoneyReview(uid, lease => api.requestPrivateBoxMoneyReview(uid, selected, lease, () => {
        if (++reads === 2) native.current = false;
        return client.local();
      }, () => native.current)), /obsolete/);
      assert.equal(native.boxes.revisionesImporte[0].estado, "pendiente");
      assert.equal((await rootRef.get()).data().transactions[0].amount, 100, "una petición ya enviada puede haberse confirmado en servidor");
      const before = [await rootRef.get(), await boxesRef.get()]; native.current = true;
      await api.withPrivateBoxMoneyReview(uid, client.request);
      const after = [await rootRef.get(), await boxesRef.get()];
      assert.deepEqual(after.map(row => row.updateTime.toMillis()), before.map(row => row.updateTime.toMillis()));
    });
    await t.test("cliente original respeta Pro revocado y ediciones posteriores sin perder originales", async () => {
      await seed(); const client = await reviewClient(a), { api, native } = client;
      await rootRef.update({ isPremium: false });
      await assert.rejects(api.withPrivateBoxMoneyReview(uid, lease => api.loadPrivateBoxMoneySources(uid, m.id, p.id, "PEN", lease)), error => error.code === "permission-denied");
      await assert.rejects(api.withPrivateBoxMoneyReview(uid, client.request), error => error.code === "functions/permission-denied");
      assert.equal(native.boxes.revisionesImporte[0].estado, "pendiente");
      await rootRef.update({ isPremium: true, transactions: [{ ...entry.remote.personal, amount: 70 }] });
      await assert.rejects(api.withPrivateBoxMoneyReview(uid, client.request), error => error.details?.reason === "money-source-changed");
      assert.equal((await rootRef.get()).data().transactions[0].amount, 70); assert.equal((await boxesRef.get()).data().movimientos[0].monto, 80);
      assert.deepEqual(native.boxes.revisionesImporte[0].remote.personal, entry.remote.personal);
    });
    const { createMoneyBatchHarness } = await import(pathToFileURL(path.join(root, "pruebas/verificar-lote-importe-caja.mjs")).href);
    const selected = { ...copy(entry), estado: "pendiente" };
    const localBoxes = { cajas: [copy(box)], movimientos: [copy(m)], cajasBorradas: [], movimientosBorrados: [], revisionesImporte: [selected] };
    await t.test("flujo original completo: consulta SDK, cuatro fuentes, reconsulta, originales SQLite y corrección HTTP en ambos formatos", async () => {
      for (const format of [1, 2]) {
        await seed(format);
        const initial = { cajas: [copy(box)], movimientos: [copy(m)], cajasBorradas: [], movimientosBorrados: [] };
        const h = createMoneyBatchHarness(a, selected, initial, [copy(p)]);
        const port = { current: () => h.e.active, premium: () => true, boxes: () => h.e.screen.current, local: h.ctx.readPrivateBoxMoneyLocal,
          stage: (before, entry, lease, current) => h.ctx.stagePrivateBoxMoney(before, entry, lease, current, h.setBoxes),
          commit: (before, entry, ack, lease, current) => h.ctx.commitPrivateBoxMoney(before, entry, ack, lease, current, h.setBoxes) };
        try {
          const comparison = await h.api.compararImporteCaja(uid, m.id, port);
          assert.equal(comparison.choices.length, 4); assert.equal(h.e.calls, 0); assert.equal(h.e.writes, 0);
          assert.equal(await h.api.confirmarImporteCaja(comparison, "remote-box", port), true);
          assert.equal(h.e.writes, 2); assert.equal(h.e.calls, 1);
          const saved = h.disk(h.api.STORAGE_KEYS.cajasDinero), entry = saved.revisionesImporte[0];
          const remote = format === 2 ? (await rootRef.collection("history").doc("10").get()).data().transaction : (await rootRef.get()).data().transactions[0];
          assert.equal(entry.estado, "confirmado"); assert.deepEqual(entry.local, { personal: p, movement: m });
          assert.deepEqual(entry.remote, selected.remote); assert.deepEqual(remote, h.disk(h.api.STORAGE_KEYS.transactions)[0]);
          assert.deepEqual(saved.movimientos, (await boxesRef.get()).data().movimientos);
          assert.equal(remote.amount, 80); assert.equal(remote.updatedAt, entry.version);
          assert.equal((await rootRef.get()).data().future, "Conservar");
        } finally { h.e.db.close(); }
      }
    });
    await t.test("HTTP auténtico llega al contexto y SQLite originales, Personal/Caja y marca juntos en ambos formatos", async () => {
      for (const format of [1, 2]) {
        await seed(format);
        const h = createMoneyBatchHarness(a, selected, localBoxes, [copy(p)]);
        try {
          assert.equal(await h.run(), true);
          const localPersonal = h.disk(h.api.STORAGE_KEYS.transactions)[0], localBox = h.disk(h.api.STORAGE_KEYS.cajasDinero);
          const remotePersonal = format === 2 ? (await rootRef.collection("history").doc("10").get()).data().transaction : (await rootRef.get()).data().transactions[0];
          assert.deepEqual(localPersonal, remotePersonal); assert.deepEqual(localBox.movimientos[0], (await boxesRef.get()).data().movimientos[0]);
          assert.equal(localPersonal.updatedAt, selected.version); assert.equal(localBox.revisionesImporte[0].estado, "confirmado");
          assert.deepEqual(localBox.revisionesImporte[0].local, selected.local); assert.equal(h.e.applied.length, 1);
        } finally { h.e.db.close(); }
      }
    });
    await t.test("fallo SQLite después de HTTP conserva originales; reintentar confirma local sin otra escritura remota", async () => {
      await seed(); const h = createMoneyBatchHarness(a, selected, localBoxes, [copy(p)]); h.e.failure = "rollback";
      try {
        assert.equal(await h.run(), false); assert.equal(h.e.applied.length, 0);
        assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado, "pendiente");
        assert.equal(h.e.rows.current[0].updatedAt, p.updatedAt);
        const before = [await rootRef.get(), await boxesRef.get()];
        h.e.failure = null; assert.equal(await h.run(), true);
        const after = [await rootRef.get(), await boxesRef.get()];
        assert.deepEqual(after.map(row => row.updateTime.toMillis()), before.map(row => row.updateTime.toMillis()));
        assert.equal(h.disk(h.api.STORAGE_KEYS.transactions)[0].updatedAt, selected.version);
        assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado, "confirmado");
      } finally { h.e.db.close(); }
    });
    await t.test("Pro vence después de HTTP confirmado: el contexto completa ese lote local sin otro permiso remoto", async () => {
      await seed(); const h = createMoneyBatchHarness(a, selected, localBoxes, [copy(p)]);
      try {
        await h.api.withPrivateBoxMoneyReview(uid, async lease => {
          const ack = await h.request(lease); await rootRef.update({ isPremium: false });
          assert.equal(await h.commit(ack, lease), true);
          assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado, "confirmado");
          assert.equal(h.e.calls, 1, "no intenta una segunda operación remota al completar la primera");
        });
      } finally { h.e.db.close(); }
    });
  } finally {
    for (const client of clients) { await terminate(client.db); await deleteApp(client.app); }
    await admin.terminate(); await deleteAdmin(adminApp);
  }
});

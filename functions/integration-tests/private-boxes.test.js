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
  const names = process.env.FINO_TEST_CAJAS_BASELINE ? "" : 'export { resolverNombreCaja } from "@/utils/cloudCajas"; export { prepararRevisionNombre } from "@/utils/cajas"; export { planPrivateBoxRepair } from "@/utils/privateBoxRepair"; export {saveCloudData} from "@/utils/cloudSync"; export {saveHistoryV2,loadHistoryV2} from "@/utils/cloudHistoryV2"; export {withPrivateBoxMoneyReview,privateBoxCloudResponseCurrent} from "@/utils/privateBoxSync";';
  const built = await esbuild.build({ stdin: { contents: 'export { bajarCajas, subirCajas } from "@/utils/cloudCajas"; export { loadPrivateBoxRepairCloud, assertPrivateBoxRepairCloud } from "@/utils/privateBoxRepairCloud"; export { resolvePrivateBoxConflict, privateBoxLinkCandidates } from "@/utils/privateBoxRepair";' + names,
    resolveDir: root, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    external: ["firebase/*"], alias: { "@": root, "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts") },
    plugins: [{ name: "demo-config-and-native-session", setup(build) {
      build.onLoad({ filter: /[\\/]utils[\\/]firebase\.ts$/ }, () => ({ loader: "ts",
        contents: "export const { auth, db, functions } = globalThis.__FINO_DEMO__;" }));
      build.onLoad({ filter: /[\\/]utils[\\/]storage\.ts$/ }, () => ({ loader: "ts", contents: `
        export const getAccountStorageSession = () => globalThis.__FINO_DEMO__.native.session;
        export const STORAGE_KEYS = {cajasDinero:'cajas'};
        export const loadJSON = async (_key, fallback) => globalThis.__FINO_DEMO__.native.localCajas ?? fallback;
        export const hasUnreadableLocalData = () => globalThis.__FINO_DEMO__.native.unreadable;` }));
      // El módulo excluido no se carga ni prueba; el borrado no forma parte de esta suite.
      build.onResolve({ filter: /^@\/utils\/creditCloud$/ }, () => ({ path: "excluded-credit", namespace: "excluded" }));
      build.onLoad({ filter: /.*/, namespace: "excluded" }, () => ({ loader: "ts", contents: "export const deleteCreditCloudAccount=async()=>{};" }));
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
    await t.test("una copia cerrada confirmada no reconstruye Personal ni reabre un aporte", async () => {
      const closed = { ...initial, movimientos: [{ ...row, personalTransactionId: 10 }], cajasBorradas: [box.id], syncFormat: 2 };
      await ref.set(closed);
      const checked = await a.api.bajarCajas(uid), plan = a.api.planPrivateBoxRepair(checked, [], [], uid);
      assert.equal(plan.upserts.length, 0); assert.ok(plan.conflicts.some(item => item.reason === "settled"));
      assert.deepEqual(plan.data, checked); assert.deepEqual((await ref.get()).data(), closed);
    });
    await t.test("devolución y fecha dañadas leídas por SDK se conservan sin aceptar una reparación financiera", async () => {
      const contribution = { ...row, personalTransactionId: 10 };
      const returned = { ...row, id: "broken-return", tipo: "gasto", monto: 40, personalReturnAmount: 40, personalTransactionId: 11, creadoEn: 2 };
      const personal = { id: 10, type: "expense", amount: 100, date: row.fecha, internalTransfer: "box", internalTransferLink: row.id, internalTransferSpaceId: box.id, internalTransferSpaceName: box.nombre };
      await ref.set({ ...initial, movimientos: [contribution, returned] });
      const checked = await a.api.bajarCajas(uid);
      const damaged = { ...personal, id: 11, type: "income", amount: 40, internalTransferLink: returned.id, internalTransferAllocations: {} };
      const plan = a.api.planPrivateBoxRepair(checked, [personal, damaged], [], uid);
      assert.equal(plan.upserts.length, 0); assert.ok(plan.conflicts.some(item => item.reason === "invalid"));
      assert.deepEqual(plan.data, checked);
      await ref.set({ ...initial, movimientos: [{ ...contribution, fecha: "2026-02-30" }] });
      const badDate = await a.api.bajarCajas(uid), invalid = a.api.planPrivateBoxRepair(badDate, [], [], uid);
      assert.equal(invalid.upserts.length, 0); assert.ok(invalid.conflicts.some(item => item.reason === "invalid"));
      assert.equal((await ref.get()).data().movimientos[0].fecha, "2026-02-30");
    });
    const remoteName = { ...box, nombre: "Vacaciones" }, otherBox = { ...box, id: "caja-b", nombre: "Casa" };
    const nameLocal = { ...initial, syncFormat: 2, cajas: [box, otherBox], movimientosBorrados: ["mov-old"] };
    const nameRemote = { ...nameLocal, cajas: [remoteName, otherBox], future: { preserved: true } };
    await t.test("elección explícita de nombre conserva dinero, marcas y campos remotos; repetir no escribe otra vez", async () => {
      await ref.set(nameRemote);
      const entry = a.api.prepararRevisionNombre(nameLocal, nameRemote, uid, "name-sdk-a", box.id, "local", 100);
      let conflict;
      assert.equal(await a.api.subirCajas(uid, nameLocal, error => { conflict = error; }), false);
      assert.equal(conflict.cajaRemota.cajas[0].nombre, remoteName.nombre);
      const ack = await a.api.resolverNombreCaja(uid, entry);
      assert.deepEqual(ack, { uid, id: entry.id, boxId: box.id, nombre: box.nombre, version: 100 });
      const saved = await ref.get(); assert.deepEqual(saved.data().movimientos, initial.movimientos);
      assert.deepEqual(saved.data().movimientosBorrados, ["mov-old"]); assert.deepEqual(saved.data().future, { preserved: true });
      assert.equal(saved.data().revisionesNombre, undefined);
      assert.deepEqual(await b.api.resolverNombreCaja(uid, entry), ack);
      assert.equal((await ref.get()).updateTime.toMillis(), saved.updateTime.toMillis(), "el reintento es una confirmación sin escritura");
    });
    await t.test("dos elecciones de nombres simultáneas no se pisan; una queda para revisar", async () => {
      await ref.set(nameRemote);
      const localChoice = a.api.prepararRevisionNombre(nameLocal, nameRemote, uid, "name-sdk-b", box.id, "local", 101);
      const cloudChoice = b.api.prepararRevisionNombre(nameLocal, nameRemote, uid, "name-sdk-c", box.id, "nube", 102);
      const result = await Promise.allSettled([a.api.resolverNombreCaja(uid, localChoice), b.api.resolverNombreCaja(uid, cloudChoice)]);
      assert.equal(result.filter(item => item.status === "fulfilled").length, 1);
      assert.match(result.find(item => item.status === "rejected").reason.message, /cajas-name-changed/);
      const successful = result.find(item => item.status === "fulfilled").value;
      assert.equal((await ref.get()).data().cajas[0].nombre, successful.nombre);
      assert.deepEqual((await ref.get()).data().movimientos, initial.movimientos);
    });
    await t.test("una Caja cambiada o borrada después de mostrar el nombre impide la elección anterior", async () => {
      const entry = a.api.prepararRevisionNombre(nameLocal, nameRemote, uid, "name-sdk-d", box.id, "local", 103);
      await ref.set({ ...nameRemote, cajas: [{ ...remoteName, nombre: "Cambió", updatedAt: 200 }, otherBox] });
      await assert.rejects(a.api.resolverNombreCaja(uid, entry), /cajas-name-changed/);
      assert.equal((await ref.get()).data().cajas[0].nombre, "Cambió");
      await ref.set({ ...nameRemote, cajas: [otherBox], movimientos: [], cajasBorradas: [box.id] });
      await assert.rejects(a.api.resolverNombreCaja(uid, entry), /cajas-name-changed/);
      assert.deepEqual((await ref.get()).data().cajasBorradas, [box.id]);
    });
    await t.test("elegir nube conserva la edición simultánea de otra Caja y no rebaja el formato 3", async () => {
      await ref.set({ ...nameRemote, syncFormat: 3, conversiones: {}, cajas: [remoteName, { ...otherBox, nombre: "Casa nueva", updatedAt: 300 }] });
      const entry = a.api.prepararRevisionNombre(nameLocal, nameRemote, uid, "name-sdk-e", box.id, "nube", 104);
      await a.api.resolverNombreCaja(uid, entry);
      const saved = (await ref.get()).data(); assert.equal(saved.syncFormat, 3); assert.deepEqual(saved.conversiones, {});
      assert.equal(saved.cajas[0].nombre, remoteName.nombre); assert.equal(saved.cajas[1].nombre, "Casa nueva");
      assert.deepEqual(saved.future, { preserved: true }); assert.deepEqual(saved.movimientos, initial.movimientos);
      await assert.rejects(a.api.resolverNombreCaja("otra-cuenta", { ...entry, uid: "otra-cuenta" }), /account-task-obsolete/);
    });
    await t.test("las reglas niegan resolver nombres sin Pro, sin cambiar la copia remota", async () => {
      await ref.set(nameRemote); await admin.doc(`users/${uid}`).update({ isPremium: false });
      const entry = a.api.prepararRevisionNombre(nameLocal, nameRemote, uid, "name-sdk-f", box.id, "local", 105);
      await assert.rejects(a.api.resolverNombreCaja(uid, entry), error => error.code === "permission-denied");
      assert.equal((await ref.get()).data().cajas[0].nombre, remoteName.nombre);
      await admin.doc(`users/${uid}`).update({ isPremium: true });
    });
    await t.test("archivo local ilegible no se sube; Gratis no lee la nube, pero puede borrar su copia", async () => {
      a.native.unreadable = true; assert.equal(await a.api.subirCajas(uid, combined), false); a.native.unreadable = false;
      await admin.doc(`users/${uid}`).update({ isPremium: false });
      await assert.rejects(getDocFromServer(doc(a.db, "cajas", uid)), error => error.code === "permission-denied");
      await deleteDoc(doc(a.db, "cajas", uid)); assert.equal((await ref.get()).exists, false);
    });
    await t.test("una revisión local pendiente bloquea respaldo Personal antiguo/v2 y Caja capturada antes, sin escrituras reales", async () => {
      const move = { ...row, personalTransactionId: 10 }, p = { id: 10, type: "expense", amount: 80, category: "otros", date: move.fecha, description: "Aporte", method: "transfer", notes: "", internalTransfer: "box", internalTransferLink: move.id, internalTransferSpaceId: box.id, updatedAt: 110 };
      const profile = { hasOnboarded: true, userName: "Prueba", userPhoto: null, userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, transactions: [{ ...p, amount: 100, updatedAt: 100 }], goals: [], isPremium: true, syncFormat: 2 };
      const source = { ...initial, movimientos: [move] };
      const entry = { id: "money-sdk-barrier-0001", uid, currency: "PEN", box, local: { personal: p, movement: move }, remote: { personal: profile.transactions[0], movement: move }, chosen: "local-personal", createdAt: 200, version: 200, estado: "pendiente" };
      await admin.doc(`users/${uid}`).set(profile); await ref.set(source);
      a.native.localCajas = { ...source, revisionesImporte: [entry] };
      const beforePersonal = await admin.doc(`users/${uid}`).get(), beforeBox = await ref.get();
      const result = await a.api.saveCloudData(uid, { ...profile, transactions: [p] });
      assert.equal(result.ok, false); assert.equal(result.motivo, "revision-caja-pendiente");
      assert.equal(await a.api.subirCajas(uid, source), false);
      await assert.rejects(a.api.saveHistoryV2(uid, [p], []), /review-pending/);
      await assert.rejects(a.api.loadHistoryV2(uid), /review-pending/);
      assert.equal((await admin.doc(`users/${uid}`).get()).updateTime.isEqual(beforePersonal.updateTime), true);
      assert.equal((await ref.get()).updateTime.isEqual(beforeBox.updateTime), true);
      assert.equal(a.native.localCajas.revisionesImporte[0].local.personal.amount, 80);
      a.native.localCajas = undefined;
    });
    await t.test("una confirmación SDK antigua no se aplica después de empezar a revisar; no bloquea otro dispositivo", async () => {
      const profile = { hasOnboarded: true, userName: "Prueba", userPhoto: null, userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, transactions: [], goals: [], isPremium: true, syncFormat: 2 };
      await admin.doc(`users/${uid}`).set(profile); await ref.set(initial);
      const saved = await a.api.saveCloudData(uid, profile); assert.equal(saved.ok, true);
      assert.equal(a.api.privateBoxCloudResponseCurrent(uid, saved.data), true);
      await a.api.withPrivateBoxMoneyReview(uid, async lease => { lease.assertCurrent(); });
      assert.equal(a.api.privateBoxCloudResponseCurrent(uid, saved.data), false);
      assert.equal((await b.api.saveCloudData(uid, profile)).ok, true, "la coordinación no concede un bloqueo remoto a otra cuenta/dispositivo");
      assert.equal((await a.api.saveCloudData(uid, profile)).ok, true);
    });
  } finally {
    for (const c of clients) { await terminate(c.db); await deleteApp(c.app); }
    await admin.terminate(); await deleteAdmin(adminApp);
  }
});

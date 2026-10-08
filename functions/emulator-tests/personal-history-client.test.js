"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const esbuild = require("../../node_modules/esbuild");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = require("firebase/firestore");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { deletePersonalCloudCopy } = require("../src/cloud-access");

const originRulesBaseline = process.env.FINO_TEST_MOVEMENT_ORIGIN_RULES_BASELINE;
if (originRulesBaseline && !/^[0-9a-f]{7,40}$/i.test(originRulesBaseline)) throw new Error("Hash Git no válido para reglas.");

async function clientModule(firestore, entry = "utils/cloudHistoryV2.ts", uid = "alice") {
  const root = path.resolve(__dirname, "../..");
  const result = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true, write: false, platform: "node", format: "cjs",
    external: ["firebase/firestore"],
    plugins: [{ name: "test-firebase", setup(build) {
      build.onResolve({ filter: /^@\/utils\/firebase$/ }, () => ({ path: "firebase", namespace: "test" }));
      build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const db = globalThis.__finoHistoryTestDb; export const auth = globalThis.__finoHistoryTestAuth;", loader: "js" }));
      // Este grupo comprueba la copia real de un cliente Pro en Firestore.
      // La API de permisos tiene sus propias pruebas y aquí se aísla el RPC.
      build.onResolve({ filter: /^@\/utils\/cloudAccountAccess$/ }, () => ({ path: "access", namespace: "test-access" }));
      build.onLoad({ filter: /.*/, namespace: "test-access" }, () => ({
        contents: `const db = globalThis.__finoHistoryTestDb;
        export async function getCloudAccountAccess(uid) {
          const { getDoc, doc } = require("firebase/firestore");
          const snapshot = await getDoc(doc(db, "users", uid));
          const data = snapshot.data() || {};
          return { uid, canSync: true, isPremium: data.isPremium === true, isTester: false,
            deletionPending: data.accountDeletionPending === true, hasCloudCopy: data.hasOnboarded === true,
            serverNow: Date.now() };
        }
        export async function deletePersonalCloudCopy() { throw new Error("UNUSED"); }`, loader: "js",
      }));
      // El respaldo real comprueba la lectura del teléfono. Esta prueba
      // usa datos válidos y aísla esa pieza nativa, no la lógica de nube.
      build.onResolve({ filter: /^@\/utils\/storage$/ }, () => ({ path: "storage", namespace: "test-storage" }));
      build.onLoad({ filter: /.*/, namespace: "test-storage" }, () => ({
        contents: "export const hasUnreadableLocalData = () => false; export const getAccountStorageSession=()=>1; export const STORAGE_KEYS={cajasDinero:'cajas'}; export const loadJSON=async(_key,fallback)=>fallback;", loader: "js",
      }));
      build.onResolve({ filter: /^@\/utils\/(cloudNegocio|cloudCajas|cloudFamilia|cloudCajasCompartidas|creditCloud)$/ },
        () => ({ path: "unused", namespace: "stub" }));
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: `export const borrarNegocioDeLaNube = async () => {};
          export const borrarCajasDeLaNube = async () => {};
          export const borrarVinculoFamiliaDeCuenta = async () => {};
          export const validarBorradoFamiliasDeCuenta = async () => {};
          export const borrarCajasCompartidasDeCuenta = async () => {};
          export const validarBorradoCajasCompartidasDeCuenta = async () => {};
          export const deleteCreditCloudAccount = async () => {};`, loader: "js",
      }));
      build.onResolve({ filter: /^@\// }, args => {
        const base = path.join(root, args.path.slice(2));
        return { path: fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx` };
      });
    } }],
  });
  globalThis.__finoHistoryTestDb = firestore;
  globalThis.__finoHistoryTestAuth = { currentUser: { uid } };
  const module = { exports: {} };
  const localRequire = createRequire(__filename);
  new Function("require", "module", "exports", result.outputFiles[0].text)(localRequire, module, module.exports);
  delete globalThis.__finoHistoryTestDb;
  delete globalThis.__finoHistoryTestAuth;
  return module.exports;
}

const movement = (id, updatedAt = id, amount = 10) => ({
  id, updatedAt, amount, type: "expense", category: "otros", date: "2026-09-27",
  method: "cash", description: `Movimiento ${id}`, notes: "",
});

test("orígenes distintos no reemplazan un movimiento al sincronizar ni por escritura directa", async t => {
  const env = await initializeTestEnvironment({ projectId: "demo-fino-origin-client", firestore: {
    host: "127.0.0.1", port: 8080,
    rules: originRulesBaseline
      ? require("node:child_process").execFileSync("git", ["show", `${originRulesBaseline}:firestore.rules`], { encoding: "utf8" })
      : fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
  } });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "users", "alice"), {
      historyFormat: 2, hasOnboarded: true, userName: "Alice", userPhoto: null,
      userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, goals: [], isPremium: true,
    }));
    const dbA = env.authenticatedContext("alice", { email_verified: true }).firestore();
    const dbB = env.authenticatedContext("alice", { email_verified: true }).firestore();
    const phoneA = await clientModule(dbA), phoneB = await clientModule(dbB);
    const original = { ...movement(100, 10), captureId: "aviso-A" };
    const other = { ...movement(100, 20, 20), captureId: "aviso-B" };
    const linked = { ...movement(101, 10), internalTransfer: "box", internalTransferLink: "aporte-A", internalTransferSpaceId: "caja-A" };
    const originalOther = JSON.stringify(other);
    await phoneA.saveHistoryV2("alice", [original, linked], []);
    await t.test("cliente v2 real conserva el original y devuelve conflicto", async () => {
      await assert.rejects(phoneB.saveHistoryV2("alice", [other], []), /record-origin-conflict/);
      assert.equal(JSON.stringify(other), originalOther, "el movimiento local B permanece intacto");
      assert.deepEqual((await getDoc(doc(dbB, "users", "alice", "history", "100"))).data().transaction, original);
    });
    await t.test("respaldo v1 real no escribe lista ni metadatos cuando hay conflicto", async () => {
      const owner = "v1-owner";
      const root = { hasOnboarded: true, userName: "Original", userPhoto: null,
        userCurrency: "PEN", userLanguage: "es", budgets: { "2026-10": 100 }, categoryBudgets: {},
        transactions: [original], goals: [], isPremium: true };
      await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "users", owner), root));
      const db = env.authenticatedContext(owner, { email_verified: true }).firestore();
      const phone = await clientModule(db, "utils/cloudSync.ts", owner);
      const local = { ...root, userName: "NO APLICAR", transactions: [other], budgets: { "2026-10": 200 } };
      const originalLocal = JSON.stringify(local);
      assert.deepEqual(await phone.saveCloudData(owner, local), { ok: false, motivo: "movimientos-en-conflicto" });
      assert.equal(JSON.stringify(local), originalLocal);
      assert.deepEqual((await getDoc(doc(db, "users", owner))).data(), root);
    });
    await t.test("reglas impiden cambiar o quitar la referencia de Yape", async () => {
      const row = doc(dbB, "users", "alice", "history", "100");
      await assertFails(setDoc(row, { id: 100, deleted: false, transaction: other, syncAt: serverTimestamp() }));
      const { captureId: _omitted, ...withoutOrigin } = other;
      void _omitted;
      await assertFails(setDoc(row, { id: 100, deleted: false, transaction: withoutOrigin, syncAt: serverTimestamp() }));
      assert.equal((await getDoc(row)).data().transaction.captureId, "aviso-A");
    });
    await t.test("reglas conservan las tres referencias del aporte", async () => {
      const row = doc(dbB, "users", "alice", "history", "101");
      for (const change of [
        { internalTransferLink: "aporte-B" }, { internalTransferSpaceId: "caja-B" }, { internalTransfer: "family" },
      ]) await assertFails(setDoc(row, { id: 101, deleted: false, transaction: { ...linked, ...change }, syncAt: serverTimestamp() }));
      const { internalTransferLink: _omitted, ...withoutLink } = linked;
      void _omitted;
      await assertFails(setDoc(row, { id: 101, deleted: false, transaction: withoutLink, syncAt: serverTimestamp() }));
      assert.deepEqual((await getDoc(row)).data().transaction, linked);
    });
    await t.test("manuales con identidad nueva rechazan colisión y quitar la identidad", async () => {
      const manual = { ...movement(104), creationId: "manual-A" };
      await phoneA.saveHistoryV2("alice", [manual], []);
      const row = doc(dbB, "users", "alice", "history", "104");
      await assert.rejects(phoneB.saveHistoryV2("alice", [{ ...manual, creationId: "manual-B", updatedAt: 300 }], []), /record-origin-conflict/);
      for (const transaction of [{ ...manual, creationId: "manual-B" }, movement(104)]) {
        await assertFails(setDoc(row, { id: 104, deleted: false, transaction, syncAt: serverTimestamp() }));
      }
      await phoneB.saveHistoryV2("alice", [{ ...manual, amount: 15, updatedAt: 300 }], []);
      assert.equal((await getDoc(row)).data().transaction.amount, 15);
    });
    await t.test("respaldo v1 conserva metas nuevas y exige formato de identidad a apps antiguas", async () => {
      const owner = "goal-owner", goal = { id: 200, creationId: "meta-A", name: "Meta", target: 100, saved: 0, createdDate: "2026-10-08", completed: false };
      const root = { hasOnboarded: true, userName: "Original", userPhoto: null, userCurrency: "PEN", userLanguage: "es",
        budgets: {}, categoryBudgets: {}, transactions: [], goals: [goal], isPremium: true, recordIdentityFormat: 1 };
      await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "users", owner), root));
      const db = env.authenticatedContext(owner, { email_verified: true }).firestore();
      const phone = await clientModule(db, "utils/cloudSync.ts", owner);
      assert.deepEqual(await phone.saveCloudData(owner, { ...root, goals: [{ ...goal, creationId: "meta-B" }] }), { ok: false, motivo: "movimientos-en-conflicto" });
      assert.deepEqual((await getDoc(doc(db, "users", owner))).data(), root);
      const { recordIdentityFormat: _omitted, ...oldClient } = root; void _omitted;
      await assertFails(setDoc(doc(db, "users", owner), { ...oldClient, goals: [{ ...goal, creationId: undefined }].map(({ creationId: _id, ...rest }) => { void _id; return rest; }) }));
      assert.equal((await phone.saveCloudData(owner, { ...root, goals: [{ ...goal, name: "Editada" }] })).ok, true);
      assert.equal((await getDoc(doc(db, "users", owner))).data().goals[0].creationId, "meta-A");
    });
    await t.test("mismo original puede editarse y borrarse; registros antiguos siguen legibles", async () => {
      await phoneB.saveHistoryV2("alice", [{ ...original, updatedAt: 30, amount: 15 }], []);
      assert.equal((await getDoc(doc(dbB, "users", "alice", "history", "100"))).data().transaction.amount, 15);
      await assertSucceeds(setDoc(doc(dbB, "users", "alice", "history", "102"), {
        id: 102, deleted: false, transaction: movement(102), syncAt: serverTimestamp(),
      }));
      const legacy = doc(dbB, "users", "alice", "history", "103");
      await assertSucceeds(setDoc(legacy, {
        id: 103, deleted: false, transaction: { ...movement(103), captureId: null, internalTransferLink: null }, syncAt: serverTimestamp(),
      }));
      await assertSucceeds(setDoc(legacy, {
        id: 103, deleted: false, transaction: movement(103, 200, 15), syncAt: serverTimestamp(),
      }));
      await phoneA.saveHistoryV2("alice", [], [100]);
      assert.equal((await getDoc(doc(dbB, "users", "alice", "history", "100"))).data().deleted, true);
    });
  } finally { await env.cleanup(); }
});

test("el respaldo v2 acepta más de 800 KB y restaura sin lista raíz", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-fino-large", firestore: {
      host: "127.0.0.1", port: 8080,
      rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "users", "large"), {
      historyFormat: 2, hasOnboarded: true, userName: "Large", userPhoto: null,
      userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, goals: [], isPremium: true,
    }));
    const db = env.authenticatedContext("large", { email_verified: true }).firestore();
    const cloud = await clientModule(db, "utils/cloudSync.ts", "large");
    const transactions = Array.from({ length: 105 }, (_, index) => ({
      ...movement(index + 1), notes: "x".repeat(8_000),
    }));
    assert.ok(Buffer.byteLength(JSON.stringify(transactions), "utf8") > 800_000);
    const payload = {
      hasOnboarded: true, userName: "Large", userPhoto: null, userCurrency: "PEN",
      userLanguage: "es", budgets: {}, categoryBudgets: {}, transactions,
      deletedTransactionIds: [], goals: [], isPremium: false,
    };
    const result = await cloud.saveCloudData("large", payload);
    assert.equal(result.ok, true, result.motivo);
    assert.equal((await cloud.loadCloudData("large")).transactions.length, 105);
    assert.equal((await getDoc(doc(db, "users", "large"))).data().transactions, undefined);
  } finally {
    await env.cleanup();
  }
});

test("10.000 movimientos se restauran y una edición escribe solo su documento", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-fino-volume", firestore: {
      host: "127.0.0.1", port: 8080,
      rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
  const app = initializeApp({ projectId: "demo-fino-volume" }, "history-volume-test");
  const admin = getFirestore(app);
  try {
    await env.clearFirestore();
    const root = admin.collection("users").doc("volume");
    await root.set({ historyFormat: 2, hasOnboarded: true, userName: "Volumen", userPhoto: null,
      userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, goals: [], isPremium: true });
    for (let start = 1; start <= 10_000; start += 200) {
      const batch = admin.batch();
      for (let id = start; id < Math.min(start + 200, 10_001); id++) {
        batch.set(root.collection("history").doc(String(id)), {
          id, deleted: false, transaction: movement(id), syncAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
    const db = env.authenticatedContext("volume", { email_verified: true }).firestore();
    const phone = await clientModule(db, "utils/cloudHistoryV2.ts", "volume");
    const restored = await phone.loadHistoryV2("volume");
    assert.equal(restored.transactions.length, 10_000);
    const edited = restored.transactions.map(item => item.id === 5_000 ? movement(5_000, 20_000, 99) : item);
    const after = await phone.saveHistoryV2("volume", edited, []);
    assert.equal(after.transactions.length, 10_000);
    assert.equal(after.transactions.find(item => item.id === 5_000).amount, 99);
    assert.equal((await root.collection("history").get()).size, 10_000);
  } finally {
    await env.cleanup();
    await deleteApp(app);
  }
});

test("dos teléfonos guardan, editan, borran y restauran historial v2", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-fino-client", firestore: {
      host: "127.0.0.1", port: 8080,
      rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "users", "alice"), {
      historyFormat: 2, hasOnboarded: true, userName: "Alice", userPhoto: null,
      userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, goals: [], isPremium: true,
    }));
    const dbA = env.authenticatedContext("alice", { email_verified: true }).firestore();
    const dbB = env.authenticatedContext("alice", { email_verified: true }).firestore();
    const phoneA = await clientModule(dbA);
    const phoneB = await clientModule(dbB);
    assert.deepEqual(await phoneA.loadHistoryV2("alice"), { transactions: [], deletedIds: [] });
    assert.deepEqual(await phoneB.loadHistoryV2("alice"), { transactions: [], deletedIds: [] });
    await phoneA.saveHistoryV2("alice", [movement(1)], []);
    await phoneB.saveHistoryV2("alice", [movement(2)], []);
    assert.equal((await phoneA.loadHistoryV2("alice")).transactions.length, 2);
    assert.equal((await phoneB.loadHistoryV2("alice")).transactions.length, 2);
    await phoneA.saveHistoryV2("alice", [movement(1, 10, 50), movement(2)], []);
    await phoneB.saveHistoryV2("alice", [movement(1), movement(2)], [1]);
    const restored = await phoneA.loadHistoryV2("alice");
    assert.deepEqual(restored.transactions.map(item => item.id), [2]);
    assert.deepEqual(restored.deletedIds, [1]);
    assert.equal((await getDoc(doc(dbB, "users", "alice"))).data().transactions, undefined,
      "la lista vieja no vuelve al documento principal");
    await updateDoc(doc(dbA, "users", "alice"), { accountDeletionPending: true });
    await assert.rejects(phoneA.deleteHistoryV2("alice"), error => error.code === "permission-denied",
      "el cliente no obtiene lectura gratis al marcar borrado");
    const cleanupApp = initializeApp({ projectId: "demo-fino-client" }, "history-cleanup-test");
    try { await deletePersonalCloudCopy(getFirestore(cleanupApp), "alice"); }
    finally { await deleteApp(cleanupApp); }
    phoneB.clearHistoryV2Cache("alice");
    await assert.rejects(phoneB.loadHistoryV2("alice"), error => error.code === "permission-denied",
      "una cuenta borrada ya no puede leer ni reconstruir el respaldo");
  } finally {
    await env.cleanup();
  }
});

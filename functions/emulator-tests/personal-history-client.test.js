"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const esbuild = require("../../node_modules/esbuild");
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc } = require("firebase/firestore");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

async function clientModule(firestore, entry = "utils/cloudHistoryV2.ts") {
  const root = path.resolve(__dirname, "../..");
  const result = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    bundle: true, write: false, platform: "node", format: "cjs",
    external: ["firebase/firestore"],
    plugins: [{ name: "test-firebase", setup(build) {
      build.onResolve({ filter: /^@\/utils\/firebase$/ }, () => ({ path: "firebase", namespace: "test" }));
      build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const db = globalThis.__finoHistoryTestDb;", loader: "js" }));
      // El respaldo real comprueba la lectura del teléfono. Esta prueba
      // usa datos válidos y aísla esa pieza nativa, no la lógica de nube.
      build.onResolve({ filter: /^@\/utils\/storage$/ }, () => ({ path: "storage", namespace: "test-storage" }));
      build.onLoad({ filter: /.*/, namespace: "test-storage" }, () => ({
        contents: "export const hasUnreadableLocalData = () => false;", loader: "js",
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
  const module = { exports: {} };
  const localRequire = createRequire(__filename);
  new Function("require", "module", "exports", result.outputFiles[0].text)(localRequire, module, module.exports);
  delete globalThis.__finoHistoryTestDb;
  return module.exports;
}

const movement = (id, updatedAt = id, amount = 10) => ({
  id, updatedAt, amount, type: "expense", category: "otros", date: "2026-09-27",
  method: "cash", description: `Movimiento ${id}`, notes: "",
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
      userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, goals: [], isPremium: false,
    }));
    const db = env.authenticatedContext("large", { email_verified: true }).firestore();
    const cloud = await clientModule(db, "utils/cloudSync.ts");
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
      userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, goals: [], isPremium: false });
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
    const phone = await clientModule(db);
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
      userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {}, goals: [], isPremium: false,
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
    await phoneA.deleteHistoryV2("alice");
    assert.deepEqual(await phoneB.loadHistoryV2("alice"), { transactions: [movement(2)], deletedIds: [1] },
      "la otra sesión conserva su caché hasta cerrar cuenta");
    phoneB.clearHistoryV2Cache("alice");
    assert.deepEqual(await phoneB.loadHistoryV2("alice"), { transactions: [], deletedIds: [] });
  } finally {
    await env.cleanup();
  }
});

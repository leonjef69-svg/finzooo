"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { deleteDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp } = require("firebase/firestore");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { migratePersonalHistory } = require("../src/personal-history-migration");

function rootData() {
  return {
    historyFormat: 2, hasOnboarded: true, userName: "Prueba", userPhoto: null,
    userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {},
    goals: [], isPremium: false,
  };
}

test("historial v2: acceso propio, bloqueo ajeno y cliente antiguo", async t => {
  const env = await initializeTestEnvironment({
    projectId: "demo-fino",
    firestore: {
      host: "127.0.0.1", port: 8080,
      rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
  try {
    await env.clearFirestore();
    const owner = env.authenticatedContext("alice", { email_verified: true }).firestore();
    const stranger = env.authenticatedContext("bob", { email_verified: true }).firestore();
    const unverified = env.authenticatedContext("alice", { email_verified: false }).firestore();
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "users", "alice"), rootData());
    });
    const row = doc(owner, "users", "alice", "history", "123");
    const content = { id: 123, deleted: false, transaction: { id: 123, amount: 20 }, syncAt: serverTimestamp() };
    await t.test("solo la cuenta verificada lee y escribe", async () => {
      await assertSucceeds(setDoc(row, content));
      assert.equal((await getDoc(row)).data().transaction.amount, 20);
      await assertFails(getDoc(doc(stranger, "users", "alice", "history", "123")));
      await assertFails(getDoc(doc(unverified, "users", "alice", "history", "123")));
    });
    await t.test("la lista antigua no puede borrar el marcador", async () => {
      const { historyFormat: _ignored, ...oldShape } = rootData();
      void _ignored;
      await assertFails(setDoc(doc(owner, "users", "alice"), { ...oldShape, transactions: [] }));
      await assertSucceeds(setDoc(doc(owner, "users", "alice"), rootData()));
      // Otra cuenta solo puede crear la suya: se usa otro contexto verificado.
      const legacyOwner = env.authenticatedContext("alice-legacy", { email_verified: true }).firestore();
      await assertSucceeds(setDoc(doc(legacyOwner, "users", "alice-legacy"),
        { ...oldShape, transactions: [] }));
      assert.equal((await getDoc(doc(legacyOwner, "users", "alice-legacy"))).data().historyFormat, undefined);
    });
    await t.test("una lápida no revive y el documento debe tener forma válida", async () => {
      await assertSucceeds(setDoc(row, { id: 123, deleted: true, syncAt: serverTimestamp() }));
      await assertFails(setDoc(row, content));
      await assertFails(setDoc(doc(owner, "users", "alice", "history", "124"),
        { id: 124, deleted: false, transaction: { id: 999 }, syncAt: serverTimestamp() }));
      await assertFails(setDoc(doc(stranger, "users", "alice", "history", "125"), content));
      await assertFails(setDoc(doc(owner, "users", "alice", "history", "otro-id"), content));
      await assertFails(deleteDoc(row));
    });
    await t.test("un borrado interrumpido queda marcado y se puede reintentar", async () => {
      await assertSucceeds(updateDoc(doc(owner, "users", "alice"), { accountDeletionPending: true }));
      await assertFails(setDoc(doc(owner, "users", "alice", "history", "126"),
        { id: 126, deleted: false, transaction: { id: 126 }, syncAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(owner, "users", "alice"), { userName: "No debe cambiar" }));
      await assertSucceeds(deleteDoc(row));
      await assertSucceeds(deleteDoc(doc(owner, "users", "alice")));
    });
  } finally {
    await env.cleanup();
  }
});

test("migración reanuda tras corte y conserva una edición concurrente", async () => {
  const app = initializeApp({ projectId: "demo-fino" }, "history-migration-test");
  const db = getFirestore(app);
  const root = db.collection("users").doc("migrating");
  const first = Array.from({ length: 425 }, (_, index) => ({
    id: index + 1, updatedAt: index + 1, amount: 10,
    type: "expense", date: "2026-09-27", category: "otros", method: "cash",
    description: `Movimiento ${index + 1}`,
  }));
  try {
    const { historyFormat: _format, ...legacyRoot } = rootData();
    void _format;
    await root.set({ ...legacyRoot, transactions: first, deletedTransactionIds: [5] });
    await assert.rejects(migratePersonalHistory(db, "migrating", {
      afterBatch: async batch => { if (batch === 0) throw new Error("SIMULATED_NETWORK_CUT"); },
    }), /SIMULATED_NETWORK_CUT/);
    assert.equal((await root.get()).data().transactions.length, 425,
      "un corte no retira la lista original");
    let edited = false;
    const result = await migratePersonalHistory(db, "migrating", {
      afterBatch: async batch => {
        if (batch !== 0 || edited) return;
        edited = true;
        await root.update({ transactions: [...first, {
          id: 426, updatedAt: 426, amount: 20, type: "income", date: "2026-09-27",
          category: "otro_ingreso", method: "cash", description: "Llegó durante copia",
        }] });
      },
    });
    assert.deepEqual(result, { alreadyMigrated: false, copied: 426 });
    const finalRoot = (await root.get()).data();
    assert.equal(finalRoot.historyFormat, 2);
    assert.equal("transactions" in finalRoot, false);
    const rows = await root.collection("history").get();
    assert.equal(rows.size, 426);
    assert.equal((await root.collection("history").doc("5").get()).data().deleted, true);
    assert.equal((await root.collection("history").doc("426").get()).data().transaction.amount, 20);
    assert.deepEqual(await migratePersonalHistory(db, "migrating"), { alreadyMigrated: true });
  } finally {
    await deleteApp(app);
  }
});

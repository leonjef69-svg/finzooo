"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } = require("firebase/firestore");

const baseline = process.env.FINO_TEST_MINIMUM_WRITER_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/i.test(baseline)) throw new Error("Hash Git no válido.");
const root = (historyFormat = 1) => ({
  hasOnboarded: true, userName: "Prueba", userPhoto: null, userCurrency: "PEN",
  userLanguage: "es", budgets: {}, categoryBudgets: {}, goals: [], isPremium: true,
  historyFormat, recordIdentityFormat: 2,
  ...(historyFormat === 1 ? { transactions: [], deletedTransactionIds: [] } : {}),
});
test("revisión 2: sustituciones antiguas no rebajan la copia; límite explícito sin attestation APK", async t => {
  const env = await initializeTestEnvironment({ projectId: "demo-fino-minimum-record-writer", firestore: {
    host: "127.0.0.1", port: 8080,
    rules: baseline ? execFileSync("git", ["show", `${baseline}:firestore.rules`], { encoding: "utf8" })
      : fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
  } });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(context => Promise.all([
      setDoc(doc(context.firestore(), "users", "owner"), root()),
      setDoc(doc(context.firestore(), "users", "history-owner"), root(2)),
      setDoc(doc(context.firestore(), "users", "legacy-history-owner"), { ...root(2), recordIdentityFormat: 1 }),
    ]));
    const db = env.authenticatedContext("owner", { email_verified: true }).firestore();
    const ref = doc(db, "users", "owner");
    await t.test("sustitución completa de revisión 1 rechazada", async () => {
      await assertFails(setDoc(ref, { ...root(), recordIdentityFormat: 1 }));
      assert.equal((await getDoc(ref)).data().recordIdentityFormat, 2);
    });
    await t.test("sustitución completa sin revisión rechazada", async () => {
      const old = root(); delete old.recordIdentityFormat;
      await assertFails(setDoc(ref, old));
      assert.equal((await getDoc(ref)).data().recordIdentityFormat, 2);
    });
    await t.test("sustitución nueva de revisión 2 confirmada", async () => {
      await assertSucceeds(setDoc(ref, { ...root(), userName: "Nueva", recordSyncAt: serverTimestamp() }));
      assert.equal((await getDoc(ref)).data().userName, "Nueva");
    });
    await t.test("revisión futura no aceptada ni degradada", async () => {
      await assertFails(setDoc(ref, { ...root(), recordIdentityFormat: 3 }));
      assert.equal((await getDoc(ref)).data().recordIdentityFormat, 2);
    });
    await t.test("límite: lectura y cambio parcial sin retirar revisión siguen posibles", async () => {
      await assertSucceeds(getDoc(ref));
      await assertSucceeds(updateDoc(ref, { userName: "Parcial" }));
      assert.equal((await getDoc(ref)).data().recordIdentityFormat, 2);
    });
    await t.test("cambio financiero parcial sin comprobación fresca rechazado", async () => {
      await assertFails(updateDoc(ref, { deletedTransactionIds: [123] }));
      await assertSucceeds(updateDoc(ref, { deletedTransactionIds: [123], recordSyncAt: serverTimestamp() }));
      assert.deepEqual((await getDoc(ref)).data().deletedTransactionIds, [123]);
    });
    const historyDb = env.authenticatedContext("history-owner", { email_verified: true }).firestore();
    const row = doc(historyDb, "users", "history-owner", "history", "123");
    const entry = { id: 123, deleted: false, transaction: { id: 123, creationId: "original", amount: 10 }, syncAt: serverTimestamp() };
    await t.test("fila sin revisión rechazada si su raíz ya es revisión 2", async () => {
      await assertFails(setDoc(row, entry));
      assert.equal((await getDoc(row)).exists(), false);
    });
    await t.test("fila de revisión 1 rechazada si raíz es revisión 2", async () => {
      await assertFails(setDoc(row, { ...entry, recordIdentityFormat: 1 }));
    });
    await t.test("fila de revisión 2 confirmada; rebaja posterior rechazada", async () => {
      await assertSucceeds(setDoc(row, { ...entry, recordIdentityFormat: 2, recordMutationAt: serverTimestamp() }));
      await assertFails(setDoc(row, { ...entry, recordIdentityFormat: 1 }));
      assert.equal((await getDoc(row)).data().recordIdentityFormat, 2);
    });
    await t.test("fila futura no reemplaza original confirmado", async () => {
      await assertFails(setDoc(row, { ...entry, recordIdentityFormat: 3 }));
      assert.equal((await getDoc(row)).data().transaction.creationId, "original");
    });
    await t.test("escritor v2 sella siempre aunque la raíz todavía sea v1", async () => {
      const legacyDb = env.authenticatedContext("legacy-history-owner", { email_verified: true }).firestore();
      const legacyRow = doc(legacyDb, "users", "legacy-history-owner", "history", "123");
      const next = { ...entry, recordIdentityFormat: 2 };
      await assertFails(setDoc(legacyRow, next), "sin fecha de operación no se acepta v2");
      await assertFails(setDoc(legacyRow, { ...next, recordMutationAt: Timestamp.fromMillis(1) }),
        "una fecha anterior no sustituye la confirmación del servidor");
      assert.equal((await getDoc(legacyRow)).exists(), false);
      await assertSucceeds(setDoc(legacyRow, { ...next, recordMutationAt: serverTimestamp() }));
      await assertFails(updateDoc(legacyRow, { syncAt: serverTimestamp(), recordMutationAt: Timestamp.fromMillis(1) }));
      assert.equal((await getDoc(legacyRow)).data().transaction.creationId, "original");
      const ordinaryOldRow = doc(legacyDb, "users", "legacy-history-owner", "history", "124");
      await assertSucceeds(setDoc(ordinaryOldRow, { ...entry, id: 124,
        transaction: { ...entry.transaction, id: 124 }, recordIdentityFormat: 1 }));
    });
  } finally { await env.cleanup(); }
});

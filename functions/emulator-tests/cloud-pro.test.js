"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp } = require("firebase/firestore");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getCloudAccess, deletePersonalCloudCopy } = require("../src/cloud-access");

test("Gratis/Pro: protección real de copias e historial sin bloquear el borrado administrativo", async t => {
  const env = await initializeTestEnvironment({ projectId: "demo-fino-pro", firestore: { host: "127.0.0.1", port: 8080,
    rules: process.env.FINO_TEST_BASELINE
      ? execFileSync("git", ["show", "HEAD:firestore.rules"], { encoding: "utf8", cwd: path.resolve(__dirname, "../..") })
      : fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") } });
  const app = initializeApp({ projectId: "demo-fino-pro" }, "cloud-pro-rules");
  const admin = getFirestore(app);
  const now = Date.now();
  const base = { hasOnboarded: true, isPremium: false, userName: "Fixture", userPhoto: null,
    userCurrency: "PEN", userLanguage: "es", budgets: { "2026-10": 1000 }, categoryBudgets: {}, goals: [], historyFormat: 2 };
  try {
    await env.clearFirestore();
    for (const uid of ["free", "paid", "tester", "trial", "expired", "future", "new-tester", "bad-tester"]) {
      if (uid !== "new-tester") await admin.doc(`users/${uid}`).set({ ...base, isPremium: uid === "paid",
        ...(uid === "trial" ? { premiumTrialStartedAt: now - 1000 } : {}),
        ...(uid === "expired" ? { premiumTrialStartedAt: now - 86_401_000 } : {}),
        ...(uid === "future" ? { premiumTrialStartedAt: now + 86_400_000 } : {}),
      });
      await admin.doc(`users/${uid}/history/1`).set({ id: 1, deleted: false, transaction: { id: 1, amount: 50 }, syncAt: Timestamp.now() });
      await admin.doc(`negocios/${uid}`).set({ movimientos: [{ monto: 50 }] });
      await admin.doc(`cajas/${uid}`).set({ movimientos: [{ monto: 50 }] });
    }
    for (const uid of ["tester", "new-tester"]) await admin.doc(`testerPremium/${uid}`).set({ active: true, grantedAt: Timestamp.now() });
    await admin.doc("testerPremium/bad-tester").set({ active: true });
    for (const uid of ["free", "expired", "future", "bad-tester"]) {
      await t.test(`${uid}: no lee ni escribe, tampoco usando la API directa`, async () => {
        const db = env.authenticatedContext(uid, { email_verified: true }).firestore();
        for (const collectionName of ["users", "negocios", "cajas"]) {
          await assertFails(getDoc(doc(db, collectionName, uid)));
          await assertFails(setDoc(doc(db, collectionName, uid), collectionName === "users" ? base : { datos: [] }));
        }
        await assertFails(getDocs(collection(db, "users", uid, "history")));
        await assertFails(setDoc(doc(db, "users", uid, "history", "2"), { id: 2, deleted: true, syncAt: serverTimestamp() }));
        await assertFails(setDoc(doc(db, "premiumTrialClaims", uid), { startedAt: now }));
        const status = await getCloudAccess(admin, uid);
        assert.equal(status.canSync, false);
        assert.equal("budgets" in status, false);
      });
    }
    for (const uid of ["paid", "tester", "trial"]) {
      await t.test(`${uid}: la concesión real sí permite respaldar`, async () => {
        const db = env.authenticatedContext(uid, { email_verified: true }).firestore();
        for (const collectionName of ["users", "negocios", "cajas"]) await assertSucceeds(getDoc(doc(db, collectionName, uid)));
        await assertSucceeds(setDoc(doc(db, "users", uid, "history", "2"), { id: 2, deleted: true, syncAt: serverTimestamp() }));
        assert.equal((await getCloudAccess(admin, uid)).canSync, true);
        const stranger = env.authenticatedContext("outsider", { email_verified: true }).firestore();
        await assertFails(getDoc(doc(stranger, "users", uid)));
      });
    }
    await t.test("un tester nuevo inicia su primera copia sin tener ya un documento", async () => {
      const db = env.authenticatedContext("new-tester", { email_verified: true }).firestore();
      const { historyFormat: _unused, ...legacy } = base;
      void _unused;
      await assertSucceeds(setDoc(doc(db, "users", "new-tester"), { ...legacy, transactions: [] }));
      await assertFails(updateDoc(doc(db, "users", "new-tester"), { isPremium: true }));
    });
    await t.test("Gratis borra por Admin sin recibir su historial ni tocar otra cuenta", async () => {
      const db = env.authenticatedContext("free", { email_verified: true }).firestore();
      await assertFails(deleteDoc(doc(db, "users", "free")));
      await assertSucceeds(deleteDoc(doc(db, "negocios", "free")));
      await assertSucceeds(deleteDoc(doc(db, "cajas", "free")));
      await deletePersonalCloudCopy(admin, "free");
      assert.equal((await admin.doc("users/free").get()).exists, false);
      assert.equal((await admin.collection("users/free/history").get()).empty, true);
      assert.equal((await admin.doc("users/paid").get()).exists, true);
      assert.equal((await admin.doc("premiumTrialClaims/free").get()).data().deletionPending, true);
    });
    await t.test("ni tester ni Pro pueden reabrir una eliminación que ya comenzó", async () => {
      await admin.doc("premiumTrialClaims/tester").set({ deletionPending: true });
      const db = env.authenticatedContext("tester", { email_verified: true }).firestore();
      await assertFails(getDoc(doc(db, "users", "tester")));
      await assertFails(setDoc(doc(db, "cajas", "tester"), {}));
    });
  } finally {
    await env.cleanup();
    await deleteApp(app);
  }
});

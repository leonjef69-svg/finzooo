"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { DOCUMENTS, acceptLegalDocuments, assertLegalAcceptance } = require("../src/legal-acceptance");
const input = (extra = {}) => ({ termsHash: DOCUMENTS.termsHash, privacyHash: DOCUMENTS.privacyHash, termsAccepted: true, privacyRead: true, ...extra });
function database() {
  const docs = new Map(), writes = [];
  const snapshot = ref => ({ exists: docs.has(ref.path), data: () => docs.get(ref.path) });
  const db = { docs, writes, doc: path => ({ path }), runTransaction: async work => {
    const changes = [];
    const tx = { get: async ref => snapshot(ref), getAll: async (...args) => args.filter(ref => ref.path).map(snapshot),
      set: (ref, data) => changes.push(() => { writes.push(ref.path); docs.set(ref.path, data); }) };
    const result = await work(tx); changes.forEach(change => change()); return result;
  } };
  return db;
}
test("aceptación válida propia y reintento preservan fecha, sin copiar perfil ni dinero", async () => {
  const db = database(); db.docs.set("users/A", { isPremium: false, transactions: [{ amount: 999 }] });
  const a = await acceptLegalDocuments(db, "A", input(), 1000);
  assert.deepEqual(a, { format: 1, uid: "A", ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt: 1000 });
  assert.deepEqual(await acceptLegalDocuments(db, "A", input(), 2000), a);
  assert.deepEqual(db.writes, ["legalAcceptances/A"]);
  assert.equal(db.docs.get("users/A").transactions[0].amount, 999);
});
test("rechaza cuerpos falsos, otra versión, UID elegido y cuenta en borrado", async () => {
  for (const bad of [null, [], input({ uid: "B" }), input({ acceptedAt: 1 }), input({ termsAccepted: false }), input({ privacyRead: false })]) {
    const db = database(); await assert.rejects(acceptLegalDocuments(db, "A", bad, 1000), /legal-invalid-request/); assert.equal(db.writes.length, 0);
  }
  for (const change of [{ termsHash: "f".repeat(64) }, { privacyHash: "f".repeat(64) }]) {
    const db = database(); await assert.rejects(acceptLegalDocuments(db, "A", input(change), 1000), /legal-version-changed/); assert.equal(db.writes.length, 0);
  }
  for (const [path, marker] of [["users/A", { accountDeletionPending: true }], ["premiumTrialClaims/A", { deletionPending: true }], ["reportRateLimits/A", { closed: true }]]) {
    const db = database(); db.docs.set(path, marker);
    await assert.rejects(acceptLegalDocuments(db, "A", input(), 1000), /legal-account-closing/); assert.equal(db.writes.length, 0);
  }
});
test("la barrera del servidor no confía en ausencia, fecha futura ni aceptación ajena", async () => {
  const db = database(); await assert.rejects(db.runTransaction(tx => assertLegalAcceptance(tx, db, "A")), /legal-acceptance-required/);
  const receipt = await acceptLegalDocuments(db, "A", input(), 1000);
  for (const change of [{ uid: "B" }, { acceptedAt: Date.now() + 100000 }, { version: "old" }, { termsAccepted: false }, { format: 2 }]) {
    db.docs.set("legalAcceptances/A", { ...receipt, ...change });
    await assert.rejects(db.runTransaction(tx => assertLegalAcceptance(tx, db, "A")), /legal-acceptance-required/);
  }
  db.docs.set("legalAcceptances/A", receipt); await db.runTransaction(tx => assertLegalAcceptance(tx, db, "A"));
  db.docs.set("reportRateLimits/A", { closed: true });
  await assert.rejects(db.runTransaction(tx => assertLegalAcceptance(tx, db, "A")), /legal-account-closing/);
});

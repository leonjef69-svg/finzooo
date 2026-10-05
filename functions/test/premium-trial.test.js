"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { activatePremiumTrial } = require("../src/premium-trial");

function fakeDb(data) {
  const writes = [];
  const documents = new Map([["users/alice", data]]);
  return {
    writes, documents,
    doc: path => ({ path }),
    runTransaction: async work => work({
      get: async ref => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) }),
      update: (ref, patch) => { writes.push({ path: ref.path, patch }); Object.assign(documents.get(ref.path), patch); },
      set: (ref, patch) => { writes.push({ path: ref.path, patch }); documents.set(ref.path, { ...patch }); },
    }),
  };
}

test("el servidor activa la prueba una sola vez", async () => {
  const db = fakeDb({ hasOnboarded: true });
  assert.deepEqual(await activatePremiumTrial(db, "alice", 1_000), {
    activated: true, startedAt: 1_000,
  });
  assert.deepEqual(await activatePremiumTrial(db, "alice", 2_000), {
    activated: false, startedAt: 1_000,
  });
  assert.deepEqual(db.writes, [{ path: "premiumTrialClaims/alice", patch: { startedAt: 1_000 } },
    { path: "users/alice", patch: { premiumTrialStartedAt: 1_000 } }]);
});

test("la cuenta configurada solo en el teléfono puede probar Pro sin subir datos", async () => {
  const db = fakeDb({ hasOnboarded: false });
  db.documents.clear();
  assert.deepEqual(await activatePremiumTrial(db, "alice", 1_000, { hasLocalSetup: true }), { activated: true, startedAt: 1_000 });
  assert.deepEqual(db.documents.get("users/alice"), { hasOnboarded: false, isPremium: false, premiumTrialStartedAt: 1_000 });
  db.documents.delete("users/alice");
  assert.deepEqual(await activatePremiumTrial(db, "alice", 5_000, { hasLocalSetup: true }), { activated: false, startedAt: 1_000 },
    "borrar la copia no inicia otras 24 horas");
});

test("la prueba no reabre una cuenta que se está eliminando", async () => {
  const db = fakeDb({ hasOnboarded: true });
  db.documents.set("premiumTrialClaims/alice", { startedAt: 1000, deletionPending: true });
  await assert.rejects(activatePremiumTrial(db, "alice", 5_000, { hasLocalSetup: true }), /ACCOUNT_DELETING/);
  assert.deepEqual(db.writes, []);
});
test("no crea una prueba para una cuenta inexistente o incompleta", async () => {
  const db = fakeDb({ hasOnboarded: false });
  await assert.rejects(activatePremiumTrial(db, "alice", 1_000), /ACCOUNT_NOT_READY/);
  assert.deepEqual(db.writes, []);
});


"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { activatePremiumTrial } = require("../src/premium-trial");

function fakeDb(data) {
  const writes = [];
  const ref = { path: "users/alice" };
  return {
    writes,
    doc: path => ({ ...ref, path }),
    runTransaction: async work => work({
      get: async () => ({ exists: true, data: () => data }),
      update: (_ref, patch) => { writes.push(patch); Object.assign(data, patch); },
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
  assert.deepEqual(db.writes, [{ premiumTrialStartedAt: 1_000 }]);
});
test("no crea una prueba para una cuenta inexistente o incompleta", async () => {
  const db = fakeDb({ hasOnboarded: false });
  await assert.rejects(activatePremiumTrial(db, "alice", 1_000), /ACCOUNT_NOT_READY/);
  assert.deepEqual(db.writes, []);
});


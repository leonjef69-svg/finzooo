"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { premium } = require("../src/premium-entitlement");

test("tester Premium es independiente del Premium comprado", () => {
  assert.equal(premium({ isPremium: false }, Date.now(), { active: true }), true);
  assert.equal(premium({ isPremium: false }, Date.now(), { active: false }), false);
  assert.equal(premium({ isPremium: true }, Date.now(), { active: false }), true);
});

test("una prueba con fecha futura nunca concede Premium", () => {
  const now = Date.now();
  assert.equal(premium({ isPremium: false, premiumTrialStartedAt: now + 86_400_000 }, now), false);
  assert.equal(premium({ isPremium: false, premiumTrialStartedAt: now - 1_000 }, now), true);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { premium } = require("../src/premium-entitlement");

test("tester Premium es independiente del Premium comprado", () => {
  assert.equal(premium({ isPremium: false }, Date.now(), { active: true }), true);
  assert.equal(premium({ isPremium: false }, Date.now(), { active: false }), false);
  assert.equal(premium({ isPremium: true }, Date.now(), { active: false }), true);
});

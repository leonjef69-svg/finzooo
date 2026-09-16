import assert from "node:assert/strict";
import fs from "node:fs";

const rules = fs.readFileSync("firestore.rules", "utf8");
const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const cloud = fs.readFileSync("utils/cloudSync.ts", "utf8");

assert.match(rules, /match \/testerPremium\/\{userId\}/);
assert.match(rules, /allow create, update, delete: if false;/);
assert.match(rules, /request\.auth\.uid == userId/);
assert.match(rules, /\|\| testerPremiumUser\(userId\)/);
assert.match(context, /subscribeTesterPremium\(uid, setTesterPremium\)/);
assert.match(context, /isPremiumDeLaCuenta \|\| pruebaCorriendo \|\| testerPremium\.active/);
assert.doesNotMatch(cloud, /testerPremium|isTesterPremium/,
  "La concesión administrativa no debe viajar en el respaldo editable del usuario");

console.log("Premium de tester: reglas, separación y bloqueo de escritura OK");

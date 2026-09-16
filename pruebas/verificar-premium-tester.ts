import assert from "node:assert/strict";
import { testerPremiumFromData } from "../utils/testerPremiumState";

const ahora = Date.now();
const activo = testerPremiumFromData({ active: true, grantedAt: { toMillis: () => ahora }, grantedBy: "Firebase" });
assert.equal(activo.active, true);
assert.equal(activo.grantedAt, ahora);
assert.equal(activo.grantedBy, "Firebase");

assert.equal(testerPremiumFromData({ active: true, grantedAt: ahora }, true).active, false,
  "La caché local no puede conservar una concesión retirada");
assert.equal(testerPremiumFromData({ active: true }).active, false,
  "Una concesión activa debe registrar cuándo se otorgó");
assert.equal(testerPremiumFromData({ active: false, grantedAt: ahora }).active, false);

console.log("Premium de tester: concesión, revocación y caché seguras OK");

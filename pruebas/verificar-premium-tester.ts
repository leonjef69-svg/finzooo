import assert from "node:assert/strict";
import { testerPremiumFromData } from "../utils/testerPremiumState";

const ahora = Date.now();
const activo = testerPremiumFromData({ active: true, grantedAt: { toMillis: () => ahora }, grantedBy: "Firebase" });
assert.equal(activo.active, true);
assert.equal(activo.grantedAt, ahora);
assert.equal(activo.grantedBy, "Firebase");

const cache = testerPremiumFromData({ active: true, grantedAt: ahora }, true);
assert.equal(cache.active, false,
  "La caché local no puede conservar una concesión retirada");
assert.equal(cache.pendingVerification, true,
  "Sin conexión debe explicar que el permiso está pendiente de comprobarse");
assert.equal(testerPremiumFromData({ active: true }).active, false,
  "Una concesión activa debe registrar cuándo se otorgó");
assert.equal(testerPremiumFromData({ active: false, grantedAt: ahora }).active, false);
assert.equal(testerPremiumFromData({ active: false, grantedAt: ahora }).pendingVerification, false);

console.log("Premium de tester: concesión, revocación y caché seguras OK");

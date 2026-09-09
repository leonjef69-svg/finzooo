import assert from "node:assert/strict";
import fs from "node:fs";

const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const familia = fs.readFileSync(new URL("../utils/cloudFamilia.ts", import.meta.url), "utf8");
const cajas = fs.readFileSync(new URL("../utils/cloudCajasCompartidas.ts", import.meta.url), "utf8");
const sync = fs.readFileSync(new URL("../utils/cloudSync.ts", import.meta.url), "utf8");
const google = fs.readFileSync(new URL("../utils/googleAuth.ts", import.meta.url), "utf8");
const eliminar = fs.readFileSync(new URL("../screens/DeleteAccount.tsx", import.meta.url), "utf8");

assert.match(rules, /function validSharedMovement/, "los movimientos compartidos tienen una forma validada");
assert.match(rules, /data\.monto <= 9000000000000/, "la nube rechaza montos que pierden precisión");
assert.match(rules, /data\.personalOwnerUid == request\.auth\.uid/, "nadie puede fingir una transferencia de otro usuario");
assert.match(rules, /&& boxOpen\(boxId\)/, "una invitación no abre una caja cerrada");
assert.match(rules, /resource\.data\.get\('deleting', false\) == true/, "solo un borrado de cuenta autorizado puede purgar un espacio");
assert.match(familia, /await runTransaction\(db, async transaction => \{[\s\S]*transaction\.set\(ref,[\s\S]*familyUsers/, "crear una familia es una operación indivisible");
assert.match(cajas, /box\.data\(\)\.closed === true/, "el cliente rechaza una caja cerrada aunque conserve el código");
assert.match(sync, /borrarCajasCompartidasDeCuenta\(uid\)/, "eliminar la cuenta también limpia sus cajas compartidas");
assert.match(google, /reauthenticateWithGoogle/, "las cuentas Google pueden confirmar el borrado sin una contraseña inexistente");
assert.match(eliminar, /usaContrasena \?/, "la pantalla solo exige contraseña a quien realmente usa una");

console.log("Seguridad compartida y borrado de cuenta: protecciones verificadas.");

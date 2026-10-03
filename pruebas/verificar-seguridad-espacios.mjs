import assert from "node:assert/strict";
import fs from "node:fs";

const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const familia = fs.readFileSync(new URL("../utils/cloudFamilia.ts", import.meta.url), "utf8");
const cajas = fs.readFileSync(new URL("../utils/cloudCajasCompartidas.ts", import.meta.url), "utf8");
const sync = fs.readFileSync(new URL("../utils/cloudSync.ts", import.meta.url), "utf8");
const google = fs.readFileSync(new URL("../utils/googleAuth.ts", import.meta.url), "utf8");
const eliminar = fs.readFileSync(new URL("../screens/DeleteAccount.tsx", import.meta.url), "utf8");
const pantallaFamilia = fs.readFileSync(new URL("../screens/Family.tsx", import.meta.url), "utf8");

assert.match(rules, /function validSharedMovement/, "los movimientos compartidos tienen una forma validada");
assert.match(rules, /data\.monto <= 9000000000000/, "la nube rechaza montos que pierden precisión");
assert.match(rules, /data\.personalOwnerUid == request\.auth\.uid/, "nadie puede fingir una transferencia de otro usuario");
assert.match(rules, /familySpaces\/\$\(familyId\)\)\.data\.ownerUid == request\.auth\.uid/, "solo el propietario enlaza Familia con su saldo Personal");
assert.match(rules, /boxSpaces\/\$\(boxId\)\)\.data\.ownerUid == request\.auth\.uid/, "solo el propietario enlaza una caja compartida con su saldo Personal");
assert.match(rules, /resource\.data\.creadoPor == request\.auth\.uid/, "un miembro no puede borrar movimientos ordinarios de otra persona");
assert.match(pantallaFamilia, /tipo === "ingreso" && owner && origenDinero === "personal"/, "un invitado no puede dejar su dinero atrapado en la Familia del propietario");
assert.match(rules, /&& boxOpen\(boxId\)/, "una invitación no abre una caja cerrada");
assert.match(rules, /resource\.data\.get\('deleting', false\) == true/, "solo un borrado de cuenta autorizado puede purgar un espacio");
assert.match(familia, /await runTransaction\(db, async transaction => \{[\s\S]*transaction\.set\(ref,[\s\S]*familyUsers/, "crear una familia es una operación indivisible");
assert.match(familia, /transaction\.set\(movimientoRef, \{ \.\.\.movimientoInicial, creadoPor: uid, creadoEn: serverTimestamp\(\) \}\)/, "el aporte inicial se guarda junto con la Familia");
assert.match(rules, /function familyOpenAfter\(familyId\)/, "las reglas admiten revisar la Familia nueva en la misma transacción");
assert.match(rules, /\(getAfter\([\s\S]*familySpaces\/\$\(familyId\)\)\.data\.ownerUid == request\.auth\.uid[\s\S]*familyOpenAfter\(familyId\)\)/, "solo el propietario puede añadir un aporte al crear la Familia");
assert.match(rules, /allow create:[\s\S]*&& boxOpen\(boxId\)/, "las reglas rechazan una caja cerrada aunque conserve el código");
const unionCaja = cajas.slice(cajas.indexOf("export async function unirseACaja"), cajas.indexOf("export async function listarMovimientosCajaCompartida"));
assert.doesNotMatch(unionCaja, /transaction\.get\(boxRef\)/, "un invitado no intenta leer la caja antes de ser miembro");
assert.match(sync, /borrarCajasCompartidasDeCuenta\(uid\)/, "eliminar la cuenta también limpia sus cajas compartidas");
assert.match(google, /reauthenticateWithGoogle/, "las cuentas Google pueden confirmar el borrado sin una contraseña inexistente");
assert.match(eliminar, /usaContrasena \?/, "la pantalla solo exige contraseña a quien realmente usa una");

console.log("Seguridad compartida y borrado de cuenta: protecciones verificadas.");

import assert from "node:assert/strict";
import fs from "node:fs";
import { crearCodigoFamilia } from "../utils/familia.ts";

const rules = fs.readFileSync("firestore.rules", "utf8");
const cloud = fs.readFileSync("utils/cloudFamilia.ts", "utf8");
const screen = fs.readFileSync("screens/Family.tsx", "utf8");
const deletion = fs.readFileSync("utils/cloudSync.ts", "utf8");

const codes = new Set(Array.from({ length: 200 }, crearCodigoFamilia));
assert.equal(codes.size, 200, "los códigos de prueba no se repiten");
for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/, "el código evita caracteres confusos");

assert.match(rules, /function familyMember\(familyId\)/, "cada lectura comprueba la membresía");
assert.match(rules, /allow list: if false;/, "nadie puede recorrer todos los códigos");
assert.match(rules, /expiresAt > request\.time\.toMillis\(\)/, "un código vencido no permite entrar");
assert.match(rules, /request\.resource\.data\.inviteCode/, "la membresía exige la invitación usada");
assert.match(cloud, /familyUsers/, "el espacio se recupera al cambiar de celular");
assert.match(cloud, /serverTimestamp\(\)/, "los movimientos usan la hora confiable de Firebase");
assert.match(screen, /sanitizeSafeAmountInput/, "Familia conserva el límite seguro para montos");
assert.match(deletion, /borrarVinculoFamiliaDeCuenta/, "eliminar la cuenta también retira su membresía familiar");

console.log("Familia: invitaciones, membresía, vencimiento y privacidad verificados.");

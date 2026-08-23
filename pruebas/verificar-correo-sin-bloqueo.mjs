import fs from "node:fs";
import assert from "node:assert/strict";

const route = fs.readFileSync("app/verify-email.tsx", "utf8");
const screen = fs.readFileSync("screens/VerifyEmail.tsx", "utf8");
const translations = fs.readFileSync("constants/i18n.ts", "utf8");

assert.match(route, /withTimeout/);
assert.match(screen, /verifyEmail\.spamHint/);
assert.match(translations, /"verifyEmail\.spamHint"/);

console.log("✓ Verificar correo tiene límite de espera y explica revisar Spam.");

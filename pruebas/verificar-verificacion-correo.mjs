import fs from "node:fs";
import assert from "node:assert/strict";

const screen = fs.readFileSync("screens/VerifyEmail.tsx", "utf8");
const translations = fs.readFileSync("constants/i18n.ts", "utf8");

// Si Firebase falla, la pantalla debe devolver el control. Antes un rechazo
// dejaba `checking` o `resending` en true para siempre.
for (const handler of ["handleCheck", "handleResend"]) {
  const start = screen.indexOf(`async function ${handler}`);
  const end = screen.indexOf("\n  return (", start);
  const body = screen.slice(start, end);
  assert.ok(body.includes("try {"), `${handler} debe intentar la operación de forma segura`);
  assert.ok(body.includes("catch {"), `${handler} debe mostrar un resultado si Firebase falla`);
  assert.ok(body.includes("finally {"), `${handler} debe terminar su indicador de carga siempre`);
}

assert.match(screen, /disabled=\{checking \|\| resending\}/);
assert.match(translations, /"verifyEmail\.checkFailed"/);
assert.match(translations, /"verifyEmail\.resendFailed"/);

console.log("✓ La verificación del correo nunca queda cargando para siempre.");

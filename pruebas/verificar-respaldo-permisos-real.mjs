import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_BACKUP_PERMISSION_BASELINE || "" });
const tree = ts.createSourceFile("Settings.tsx", read("screens/Settings.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "t" && node.arguments[0]?.getText(tree).includes('"settings.backupNoPermission"')) {
    assert.equal(expression, undefined, "un único mensaje de fallo de respaldo original");
    expression = node.arguments[0].getText(tree);
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(expression, "selección original de Ajustes");
const key = (failure, currentUser) => vm.runInNewContext(expression, { respaldoFallo: failure, auth: { currentUser } });
assert.equal(key("permisos", { emailVerified: true }), "settings.backupPermissionDenied", "Google/correo confirmado: no pedir una confirmación que ya existe");
assert.equal(key("permisos", { emailVerified: false }), "settings.backupNoPermission", "correo explícitamente no confirmado: conservar su instrucción");
assert.equal(key("permisos", null), "settings.backupPermissionDenied", "sesión desconocida no demuestra correo sin confirmar");
for (const [failure, expected] of [
  ["sin-internet", "settings.backupNoInternet"], ["demasiado-grande", "settings.backupTooLarge"],
  ["datos-nube-invalidos", "settings.backupInvalid"], ["monedas-distintas", "settings.backupCurrencyConflict"],
  ["movimientos-en-conflicto", "settings.backupMovementConflict"], ["actualizacion-necesaria", "settings.backupUpdateRequired"],
  ["revision-caja-pendiente", "settings.backupBoxReview"], [null, "settings.backupFailedHint"],
]) assert.equal(key(failure, { emailVerified: true }), expected, `conserva el mensaje de ${failure}`);
const messages = [...read("constants/i18n.ts").matchAll(/"settings\.backupPermissionDenied":\s*"([^"]+)"/g)].map(match => match[1]);
assert.equal(messages.length, 3, "explicación disponible en los tres idiomas");
for (const message of messages) assert.ok(/phone|celular/.test(message) && /suporte|support|soporte/.test(message), "explica conservación local y pide ayuda sin prometer éxito");
console.log("Respaldo: Ajustes original distingue correo no confirmado de rechazo con correo confirmado; demás motivos y tres idiomas conservados. No prueba publicación ni respaldo real.");

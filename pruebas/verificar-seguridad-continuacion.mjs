import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";

// Ejecuta las funciones reales aislando solo almacenamiento/autenticación.
const read = p => process.env.FINO_TEST_BASELINE
  ? execFileSync("git", ["show", `HEAD:${p}`], { encoding: "utf8" })
  : fs.readFileSync(p, "utf8");
const source = ts.createSourceFile("context.tsx", read("contexts/AppDataContext.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function code(name) {
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, name);
  return ts.transpile(found.getText(source), { target: ts.ScriptTarget.ES2022 });
}
for (const failure of [{ ok: false, motivo: "sin-red" }, { ok: false, motivo: "demasiado-grande" }]) {
  const calls = [];
  const scope = { uid: "test", isPremium: true, hasUnreadableLocalData: () => false, datosParaLaNube: () => ({}), saveCloudData: async () => failure,
    signOutFromGoogle: async () => calls.push("google"), signOut: async () => calls.push("auth"),
    auth: {}, clearAccountData: async () => calls.push("clear") };
  vm.createContext(scope);
  vm.runInContext(code("logout"), scope);
  await assert.rejects(scope.logout(), error => error.name === "BackupBeforeLogoutError");
  assert.deepEqual(calls, [], "un respaldo fallido no permite cerrar ni borrar");
}
{
  const calls = [];
  const scope = {
    uid: "test",
    isPremium: true,
    hasUnreadableLocalData: () => false,
    datosParaLaNube: () => ({}),
    saveCloudData: async () => { calls.push("backup"); return { ok: false, motivo: "sin-internet" }; },
    signOutFromGoogle: async () => calls.push("google"),
    signOut: async () => { calls.push("auth"); throw new Error("STOP"); },
    auth: {},
  };
  vm.createContext(scope);
  vm.runInContext(code("logout"), scope);
  await assert.rejects(scope.logout({ skipBackup: true }), /STOP/);
  assert.deepEqual(calls, ["google", "auth"], "solo la salida expresamente autorizada omite el respaldo");
}
{
  const calls = [];
  const scope = {
    uid: "test",
    isPremium: false,
    hasUnreadableLocalData: () => false,
    datosParaLaNube: () => ({}),
    saveCloudData: async () => { calls.push("backup"); return { ok: true }; },
    signOutFromGoogle: async () => calls.push("google"),
    signOut: async () => { calls.push("auth"); throw new Error("STOP"); },
    auth: {},
  };
  vm.createContext(scope);
  vm.runInContext(code("logout"), scope);
  await assert.rejects(scope.logout(), /STOP/);
  assert.deepEqual(calls, ["google", "auth"], "Gratis cierra sesión sin escribir una copia nueva en la nube");
}
{
  const calls = [];
  const scope = {
    hasUnreadableLocalData: () => true,
    tRef: { current: () => "datos-ilegibles" },
    signOutFromGoogle: async () => calls.push("google"),
    signOut: async () => calls.push("auth"),
    auth: {},
  };
  vm.createContext(scope);
  vm.runInContext(code("logout"), scope);
  await assert.rejects(scope.logout(), /datos-ilegibles/);
  assert.deepEqual(calls, [], "una lectura dañada nunca desencadena cierre ni borrado local");
}
const settings = read("app/(tabs)/settings.tsx");
assert.match(settings, /BackupBeforeLogoutError/);
assert.match(settings, /skipBackup:\s*true/);
assert.match(settings, /secondConfirmation|confirmacionFinal/);
for (const [name, args] of [["addOrUpdateGoal", [{}]], ["deleteGoal", [1]], ["addMoneyToGoal", [20, 1]], ["withdrawMoneyFromGoal", [1, 20]]]) {
  const scope = { isPremium: false };
  vm.createContext(scope);
  vm.runInContext(code(name), scope);
  // Sin Premium debe salir antes de leer o mutar metas, aunque se invoque directamente.
  assert.doesNotThrow(() => scope[name](...args));
}
const rules = read("firestore.rules");
for (const collection of ["familyInvites", "boxInvites"]) {
  const block = rules.split(`match /${collection}/{code} {`)[1].split("\n    }")[0];
  assert.match(block, /allow update: if false;/);
  assert.doesNotMatch(block, /allow update, delete/);
}
assert.match(rules, /familyOwnerPremiumAfter\(familyId\)/);
assert.match(rules, /boxOwnerPremiumAfter\(boxId\)/);
assert.match(rules, /country', 'timeZone'/);

const appConfig = JSON.parse(read("app.json"));
assert.equal(appConfig.expo.orientation, "default");
assert.equal(appConfig.expo.updates.requestHeaders["expo-channel-name"], "production");
assert.match(appConfig.expo.ios.infoPlist.NSMicrophoneUsageDescription, /dictas un movimiento/i);

const sentry = read("utils/sentry.ts");
assert.match(sentry, /sendDefaultPii:\s*false/);
assert.match(sentry, /delete event\.user/);
assert.match(sentry, /delete event\.request/);

const privacy = read("docs/privacidad.html");
assert.match(privacy, /Telegram/);
assert.match(privacy, /Sentry/);
assert.match(privacy, /Familia y Cajas/);

const importRoute = read("app/import.tsx");
const layout = read("app/_layout.tsx");
assert.match(importRoute, /usePendingImport\(\)/);
assert.doesNotMatch(importRoute, /useLocalSearchParams/);
assert.match(layout, /irUnaVez\("\/import"\)/);
assert.doesNotMatch(layout, /pathname:\s*"\/import"\s*,\s*params:\s*\{\s*uri:\s*file\.uri/);

const localCleanup = code("limpiarCuentaEnEsteDispositivo");
for (const cleanup of [
  "cancelarProgramacionAlCerrarSesion()",
  "desconectarDropbox()",
  "desconectarOneDrive()",
  "disableLock()",
  "notificationReader.clear()",
  "clearCreditNotifications",
  "clearAccountData()",
]) assert.ok(localCleanup.includes(cleanup), `la limpieza común incluye ${cleanup}`);
const logout = code("logout");
const deleteAccount = code("deleteAccount");
assert.match(logout, /limpiarCuentaEnEsteDispositivo\(uid\)/);
assert.match(deleteAccount, /deleteUser\(user\)[\s\S]*?limpiarCuentaEnEsteDispositivo\(user\.uid\)/);

console.log("Respaldo fallido conserva datos; metas e invitaciones protegidas; espacios Premium, configuración y privacidad verificados.");

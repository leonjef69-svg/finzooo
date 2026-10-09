import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Ejecuta las funciones reales aislando solo almacenamiento/autenticación.
const read = createSourceReader();
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
function logoutScope() {
  return {
    getAccountStorageSession: () => 1,
    auth: { currentUser: { uid: "test", email: "test@example.com" } },
    setReady() {}, setHasOnboarded() {},
    captureBusy: { current: false },
    notificationReader: { isEnabled: () => false, setEnabled() {} },
    openLocalAccount: async () => true,
    resumeLocalAccount: async () => undefined,
    hasOnboarded: true,
    localSessionVersion: { current: 0 },
    archiveLocalAccount: async () => undefined,
    LocalAccountVaultError: class extends Error {},
    tRef: { current: (key) => key },
  };
}
for (const failure of [{ ok: false, motivo: "sin-red" }, { ok: false, motivo: "demasiado-grande" }]) {
  const calls = [];
  const scope = { ...logoutScope(), uid: "test", isPremium: true, hasUnreadableLocalData: () => false, datosParaLaNube: () => ({}), saveCloudData: async () => failure,
    signOutFromGoogle: async () => calls.push("google"), signOut: async () => calls.push("auth"),
    clearAccountData: async () => calls.push("clear") };
  vm.createContext(scope);
  vm.runInContext(code("logout"), scope);
  await assert.rejects(scope.logout(), error => error.name === "BackupBeforeLogoutError");
  assert.deepEqual(calls, [], "un respaldo fallido no permite cerrar ni borrar");
}
{
  const calls = [];
  const scope = {
    ...logoutScope(),
    uid: "test",
    isPremium: true,
    hasUnreadableLocalData: () => false,
    datosParaLaNube: () => ({}),
    saveCloudData: async () => { calls.push("backup"); return { ok: false, motivo: "sin-internet" }; },
    signOutFromGoogle: async () => calls.push("google"),
    signOut: async () => { calls.push("auth"); throw new Error("STOP"); },
  };
  vm.createContext(scope);
  vm.runInContext(code("logout"), scope);
  await assert.rejects(scope.logout({ skipBackup: true }), /STOP/);
  assert.deepEqual(calls, ["google", "auth"], "solo la salida expresamente autorizada omite el respaldo");
}
{
  const calls = [];
  const scope = {
    ...logoutScope(),
    uid: "test",
    isPremium: false,
    hasUnreadableLocalData: () => false,
    datosParaLaNube: () => ({}),
    saveCloudData: async () => { calls.push("backup"); return { ok: true }; },
    signOutFromGoogle: async () => calls.push("google"),
    signOut: async () => { calls.push("auth"); throw new Error("STOP"); },
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
    getAccountStorageSession: () => 1,
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
{
  let finishA;
  const accountA = new Promise((resolve) => { finishA = resolve; });
  const applied = [];
  const disabled = [];
  const scope = {
    auth: { currentUser: { uid: "A" } }, localSessionVersion: { current: 0 }, localOpenRequest: { current: 0 },
    cloudFieldsRef: { current: null },
    tRef: { current: (key) => key }, setReady() {}, setHasOnboarded() {},
    prepareLocalAccount: async (uid) => uid === "A" ? accountA : true,
    loadJSON: async () => ({ userName: "B" }), STORAGE_KEYS: { profile: "profile" },
    applyLocalProfile: (profile) => applied.push(profile.userName), reloadPersistedData: async () => undefined,
    setAccountStorageAvailable: (value) => disabled.push(value), LocalAccountVaultError: class extends Error {},
  };
  vm.createContext(scope);
  vm.runInContext(code("openLocalAccount"), scope);
  const older = assert.rejects(scope.openLocalAccount("A"), /settings.noActiveSession/);
  scope.auth.currentUser = { uid: "B" };
  assert.equal(await scope.openLocalAccount("B"), true);
  finishA(true);
  await older;
  assert.deepEqual(applied, ["B"], "una apertura antigua no aplica el perfil de otra cuenta");
  assert.deepEqual(disabled, [], "el error de A no deshabilita la cuenta B que ya abrió");
}
{
  const calls = [];
  const scope = {
    auth: { currentUser: { uid: "test" } },
    localSessionVersion: { current: 0 },
    tRef: { current: (key) => key },
    CloudPremiumRequiredError: class extends Error {},
    setUserName: (value) => calls.push(value),
  };
  scope.loadCloudData = async () => {
    scope.localSessionVersion.current += 1;
    return { userName: "Respuesta antigua" };
  };
  vm.createContext(scope);
  vm.runInContext(code("hydrateFromCloud"), scope);
  await assert.rejects(scope.hydrateFromCloud("test"), /settings.noActiveSession/);
  assert.deepEqual(calls, [], "una respuesta vieja de nube no modifica una nueva sesión");
}
{
  const calls = [];
  const scope = {
    ...logoutScope(), uid: "test", isPremium: false, hasUnreadableLocalData: () => false,
    archiveLocalAccount: async () => calls.push("local-copy"),
    signOutFromGoogle: async () => calls.push("google"),
    signOut: async (auth) => { calls.push("auth"); auth.currentUser = null; },
    limpiarCuentaEnEsteDispositivo: async () => calls.push("clear-active"),
  };
  vm.createContext(scope);
  vm.runInContext(code("logout"), scope);
  await scope.logout();
  assert.deepEqual(calls, ["local-copy", "google", "auth", "clear-active"], "Gratis confirma copia local antes de cerrar o limpiar");
}
{
  const calls = [];
  const scope = {
    ...logoutScope(), uid: "test", isPremium: false, hasUnreadableLocalData: () => false,
    signOut: async () => calls.push("auth"),
    signOutFromGoogle: async () => calls.push("google"),
    limpiarCuentaEnEsteDispositivo: async () => calls.push("clear-active"),
    openLocalAccount: async () => { throw new Error("No recargar una copia vieja sobre cambios pendientes"); },
  };
  scope.archiveLocalAccount = async () => { throw new scope.LocalAccountVaultError(); };
  vm.createContext(scope);
  vm.runInContext(code("logout"), scope);
  await assert.rejects(scope.logout(), /localAccount.saveFailed/);
  assert.deepEqual(calls, [], "fallo local conserva la sesión sin borrar ni recargar cambios antiguos");
  assert.equal(scope.auth.currentUser.uid, "test");
}
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
assert.doesNotMatch(sentry, /@sentry\/react-native|Sentry\.init\(/);

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
assert.match(logout, /limpiarCuentaEnEsteDispositivo\(localUser\.uid\)/);
assert.match(deleteAccount, /deleteUser\(user\)[\s\S]*?limpiarCuentaEnEsteDispositivo\(user\.uid\)/);

console.log("Manejadores originales/IO adaptado: cierre y permisos locales; contratos estáticos: reglas, limpieza, enlaces y textos. Android/Firebase publicado no comprobados.");

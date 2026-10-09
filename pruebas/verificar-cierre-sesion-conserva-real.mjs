import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Ejecuta logout ORIGINAL junto al almacén, bóveda y cifrado ORIGINALES.
// Solo disco seguro/Android, Auth, Google y limpieza de servicios son adaptados.
// No monta React, no prueba tarjetas/avisos/PIN, ni toca cuentas o nube reales.
const revision = process.env.FINO_TEST_LOGOUT_FLOW_BASELINE ?? "";
const read = createSourceReader({ revision });
const context = read("contexts/AppDataContext.tsx");
const root = process.cwd();
const require = createRequire(import.meta.url);
function environment() {
  const result = buildSync({ stdin: { contents: `
    export { default as disk, failNextStorageOperation } from "@react-native-async-storage/async-storage";
    export { auth } from "@/utils/firebase";
    export { decryptText } from "@/utils/encryption";
    export { archiveLocalAccount, prepareLocalAccount, resumeLocalAccount, LocalAccountVaultError } from "@/utils/localAccountVault";
    export { clearAccountData, getAccountStorageSession, hasUnreadableLocalData, loadJSON, saveJSON, saveJSONNow, setAccountStorageAvailable, STORAGE_KEYS } from "@/utils/storage";
  `, resolveDir: root, sourcefile: "logout-real-dependencies.ts", loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: { "@": root,
      "@/utils/firebase": path.join(root, "pruebas/stubs/firebase-local.ts"),
      "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
      "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts"),
      "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts") } });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
async function seed(api, uid, amount) {
  api.auth.currentUser = { uid, email: `${uid}@example.com`, emailVerified: true };
  api.setAccountStorageAvailable(true);
  const values = {
    profile: { userName: uid, userEmail: `${uid}@example.com`, hasOnboarded: true, userCurrency: "PEN" },
    transactions: [{ id: amount, amount, description: `Movimiento ${uid}` }],
    categoriasPropias: [{ id: `c-${uid}`, nombre: `Categoría ${uid}` }],
    categoryCustom: { [`c-${uid}`]: { image: `foto-privada-${uid}` } },
    budgets: { "2026-10": amount * 10 },
    pagosProgramados: [{ id: `p-${uid}`, nombre: `Pago ${uid}`, monto: amount }],
    negocios: [{ id: `n-${uid}`, nombre: `Negocio ${uid}` }],
    productos: [{ id: `producto-${uid}`, precio: amount }],
    ventas: [{ id: `venta-${uid}`, monto: amount }],
  };
  for (const [key, value] of Object.entries(values)) assert.equal(await api.saveJSONNow(api.STORAGE_KEYS[key], value), true);
  await api.prepareLocalAccount(uid, `${uid}@example.com`);
  return values;
}
async function assertValues(api, values) {
  for (const [key, value] of Object.entries(values)) assert.deepEqual(await api.loadJSON(api.STORAGE_KEYS[key], null), value, `${key}: recuperar original de SU cuenta`);
}
function flow(api, uid, options = {}) {
  const events = [];
  const auth = { currentUser: { uid, email: `${uid}@example.com` } };
  let reader = true, onboarded = true;
  const dependencies = {
    ...api, auth, uid, isPremium: options.pro ?? false, hasOnboarded: true,
    captureBusy: { current: false }, localSessionVersion: { current: 0 },
    tRef: { current: key => key }, setReady() {}, setStorageReadBlocked() {},
    setHasOnboarded: value => { onboarded = value; },
    notificationReader: { isEnabled: () => reader, setEnabled: value => { reader = value; } },
    datosParaLaNube: () => ({ hasOnboarded: true }),
    saveCloudData: async () => { events.push("cloud"); return options.cloudFailure ? { ok: false } : { ok: true }; },
    signOutFromGoogle: async () => { events.push("google"); },
    signOut: async () => { events.push("auth"); if (options.authFailure) throw new Error("auth-failure"); auth.currentUser = null; },
    archiveLocalAccount: async (...args) => { await api.archiveLocalAccount(...args); events.push("local-copy"); },
    limpiarCuentaEnEsteDispositivo: async id => { assert.equal(id, uid); events.push("active-clean"); await api.clearAccountData(); },
  };
  return { logout: handlerOriginal("contexts/AppDataContext.tsx", "logout", dependencies, context),
    auth, events, reader: () => reader, onboarded: () => onboarded };
}
{
  const api = environment();
  const originalA = await seed(api, "A", 50);
  // El guardado pendiente también debe viajar a la copia, no solo lo que
  // ya estaba en disco antes de tocar Cerrar sesión.
  originalA.transactions = [{ id: 60, amount: 60, description: "Último cambio A" }];
  api.saveJSON(api.STORAGE_KEYS.transactions, originalA.transactions);
  const a = flow(api, "A");
  await a.logout();
  assert.ok((await api.disk.getAllKeys()).includes("finzo:localAccountVault:v1:A:manifest"),
    "FINO-01: el logout original tiene que confirmar la copia de A antes de limpiar; no basta con borrar claves");
  assert.equal(await api.prepareLocalAccount("B", "B@example.com"), false);
  for (const key of Object.keys(originalA)) assert.equal(await api.loadJSON(api.STORAGE_KEYS[key], null), null, `${key}: B no ve datos de A`);
  const originalB = await seed(api, "B", 70);
  const b = flow(api, "B");
  await b.logout();
  assert.equal(await api.prepareLocalAccount("A", "A@example.com"), true, "cerrar sesión Gratis no destruye la copia de A");
  await assertValues(api, originalA);
  assert.deepEqual(a.events, ["local-copy", "google", "auth", "active-clean"], "confirmar disco antes de cerrar, sin Firebase en Gratis");
  await api.archiveLocalAccount("A", "A@example.com");
  await api.clearAccountData();
  assert.equal(await api.prepareLocalAccount("B", "B@example.com"), true);
  await assertValues(api, originalB);
}
for (const skipBackup of [false, true]) {
  const api = environment();
  const values = await seed(api, "Pro", 80);
  const pro = flow(api, "Pro", { pro: true });
  await pro.logout({ skipBackup });
  assert.equal(await api.prepareLocalAccount("Pro", "Pro@example.com"), true);
  await assertValues(api, values);
  assert.deepEqual(pro.events, [...(skipBackup ? [] : ["cloud"]), "local-copy", "google", "auth", "active-clean"]);
}
for (const failure of ["disk", "auth", "cloud"]) {
  const api = environment();
  const values = await seed(api, "A", 90);
  const current = flow(api, "A", { pro: failure === "cloud", authFailure: failure === "auth", cloudFailure: failure === "cloud" });
  if (failure === "disk") api.failNextStorageOperation("set", ":manifest");
  await assert.rejects(current.logout(), error => failure === "disk" ? /localAccount.saveFailed/.test(error.message)
    : failure === "cloud" ? error.name === "BackupBeforeLogoutError" : /auth-failure/.test(error.message));
  assert.equal(current.auth.currentUser.uid, "A", `${failure}: conserva la sesión`);
  assert.equal(current.reader(), true);
  assert.equal(current.onboarded(), true);
  assert.equal(current.events.includes("active-clean"), false);
  await assertValues(api, values);
}
console.log("Logout + copia/cifrado originales, IO adaptado: Gratis A→B→A, último cambio, Pro y fallos conservan datos. Android/servicios externos pendientes.");

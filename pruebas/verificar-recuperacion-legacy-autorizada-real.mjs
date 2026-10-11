import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Usa la bóveda/almacén/AES originales y su adaptador IO ya existente.
// La regresión usa el MISMO método prepareLocalAccount de f60be0c:
// rechaza el legado confirmado; no falla por una exportación nueva ausente.
const root = process.cwd(), require = createRequire(import.meta.url);
const read = createSourceReader({ revision: process.env.FINO_LEGACY_RECOVERY_BASELINE ?? "" });
// El cuerpo se lee de su archivo real; nombre .ts solo evita que TypeScript
// convierta una función aislada en módulo CommonJS implícito por la extensión mjs.
const environment = handlerOriginal("vault-session-fixture.ts", "environment", { root, require, build, path, read },
  fs.readFileSync("pruebas/verificar-boveda-sesion-restauracion-real.mjs", "utf8"));
const ownerKey = "finzo:localAccountOwner:v1";
const account = () => ({ uid: "A", email: "a@example.test", emailVerified: true, providerData: [{ providerId: "google.com" }] });
const beforeDev = globalThis.__DEV__, beforeDiag = process.env.EXPO_PUBLIC_FINO_LOCAL_ACCESS_DIAGNOSTIC,
  beforeRecovery = process.env.EXPO_PUBLIC_FINO_LOCAL_LEGACY_RECOVERY;
function mode(enabled = true, dev = true) {
  globalThis.__DEV__ = dev;
  process.env.EXPO_PUBLIC_FINO_LOCAL_ACCESS_DIAGNOSTIC = enabled ? "1" : "0";
  process.env.EXPO_PUBLIC_FINO_LOCAL_LEGACY_RECOVERY = enabled ? "1" : "0";
}
async function seed(profile = { hasOnboarded: true, userName: "Perfil sintético sin correo", userCurrency: "PEN" }) {
  mode();
  const api = await environment(); api.setAccountStorageAvailable(true);
  const user = account(); api.auth.currentUser = user;
  if (profile !== null) await api.saveJSONNow(api.STORAGE_KEYS.profile, profile);
  await api.saveJSONNow(api.STORAGE_KEYS.transactions, [{ id: 13, amount: 123.45, description: "Movimiento original sintético" }]);
  await api.saveJSONNow(api.STORAGE_KEYS.budgets, { "2026-10": 980.25 });
  await api.saveJSONNow(api.STORAGE_KEYS.categoryBudgets, { "2026-10": { comida: 90.5 } });
  await api.saveJSONNow(api.STORAGE_KEYS.pagosProgramados, [{ id: 5, amount: 50, paid: false }]);
  api.setAccountStorageAvailable(false);
  return { api, user };
}
async function rawMap(api) { return new Map(await api.disk.multiGet(await api.disk.getAllKeys())); }
async function unchanged(api, original, allowOwner = false) {
  const after = await rawMap(api);
  if (allowOwner) after.delete(ownerKey);
  assert.deepEqual(after, original, "conserva exactamente perfil, movimientos, saldos/presupuestos, calendario y todas las otras claves");
}
let count = 0;
try {
  // Primera aserción ROJA de baseline: usuario/legado/autorización válidos,
  // pero el método anterior rechaza por no disponer de correo histórico.
  {
    const { api, user } = await seed(), original = await rawMap(api);
    assert.equal(await api.prepareLocalAccount(user.uid, user.email, { recoverUnidentifiedLegacyFor: user }), true);
    assert.deepEqual(JSON.parse(await api.decryptText(await api.disk.getItem(ownerKey))), { uid: "A", mode: "active" });
    await unchanged(api, original, true);
    mode(false); assert.equal(await api.prepareLocalAccount(user.uid, user.email), true, "el dueño confirmado permite después apertura normal, sin recuperación habilitada");
    await unchanged(api, original, true); count++;
  }
  for (const scenario of ["sin-opcion", "modo-normal", "produccion", "sin-diag", "sin-recovery", "usuario-reemplazado", "otra-instancia", "no-verificado", "otro-proveedor", "email-argumento-distinto", "ya-hay-dueno", "ya-hay-correo", "perfil-incompleto", "perfil-ausente"]) {
    const profile = scenario === "perfil-ausente" ? null : scenario === "perfil-incompleto" ? { hasOnboarded: false }
      : scenario === "ya-hay-correo" ? { hasOnboarded: true, userEmail: "b@example.test" } : undefined;
    const { api, user } = await seed(profile);
    // El adaptador no exporta encryptText; crear dueño genuino usando el
    // método original con un perfil identificado y después quitar SOLO su correo.
    if (scenario === "ya-hay-dueno") {
      await api.disk.removeItem(ownerKey); api.setAccountStorageAvailable(true);
      await api.saveJSONNow(api.STORAGE_KEYS.profile, { hasOnboarded: true, userEmail: user.email });
      await api.prepareLocalAccount(user.uid, user.email);
      await api.saveJSONNow(api.STORAGE_KEYS.profile, { hasOnboarded: true }); api.setAccountStorageAvailable(false);
    }
    if (scenario === "modo-normal") mode(false);
    if (scenario === "produccion") mode(true, false);
    if (scenario === "sin-diag") process.env.EXPO_PUBLIC_FINO_LOCAL_ACCESS_DIAGNOSTIC = "0";
    if (scenario === "sin-recovery") process.env.EXPO_PUBLIC_FINO_LOCAL_LEGACY_RECOVERY = "0";
    if (scenario === "usuario-reemplazado") api.auth.currentUser = { ...account(), uid: "B", email: "b@example.test" };
    if (scenario === "otra-instancia") api.auth.currentUser = { ...user };
    if (scenario === "no-verificado") user.emailVerified = false;
    if (scenario === "otro-proveedor") user.providerData = [{ providerId: "password" }];
    const original = await rawMap(api);
    await assert.rejects(api.prepareLocalAccount(user.uid, scenario === "email-argumento-distinto" ? "b@example.test" : user.email,
      scenario === "sin-opcion" ? undefined : { recoverUnidentifiedLegacyFor: user }), error => error.name === "LocalAccountVaultError", scenario);
    await unchanged(api, original); count++;
  }
  for (const phase of ["read", "confirm", "roundtrip", "permission", "profile-changed", "owner-changed", "write-fails"]) {
    const { api, user } = await seed(), original = await rawMap(api);
    const get = api.disk.getItem, set = api.disk.setItem, multiGet = api.disk.multiGet;
    let reached = false;
    api.disk.getItem = async key => {
      const raw = await get(key);
      if (!reached && phase === "read" && key === api.STORAGE_KEYS.profile) { reached = true; api.auth.currentUser = { ...user }; }
      if (!reached && phase === "roundtrip" && key === ownerKey && raw !== null) { reached = true; api.auth.currentUser = { ...user }; }
      return raw;
    };
    api.disk.setItem = async (key, raw) => {
      if (!reached && key === ownerKey && ["confirm", "write-fails"].includes(phase)) {
        reached = true;
        if (phase === "write-fails") throw new Error("simulated-disk-error");
        await set(key, raw); api.auth.currentUser = { ...user }; return;
      }
      return set(key, raw);
    };
    api.disk.multiGet = async keys => {
      if (!reached && keys.includes(ownerKey) && keys.includes(api.STORAGE_KEYS.profile)) {
        if (phase === "permission") { reached = true; mode(false); }
        if (phase === "profile-changed") { reached = true; await set(api.STORAGE_KEYS.profile, "{\"hasOnboarded\":true,\"userEmail\":\"b@example.test\"}"); }
        if (phase === "owner-changed") { reached = true; await set(ownerKey, "FOREIGN-OWNER-MUST-NOT-OVERWRITE"); }
      }
      return multiGet(keys);
    };
    await assert.rejects(api.prepareLocalAccount(user.uid, user.email, { recoverUnidentifiedLegacyFor: user }));
    assert.equal(reached, true, `frontera real alcanzada: ${phase}`);
    api.disk.getItem = get; api.disk.setItem = set; api.disk.multiGet = multiGet;
    if (phase === "profile-changed") original.set(api.STORAGE_KEYS.profile, "{\"hasOnboarded\":true,\"userEmail\":\"b@example.test\"}");
    if (phase === "owner-changed") original.set(ownerKey, "FOREIGN-OWNER-MUST-NOT-OVERWRITE");
    await unchanged(api, original); count++;
  }
  // Manejadores de pantalla originales: selección nunca usa otra sesión que
  // llegue después, y vincular exige el toque explícito y no se duplica.
  {
    const user = account(), auth = { currentUser: user, authStateReady: async () => {} };
    const selectedAccount = { current: null }, pending = { current: false }, alive = { current: true };
    const statuses = [], emails = [];
    const check = handlerOriginal("screens/LocalAccountDiagnostic.tsx", "check", {
      auth, selectedAccount, pending, alive, recoverAccount: () => {},
      isLocalAccountDiagnosticMode: () => true, setBusy: () => {}, setResult: () => {},
      setStatus: text => statuses.push(text), setSelectedEmail: email => emails.push(email),
      labels: { busy: "busy", ready: "ready", authFailed: "failure" }, reasons: { "session-changed": "changed" },
      GoogleSignInCancelled: class extends Error {}, signInWithGoogle: async () => user,
      readLocalAccountDiagnostic: async () => { queueMicrotask(() => { auth.currentUser = { ...user }; }); return { reason: "legacy-missing-email", verified: true }; },
    });
    await check(true);
    assert.equal(selectedAccount.current, null); assert.deepEqual(emails, [null]);
    assert.equal(statuses.at(-1), "changed", "no prepara una vinculación bajo la sesión que sustituyó al Google elegido"); count++;
  }
  {
    const { api, user } = await seed(), original = await rawMap(api), set = api.disk.setItem;
    let release, started, writes = 0;
    const gate = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { started = resolve; });
    api.disk.setItem = async (key, raw) => { if (key === ownerKey) { writes++; started(); await gate; } return set(key, raw); };
    const recovery = handlerOriginal("screens/LocalAccountRecovery.tsx", "recoverAccount", {
      auth: api.auth, isLocalAccountDiagnosticMode: () => true, isLocalAccountRecoveryEnabled: () => true,
      LocalAccountVaultError: class extends Error {}, prepareLocalAccount: api.prepareLocalAccount,
    });
    const selectedAccount = { current: user }, pending = { current: false }, alive = { current: true }, linkConfirmed = { current: false };
    const statuses = [], linked = [];
    const link = handlerOriginal("screens/LocalAccountDiagnostic.tsx", "link", {
      auth: api.auth, selectedAccount, pending, alive, linkConfirmed, linked: false,
      result: { reason: "legacy-missing-email" }, recoverAccount: recovery,
      setBusy: () => {}, setStatus: text => statuses.push(text), setLinked: value => linked.push(value), setResult: () => {},
      labels: { busy: "busy", linked: "linked", linkFailed: "failure" },
      readLocalAccountDiagnostic: async () => ({ reason: "owner-same-active", ownerMatches: true }),
    });
    const first = link(); await reached; await link();
    assert.equal(writes, 1); release(); await first; await link();
    assert.equal(writes, 1, "ni doble toque ni manejador viejo después de confirmar repiten la escritura");
    assert.deepEqual(linked, [true]); assert.equal(statuses.at(-1), "linked");
    await unchanged(api, original, true); count++;
  }
  {
    const user = account(); let calls = 0;
    for (const [diagnostic, enabled] of [[false, true], [true, false]]) {
      const recover = handlerOriginal("screens/LocalAccountRecovery.tsx", "recoverAccount", {
        auth: { currentUser: user }, isLocalAccountDiagnosticMode: () => diagnostic, isLocalAccountRecoveryEnabled: () => enabled,
        LocalAccountVaultError: class extends Error {}, prepareLocalAccount: async () => { calls++; },
      });
      await assert.rejects(recover(user));
    }
    assert.equal(calls, 0, "el componente no llama a la bóveda fuera de ambos modos autorizados"); count++;
  }
} finally {
  if (beforeDev === undefined) delete globalThis.__DEV__; else globalThis.__DEV__ = beforeDev;
  for (const [key, value] of [["EXPO_PUBLIC_FINO_LOCAL_ACCESS_DIAGNOSTIC", beforeDiag], ["EXPO_PUBLIC_FINO_LOCAL_LEGACY_RECOVERY", beforeRecovery]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
console.log(`Recuperación acompañada original: ${count} casos verdes; solo dueño nuevo, demás bytes intactos, sin autorización/modo/Google adecuados no escribe y cambios/interrupciones conservan fuentes. Android pendiente.`);

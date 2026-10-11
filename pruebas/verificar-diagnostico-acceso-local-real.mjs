import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createCipheriv, createHmac } from "node:crypto";
import ts from "typescript";
import { build } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Entrada, guardia y metadatos originales. SDK/Auth/UI Android se adaptan;
// no hay dispositivo, cuentas reales, historial, red, clave ni datos privados.
const read = createSourceReader({ revision: process.env.FINO_LOCAL_DIAGNOSTIC_BASELINE ?? "" });
const root = process.cwd(), require = createRequire(import.meta.url);
function evaluate(file, text, dependency) {
  const code = ts.transpileModule(text, { fileName: file, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(dependency, module, module.exports);
  return module.exports;
}
function mode(dev, platform, flag) {
  return handlerOriginal("utils/localAccountDiagnosticMode.ts", "isLocalAccountDiagnosticMode", {
    __DEV__: dev, Platform: { OS: platform }, process: { env: { EXPO_PUBLIC_FINO_LOCAL_ACCESS_DIAGNOSTIC: flag } },
  });
}
for (const [dev, platform, flag, diagnostic] of [
  [true, "android", "1", true], [false, "android", "1", false],
  [true, "ios", "1", false], [true, "web", "1", false], [true, "android", undefined, false],
]) {
  const isMode = mode(dev, platform, flag), roots = new Map(), tasks = new Map();
  let financial = 0, ownership = 0, renders = 0, diagnosticImports = 0;
  const ordinaryImports = [];
  assert.equal(isMode(), diagnostic);
  const Normal = () => {}, Diagnostic = () => {};
  const register = handlerOriginal("node_modules/react-native/Libraries/ReactNative/AppRegistryImpl.js", "registerComponent", {
    createPerformanceLogger: () => ({}), runnables: Object.create(null), sections: {},
    renderApplication: () => { renders++; }, componentProviderInstrumentationHook: provider => provider(),
    wrapperComponentProvider: null, rootViewStyleProvider: null,
  });
  const AppRegistry = {
    registerComponent(key, provider) { roots.set(key, provider); return register(key, provider); },
    registerHeadlessTask(key, task) { tasks.set(key, task); },
    runApplication() { renders++; },
  };
  // registerRootComponent ORIGINAL de Expo: Android no ejecuta runApplication.
  const registerRootComponent = handlerOriginal("node_modules/expo/src/launch/registerRootComponent.tsx", "registerRootComponent", {
    AppRegistry, Platform: { OS: platform }, require: () => ({ withDevTools: component => component }),
    window: undefined, document: undefined, globalThis: {},
  });
  evaluate("index.js", read("index.js"), name => {
    if (["expo-router/entry", "./utils/sentry", "./utils/capturaEnFondo", "./utils/exportarEnFondo", "./utils/localAccountVault"].includes(name)) ordinaryImports.push(name);
    if (name === "react-native") return { AppRegistry };
    if (name === "expo") return { registerRootComponent };
    if (name === "./utils/localAccountDiagnosticMode") return { isLocalAccountDiagnosticMode: isMode };
    if (name === "./screens/LocalAccountDiagnostic") { diagnosticImports++; return { default: Diagnostic }; }
    if (name === "expo-router/entry") { registerRootComponent(Normal); return {}; }
    if (name === "./utils/sentry") return { Sentry: { captureException: error => { throw error; } } };
    if (name === "./utils/capturaEnFondo") return { capturarEnFondo: async () => { financial++; } };
    if (name === "./utils/exportarEnFondo") return { exportarEnFondo: async () => { financial++; } };
    if (name === "./utils/localAccountVault") return {
      withLocalAccountOperation: async action => { ownership++; return action(); },
      allowBackgroundAccount: async () => true,
    };
    if (name === "./utils/firebase") return { auth: { authStateReady: async () => {}, currentUser: { uid: "ficticio", email: "ficticio@example.test" } } };
    throw new Error(`Dependencia inesperada en entrada: ${name}`);
  });
  for (const name of ["FinzoCapture", "FinzoExport"]) {
    assert.ok(tasks.has(name), "conserva ambos nombres de trabajos existentes");
    await tasks.get(name)()();
  }
  // Primera aserción ROJA en 741ed40: ese index ejecutaba trabajo financiero.
  assert.equal(financial, diagnostic ? 0 : 2, "diagnóstico no registra dinero ni exporta en segundo plano");
  assert.equal(ownership, diagnostic ? 0 : 2, "diagnóstico no abre ni adjudica la bóveda en background");
  if (diagnostic) assert.deepEqual(ordinaryImports, [], "no evalúa router, bóveda, captura, exportación ni telemetría: los imports normales pueden leer/migrar datos nativos");
  else assert.ok(ordinaryImports.includes("expo-router/entry") && ordinaryImports.includes("./utils/capturaEnFondo") && ordinaryImports.includes("./utils/exportarEnFondo"));
  assert.equal(renders, 0, "registro nativo original no monta una pantalla antes del reemplazo");
  assert.equal(roots.get("main")(), diagnostic ? Diagnostic : Normal);
  assert.equal(diagnosticImports, diagnostic ? 1 : 0, "producción y plataformas normales no cargan la pantalla de diagnóstico");

  let configured, nativePersistenceCalls = 0;
  const ordinary = { kind: "encrypted-ordinary" }, inMemory = { kind: "memory-only" };
  evaluate("utils/firebase.ts", read("utils/firebase.ts"), name => {
    if (name === "firebase/app") return { getApps: () => [], getApp: () => ({}), initializeApp: () => ({}) };
    if (name === "firebase/auth") return {
      initializeAuth: (_app, options) => { configured = options.persistence; return {}; },
      inMemoryPersistence: inMemory, getReactNativePersistence: storage => { nativePersistenceCalls++; assert.equal(storage, ordinary); return ordinary; },
    };
    if (name === "firebase/firestore") return { getFirestore: () => ({}) };
    if (name === "firebase/functions") return { getFunctions: () => ({}) };
    if (name === "@/utils/encryptedAsyncStorage") return { encryptedAsyncStorage: ordinary };
    if (name === "@/utils/localAccountDiagnosticMode") return { isLocalAccountDiagnosticMode: isMode };
    throw new Error(`Dependencia Firebase inesperada: ${name}`);
  });
  assert.equal(configured, diagnostic ? inMemory : ordinary);
  assert.equal(nativePersistenceCalls, diagnostic ? 0 : 1, "solo diagnóstico prescinde de la sesión cifrada; producción la conserva");
}

const ownerKey = "finzo:localAccountOwner:v1", profileKey = "finzo:profile";
async function metadataEnvironment({ realCrypto = false } = {}) {
  const harness = { mode: true, currentUser: { uid: "synthetic-A", email: " A@example.test ", emailVerified: true },
    values: new Map(), reads: [], changedDuringRead: false, key: "12".repeat(32), secureReads: 0 };
  const built = await build({ entryPoints: [path.join(root, "utils/localAccountDiagnostic.ts")],
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", alias: { "@": root },
    plugins: [{ name: "only-two-keys-io", setup(bundle) {
      bundle.onResolve({ filter: /^(@react-native-async-storage\/async-storage|@\/utils\/(firebase|encryption|localAccountDiagnosticMode)|expo-secure-store|expo-crypto)$/ }, args =>
        realCrypto && args.path.endsWith("/encryption") ? null : ({ path: args.path, namespace: "diagnostic-memory" }));
      bundle.onLoad({ filter: /.*/, namespace: "diagnostic-memory" }, args => {
        const contents = args.path.includes("async-storage") ? `export default { async multiGet(keys) { const h=globalThis.__diagnosticMetadata; h.reads.push([...keys]); if(h.changedDuringRead)h.currentUser={...h.currentUser}; return keys.map(k=>[k,h.values.get(k)??null]); } };`
          : args.path.endsWith("firebase") ? `export const auth={get currentUser(){return globalThis.__diagnosticMetadata.currentUser}};`
          : args.path.endsWith("localAccountDiagnosticMode") ? `export function isLocalAccountDiagnosticMode(){return globalThis.__diagnosticMetadata.mode;}`
          : args.path === "expo-secure-store" ? `export async function getItemAsync(key) {if(key!=='finzo_encryption_key_v1')throw new Error('other-secret-read');const h=globalThis.__diagnosticMetadata;h.secureReads++;return h.key;} export async function setItemAsync(){throw new Error('readonly-no-key-write');}`
          : args.path === "expo-crypto" ? `export async function getRandomBytesAsync(){throw new Error('readonly-no-random-or-key-generation');}`
          : `export async function decryptText(raw, options) { if(options?.readOnly!==true)throw new Error('not-read-only'); return raw.startsWith('synthetic:')?raw.slice(10):null; }`;
        return { contents, loader: "js" };
      });
    } }] });
  const module = { exports: {} }; globalThis.__diagnosticMetadata = harness;
  new Function("module", "exports", "require", built.outputFiles[0].text)(module, module.exports, require);
  return { harness, read: module.exports.readLocalAccountDiagnostic };
}
const scenarios = [
  [null, { hasOnboarded: true, userEmail: "a@example.test", userName: "PRIVATE-NAME" }, "legacy-matching-email"],
  [null, { hasOnboarded: true, userEmail: "b@example.test" }, "legacy-different-email"],
  [null, { hasOnboarded: true }, "legacy-missing-email"],
  [null, { hasOnboarded: false }, "no-owner-incomplete-profile"],
  [null, null, "no-owner-no-profile"],
  [{ uid: "synthetic-A", mode: "active" }, { hasOnboarded: true }, "owner-same-active"],
  [{ uid: "synthetic-A", mode: "archived" }, null, "owner-same-archived"],
  [{ uid: "synthetic-B", mode: "active" }, { hasOnboarded: true, userEmail: "a@example.test" }, "owner-different"],
];
for (const [owner, profile, reason] of scenarios) {
  const env = await metadataEnvironment();
  if (owner) env.harness.values.set(ownerKey, `synthetic:${JSON.stringify(owner)}`);
  if (profile) env.harness.values.set(profileKey, `synthetic:${JSON.stringify(profile)}`);
  env.harness.values.set("finzo:transactions", "NO-READ-HISTORY");
  const before = new Map(env.harness.values), result = await env.read();
  assert.equal(result.reason, reason);
  assert.deepEqual(env.harness.values, before, "la lectura no modifica ninguna fuente");
  assert.deepEqual(env.harness.reads, [[ownerKey, profileKey]], "solo dos metadatos: jamás historial, copias ni sesiones cifradas");
  assert.ok(Object.values(result).every(value => typeof value === "boolean" || value === null || value === reason), "salida exclusivamente enum/bools");
  assert.doesNotMatch(JSON.stringify(result), /synthetic-[AB]|@|PRIVATE-NAME|NO-READ-HISTORY/);
}
for (const detail of ["disabled", "no-session", "session-changed", "owner-unreadable", "profile-unreadable"]) {
  const env = await metadataEnvironment();
  if (detail === "disabled") env.harness.mode = false;
  if (detail === "no-session") env.harness.currentUser = null;
  if (detail === "session-changed") env.harness.changedDuringRead = true;
  if (detail === "owner-unreadable") env.harness.values.set(ownerKey, "broken-owner");
  if (detail === "profile-unreadable") env.harness.values.set(profileKey, "broken-profile");
  assert.equal((await env.read()).reason, detail);
  if (["disabled", "no-session"].includes(detail)) assert.deepEqual(env.harness.reads, []);
}
// Helper y AES/HMAC ORIGINALES juntos; solo IO/llave ficticios. No se permite
// getAllKeys, lectura de historial, setItem, generación ni sustitución de llave.
for (const availableKey of ["12".repeat(32), null]) {
  const env = await metadataEnvironment({ realCrypto: true }); env.harness.key = availableKey;
  function encrypt(value) {
    const iv = Buffer.from("34".repeat(16), "hex"), key = Buffer.from("12".repeat(32), "hex");
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]).toString("base64");
    const signed = `${iv.toString("hex")}:${ciphertext}`;
    return `v2:${signed}:${createHmac("sha256", key).update(signed).digest("hex")}`;
  }
  env.harness.values.set(ownerKey, encrypt({ uid: "synthetic-A", mode: "active" }));
  env.harness.values.set(profileKey, encrypt({ hasOnboarded: true, userEmail: "a@example.test" }));
  const originals = new Map(env.harness.values), result = await env.read();
  assert.equal(result.reason, availableKey ? "owner-same-active" : "owner-unreadable");
  assert.equal(env.harness.secureReads, availableKey ? 2 : 1);
  assert.deepEqual(env.harness.reads, [[ownerKey, profileKey]]);
  assert.deepEqual(env.harness.values, originals);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-A|@|121212|v2:/);
}
const screen = fs.readFileSync("screens/LocalAccountDiagnostic.tsx", "utf8");
assert.doesNotMatch(screen, /from\s*["'][^"']*AppDataContext|openLocalAccount|prepareLocalAccount|hydrateFromCloud|saveCloudData|recordLegalAcceptanceForCurrentAccount/,
  "pantalla sin montaje de datos, restauración ni nuevas escrituras legales/financieras");
assert.match(screen, /diagnóstico11oct1/);
delete globalThis.__diagnosticMetadata;
console.log("Entrada/registro SDK original y metadatos con IO sintético: diagnóstico aislado, dos lecturas sin datos privados, trabajos bloqueados y producción/persistencia intactas. Android físico pendiente.");

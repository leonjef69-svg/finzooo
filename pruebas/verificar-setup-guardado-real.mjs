import assert from "node:assert/strict";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { build } from "esbuild";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Ejecuta completeOnboarding y sus dependencias originales: almacén, AES/HMAC,
// barrera de sesión y marcas por campo. Solo React/puente Android/SecureStore
// se adaptan; el lote se escribe en una transacción SQLite REAL en memoria.
// No monta Android, no prueba entrega de avisos, ni toca tarjetas o Firebase.
const root = process.cwd(), require = createRequire(import.meta.url);
const read = createSourceReader({ revision: process.env.FINO_SETUP_SAVE_BASELINE ?? "" });
const file = "contexts/AppDataContext.tsx", context = read(file);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
const compiled = await build({
  stdin: { contents: `export * from './utils/storage'; export * from './utils/encryption';
    export * from './utils/accountTask'; export * from './utils/cloudFieldMerge';
    export * from './utils/amount'; export { monthKey } from './utils/format';
    export { auth } from './utils/firebase';`, resolveDir: root, loader: "ts" },
  alias: { "@": root }, bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
  plugins: [{ name: "setup-native-io-and-versioned-source", setup(b) {
    b.onResolve({ filter: /^(@react-native-async-storage\/async-storage|expo-crypto|expo-secure-store)$/ }, args => ({ path: args.path, namespace: "setup-io" }));
    b.onResolve({ filter: /^(\.\/utils\/firebase|@\/utils\/firebase)$/ }, () => ({ path: "firebase", namespace: "setup-io" }));
    b.onLoad({ filter: /.*/, namespace: "setup-io" }, args => ({ loader: "js", contents:
      args.path.includes("async-storage") ? "export default globalThis.__finoSetupSaveOriginal.disk;"
        : args.path === "expo-crypto" ? "export const getRandomBytesAsync = globalThis.__finoSetupSaveOriginal.random;"
        : args.path === "expo-secure-store" ? "export const getItemAsync = globalThis.__finoSetupSaveOriginal.secure.get; export const setItemAsync = globalThis.__finoSetupSaveOriginal.secure.set;"
        : "export const auth = globalThis.__finoSetupSaveOriginal.auth;" }));
    b.onLoad({ filter: /\.(ts|tsx)$/ }, args => {
      const relative = path.relative(root, args.path).replaceAll("\\", "/");
      if (relative.startsWith("utils/") || relative.startsWith("constants/")) return { contents: read(relative), loader: relative.endsWith(".tsx") ? "tsx" : "ts" };
      return undefined;
    });
  } }],
});

function originalCallback(sourceFile, variable, dependencies, source = read(sourceFile)) {
  const tree = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === variable) callback = node.initializer?.arguments?.[0];
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(callback, `callback original ${variable}`);
  const code = ts.transpileModule(`return ${callback.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), code)(...Object.values(dependencies));
}

const instances = [], storageInstances = [];
async function harness({ configured = false, noFields = false } = {}) {
  const db = new DatabaseSync(":memory:"); instances.push(db);
  db.exec("CREATE TABLE store (key TEXT PRIMARY KEY,value TEXT)");
  const get = key => db.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
  const put = (key, value) => db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value);
  const h = { batches: 0, singleWrites: 0, reads: 0, gate: null, cipherGate: null, failure: null, events: [] };
  const disk = {
    getItem: async key => get(key),
    setItem: async (key, value) => { h.singleWrites++; put(key, value); },
    multiGet: async keys => { h.reads++; return keys.map(key => [key, get(key)]); },
    getAllKeys: async () => db.prepare("SELECT key FROM store").all().map(row => row.key),
    removeItem: async key => db.prepare("DELETE FROM store WHERE key=?").run(key),
    multiRemove: async keys => { for (const key of keys) db.prepare("DELETE FROM store WHERE key=?").run(key); },
    multiSet: async entries => {
      h.batches++; h.entered?.resolve(); if (h.gate) await h.gate.promise;
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const [key, value] of entries) { put(key, value); if (h.failure === "rollback") throw Error("native-rollback"); }
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      if (h.failure === "lost-ack") throw Error("native-lost-ack");
    },
  };
  const secure = new Map([["finzo_encryption_key_v1", "42".repeat(32)]]);
  const auth = { currentUser: { uid: "setup-a", email: "setup-a@example.test", emailVerified: true } };
  globalThis.__finoSetupSaveOriginal = { disk, auth, secure: { get: async key => secure.get(key) ?? null, set: async (key, value) => secure.set(key, value) },
    random: async length => { if (h.cipherGate) { h.cipherEntered?.resolve(); await h.cipherGate.promise; } return new Uint8Array(randomBytes(length)); } };
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled.outputFiles[0].text)(module, module.exports, require);
  const api = module.exports; storageInstances.push(api); api.setAccountStorageAvailable(true);
  const profile = { userName: "Ana", userEmail: auth.currentUser.email, userPhoto: null, userCurrency: "PEN", userLanguage: "es", userCountry: "PE", hasOnboarded: configured };
  const budgets = { "2026-08": 125.50, "2026-09": 240 };
  const metadata = { budgets: 8, profile: 9, payments: 77 };
  for (const [key, value] of [[api.STORAGE_KEYS.profile, profile], [api.STORAGE_KEYS.budgets, budgets], [api.STORAGE_KEYS.cloudSyncMeta, metadata]]) assert.equal(await api.saveJSONNow(key, value), true);
  const initial = [api.STORAGE_KEYS.profile, api.STORAGE_KEYS.budgets, api.STORAGE_KEYS.cloudSyncMeta].map(get);
  h.singleWrites = 0; h.reads = 0;
  const fields = { ...profile, budgets, transactions: [], goals: [], categoryBudgets: {}, syncUpdatedAt: metadata, pagosProgramados: [], iconosFavoritos: [] };
  const deps = { ...api, auth, ready: true, hasOnboarded: configured, Platform: { OS: "android" },
    accountConfigured: { current: configured }, currencyForReturn: { current: "PEN" }, localSessionVersion: { current: 1 },
    cloudFieldsRef: { current: noFields ? null : fields }, cloudSyncMetaRef: { current: metadata },
    userName: profile.userName, userEmail: profile.userEmail, userPhoto: null, userCurrency: "PEN", userLanguage: "es", userCountry: "PE",
    budgets, pagosProgramados: [], iconosFavoritos: [], tRef: { current: key => key }, t: key => key,
    currentRealMonth: () => ({ y: 2026, m: 9 }), datosParaLaNube: () => fields,
    setMonth: value => { h.month = value; h.events.push("month"); },
    setBudgets: value => { h.budgets = value; h.events.push("budgets"); },
    setCloudSyncMeta: value => { h.metadata = value; h.events.push("metadata"); },
    showToast: value => h.events.push(value),
  };
  deps.withLocalAccountOperation = handlerOriginal("utils/localAccountVault.ts", "withLocalAccountOperation", { operation: Promise.resolve() }, read("utils/localAccountVault.ts"));
  deps.setHasOnboarded = originalCallback(file, "setHasOnboarded", { accountConfigured: deps.accountConfigured,
    setRenderedHasOnboarded: value => { h.configured = value; h.events.push("configured"); } }, context);
  const originals = {};
  for (const name of ["markCloudGroup", "markCloudProfile", "persistCloudProfile"]) deps[name] = (...args) => originals[name](...args);
  for (const name of ["markCloudGroup", "markCloudProfile", "persistCloudProfile", "updateCurrency", "completeOnboarding"]) originals[name] = handlerOriginal(file, name, deps, context);
  return Object.assign(h, { api, auth, deps, initial, get, original: originals.completeOnboarding,
    updateCurrency: originals.updateCurrency, keys: [api.STORAGE_KEYS.profile, api.STORAGE_KEYS.budgets, api.STORAGE_KEYS.cloudSyncMeta],
    raw: () => [api.STORAGE_KEYS.profile, api.STORAGE_KEYS.budgets, api.STORAGE_KEYS.cloudSyncMeta].map(get),
    plain: async () => Promise.all([api.STORAGE_KEYS.profile, api.STORAGE_KEYS.budgets, api.STORAGE_KEYS.cloudSyncMeta].map(async key => JSON.parse(await api.decryptText(get(key))))),
  });
}

try {
  {
    const h = await harness(); h.gate = deferred(); h.entered = deferred();
    const pending = h.original(500.25);
    // Esta aserción falla contra 19e5dde por la confirmación prematura REAL:
    // el manejador viejo declara configurada la cuenta sin confirmar el disco.
    assert.equal(h.deps.accountConfigured.current, false, "no declarar configurada la cuenta antes de confirmar el guardado");
    assert.ok(pending && typeof pending.then === "function", "terminar configuración devuelve su confirmación asincrónica");
    await h.entered.promise;
    assert.deepEqual(h.raw(), h.initial); assert.deepEqual(h.events, []);
    assert.equal(h.deps.cloudFieldsRef.current.hasOnboarded, false);
    h.gate.resolve(); await pending;
    const [profile, budgets, meta] = await h.plain();
    assert.equal(profile.hasOnboarded, true);
    assert.deepEqual(budgets, { "2026-08": 125.50, "2026-09": 240, "2026-10": 500.25 });
    assert.equal(meta.payments, 77); assert.ok(meta.budgets > 8); assert.ok(meta.profile > 9);
    assert.equal(h.batches, 1); assert.equal(h.singleWrites, 0);
    assert.ok(h.raw().every(raw => raw.startsWith("v2:")), "perfil/presupuestos/marcas quedan cifrados y autenticados con código real");
    assert.deepEqual(h.month, { y: 2026, m: 9 }); assert.deepEqual(h.budgets, budgets);
    assert.equal(h.deps.accountConfigured.current, true);
    const beforeCurrency = h.raw(); h.updateCurrency("USD");
    assert.equal(h.deps.currencyForReturn.current, "PEN"); assert.deepEqual(h.raw(), beforeCurrency);
    assert.equal(h.events.at(-1), "currency.locked", "la moneda queda bloqueada sin esperar otro dibujado React");
  }
  {
    const h = await harness(); h.failure = "rollback";
    await assert.rejects(h.original(600), /setup.saveFailed/);
    assert.deepEqual(h.raw(), h.initial, "rollback conserva exactamente los tres originales cifrados");
    assert.equal(h.deps.accountConfigured.current, false); assert.deepEqual(h.events, []);
    h.failure = null; await h.original(600);
    assert.equal((await h.plain())[1]["2026-10"], 600); assert.equal(h.batches, 2, "un fallo permite reintentar la misma cuenta");
  }
  {
    const h = await harness(); h.failure = "lost-ack";
    await h.original(700);
    assert.equal(h.batches, 1, "respuesta perdida no repite el presupuesto a ciegas");
    assert.ok(h.reads >= 2, "antes y después se consulta el ciphertext que realmente está en SQLite");
    assert.equal(h.deps.accountConfigured.current, true); assert.equal((await h.plain())[1]["2026-10"], 700);
  }
  {
    const h = await harness(); h.cipherGate = deferred(); h.cipherEntered = deferred();
    const pending = h.original(800); await h.cipherEntered.promise;
    const a = h.auth.currentUser;
    h.auth.currentUser = { uid: "setup-b", email: "setup-b@example.test" }; h.deps.localSessionVersion.current++;
    h.api.setAccountStorageAvailable(false); h.api.setAccountStorageAvailable(true);
    h.auth.currentUser = a; h.deps.localSessionVersion.current++;
    h.cipherGate.resolve(); await assert.rejects(pending, /settings.noActiveSession/);
    assert.equal(h.batches, 0); assert.deepEqual(h.raw(), h.initial); assert.deepEqual(h.events, []);
    assert.equal(h.deps.accountConfigured.current, false, "A → B → A no rehabilita un guardado antiguo mientras cifraba");
  }
  {
    const h = await harness(); h.cipherGate = deferred(); h.cipherEntered = deferred();
    const pending = h.original(810); await h.cipherEntered.promise;
    h.deps.currencyForReturn.current = "USD"; h.cipherGate.resolve();
    await assert.rejects(pending, /setup.saveFailed/);
    assert.equal(h.batches, 0); assert.deepEqual(h.raw(), h.initial); assert.deepEqual(h.events, []);
  }
  {
    const h = await harness(); h.cipherGate = deferred(); h.cipherEntered = deferred();
    const pending = h.original(820); await h.cipherEntered.promise;
    h.deps.cloudFieldsRef.current = { ...h.deps.cloudFieldsRef.current, budgets: { ...h.deps.cloudFieldsRef.current.budgets, "2026-07": 99 } };
    h.cipherGate.resolve(); await pending;
    assert.equal((await h.plain())[1]["2026-07"], 99, "si cambia una fuente mientras cifraba, prepara de nuevo sin perder el mes recién editado");
    assert.equal(h.batches, 1);
  }
  {
    const h = await harness(); h.cipherGate = deferred(); h.cipherEntered = deferred();
    const screen = { saveBusy: { current: false }, disabled: false, parsed: 825, t: key => key,
      setSaving: value => h.events.push(`saving:${value}`), setSaveError: value => h.events.push(`error:${value}`), onSaved: h.original };
    const save = handlerOriginal("screens/SetupBudget.tsx", "saveSetup", screen, read("screens/SetupBudget.tsx"));
    const pending = save(); await h.cipherEntered.promise;
    assert.equal(screen.saveBusy.current, true, "el cambio de perfil llega con la pantalla esperando confirmar el guardado");
    h.deps.cloudFieldsRef.current = { ...h.deps.cloudFieldsRef.current, userLanguage: "en" };
    h.cipherGate.resolve(); await pending;
    assert.equal(h.batches, 0, "cambiar idioma/perfil mientras cifraba cancela: el closure viejo no sobrescribe el perfil recién editado");
    assert.deepEqual(h.raw(), h.initial); assert.equal(h.deps.accountConfigured.current, false);
    assert.equal(h.deps.cloudFieldsRef.current.userLanguage, "en", "rechazar no revierte la nueva elección en memoria");
    assert.ok(h.events.includes("error:setup.saveFailed")); assert.equal(screen.saveBusy.current, false);
  }
  {
    const h = await harness(); h.gate = deferred(); h.entered = deferred();
    const first = h.original(830); await h.entered.promise;
    const second = h.original(840); h.gate.resolve();
    const results = await Promise.allSettled([first, second]);
    assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected");
    assert.equal(h.batches, 1); assert.equal((await h.plain())[1]["2026-10"], 830, "dos envíos simultáneos no reinician el presupuesto de una cuenta configurada");
  }
  for (const amount of [0, -1, NaN, Infinity, 9_000_000_000_001, 0.123, 1.2345]) {
    const h = await harness(); await assert.rejects(h.original(amount), /setup.saveFailed/);
    assert.equal(h.batches, 0); assert.deepEqual(h.raw(), h.initial); assert.deepEqual(h.events, []);
  }
  for (const kind of ["no-user", "not-ready", "storage-blocked", "non-android", "configured"]) {
    const h = await harness({ configured: kind === "configured" });
    if (kind === "no-user") h.auth.currentUser = null;
    if (kind === "not-ready") h.deps.ready = false;
    if (kind === "storage-blocked") h.api.setAccountStorageAvailable(false);
    if (kind === "non-android") h.deps.Platform.OS = "ios";
    // Los manejadores cierran sobre valores como React: recompilar tras cambiar
    // ready, mientras referencias y Auth se comparten en vivo.
    const complete = handlerOriginal(file, "completeOnboarding", h.deps, context);
    await assert.rejects(complete(900), kind === "configured" ? /setup.alreadyConfigured/ : kind === "non-android" ? /setup.saveFailed/ : /settings.noActiveSession/);
    assert.equal(h.batches, 0); assert.deepEqual(h.raw(), h.initial); assert.deepEqual(h.events, []);
    assert.equal(h.deps.accountConfigured.current, kind === "configured", "configuración existente no se reinicia");
  }
  {
    const h = await harness({ noFields: true }); await h.original(1000);
    assert.deepEqual((await h.plain())[1], { "2026-08": 125.50, "2026-09": 240, "2026-10": 1000 }, "la fuente alternativa también conserva meses anteriores");
  }
  const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
  for (const kind of ["verified", "unverified", "rollback"]) {
    const h = await harness(); h.auth.currentUser.emailVerified = kind !== "unverified";
    h.failure = kind === "rollback" ? "rollback" : null;
    h.gate = deferred(); h.entered = deferred(); const destinations = [];
    const route = handlerOriginal("app/setup.tsx", "SetupRoute", { React, SetupBudget: "SetupBudget", auth: h.auth,
      useAppData: () => ({ t: key => key, completeOnboarding: h.original }), router: { replace: route => destinations.push(route) } }, read("app/setup.tsx"))();
    const pending = route.props.onSaved(1100); await h.entered.promise; await turn();
    assert.deepEqual(destinations, [], "el callback original de la ruta espera disco antes de ir a Inicio/verificación");
    h.gate.resolve();
    if (kind === "rollback") { await assert.rejects(pending, /setup.saveFailed/); assert.deepEqual(destinations, []); }
    else { await pending; assert.deepEqual(destinations, [kind === "unverified" ? "/verify-email" : "/(tabs)"]); }
  }
  for (const replacement of [null, { uid: "setup-b", emailVerified: true }, { uid: "setup-a", emailVerified: true }]) {
    const h = await harness(), confirmed = deferred(), release = deferred(), destinations = [];
    const route = handlerOriginal("app/setup.tsx", "SetupRoute", { React, SetupBudget: "SetupBudget", auth: h.auth,
      useAppData: () => ({ t: key => key, completeOnboarding: async amount => {
        await h.original(amount); confirmed.resolve(); await release.promise;
      } }), router: { replace: route => destinations.push(route) } }, read("app/setup.tsx"))();
    const pending = route.props.onSaved(1110); await confirmed.promise;
    assert.equal((await h.plain())[1]["2026-10"], 1110, "el disco confirmó A antes de esta carrera de navegación");
    h.auth.currentUser = replacement; release.resolve();
    await assert.rejects(pending, /settings.noActiveSession/);
    assert.deepEqual(destinations, [], "ni perder Auth, ni otra cuenta, ni reemplazar la misma instancia abre la pantalla tras una respuesta antigua");
  }
  {
    const h = await harness(), destinations = []; h.auth.currentUser = null;
    const route = handlerOriginal("app/setup.tsx", "SetupRoute", { React, SetupBudget: "SetupBudget", auth: h.auth,
      useAppData: () => ({ t: key => key, completeOnboarding: () => assert.fail("sin usuario no iniciar guardado") }),
      router: { replace: route => destinations.push(route) } }, read("app/setup.tsx"))();
    await assert.rejects(route.props.onSaved(1120), /settings.noActiveSession/); assert.deepEqual(destinations, []);
  }
  for (const failure of [null, "rollback"]) {
    const h = await harness(); h.failure = failure;
    h.gate = deferred(); h.entered = deferred();
    const screen = { saveBusy: { current: false }, disabled: false, parsed: 1200, t: key => key,
      setSaving: value => h.events.push(`saving:${value}`), setSaveError: value => h.events.push(`error:${value}`),
      onSaved: h.original };
    const save = handlerOriginal("screens/SetupBudget.tsx", "saveSetup", screen, read("screens/SetupBudget.tsx"));
    const pending = save(); await h.entered.promise; await save();
    assert.equal(h.batches, 1); assert.equal(screen.saveBusy.current, true);
    h.gate.resolve(); await pending;
    assert.equal(screen.saveBusy.current, false); assert.equal(h.events.at(-1), "saving:false");
    assert.equal(h.events.includes("error:setup.saveFailed"), failure === "rollback", "el manejador original de pantalla muestra el fallo real y permite reintento");
    if (failure) { h.failure = null; await save(); assert.equal(h.deps.accountConfigured.current, true); }
  }
} finally {
  // La variante histórica encola un guardado diferido; no dejamos temporizadores
  // escribir contra un SQLite ya cerrado cuando su aserción roja detiene la suite.
  for (const api of storageInstances) api.discardPendingSaves();
  delete globalThis.__finoSetupSaveOriginal;
  for (const db of instances) db.close();
}
console.log("Configuración original + AES/HMAC + SQLite real: ACK antes de memoria/ruta, rollback de tres claves, respuesta perdida, meses, moneda, importes, sesión A→B→A y reintento aprobados. Android/React/nube/avisos reales pendientes.");

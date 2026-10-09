import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Rutas/errores/salida ORIGINALES con JSX/Auth/React y IO Android adaptados.
// Almacén/cifrado/barrera de lectura reales, exclusivamente datos ficticios.
// La bóveda legacy completa tiene otra suite; aquí se inyecta su error real.
// No monta React: los efectos de persistencia de sus setters no se ejecutan.
// No toca Firebase, servicios reales, Android, tarjetas ni datos de usuarios.
const root = process.cwd(), require = createRequire(import.meta.url);
const read = createSourceReader({ revision: process.env.FINO_LEGACY_ROUTE_BASELINE ?? "" });
const file = "contexts/AppDataContext.tsx", context = read(file);
const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
const user = () => ({ uid: "legacy-a", email: "legacy-a@example.test", displayName: "Ana", emailVerified: false });
const verificationRequired = () => Object.assign(new Error("localAccount.verifyBeforeRestore"), { name: "LocalAccountVerificationRequired" });
function route(file, name, auth, appData, events) {
  return handlerOriginal(file, name, { React, Login: "Login", Register: "Register", auth,
    useAppData: () => appData, router: { replace: value => events.push(["route", value]) },
    Alert: { alert: (...args) => events.push(["alert", ...args]) }, switchEntryRoute: value => events.push(["switch", value]) }, read(file))();
}

// ROJO contra 19e5dde: el Login original abría datos antes de verificar.
{
  const auth = { currentUser: user() }, events = [];
  const data = { t: key => key, openLocalAccount: async () => { events.push(["open"]); return true; },
    hydrateFromCloud: async () => { events.push(["cloud"]); return "restored"; },
    setUserName: value => events.push(["name", value]), setUserEmail: value => events.push(["email", value]) };
  await route("app/login.tsx", "LoginRoute", auth, data, events).props.onLoggedIn();
  assert.deepEqual(events, [["route", "/verify-email"]], "correo pendiente: no abrir la bóveda, cambiar perfil ni cargar nube antes de verificar");
}
{
  const auth = { currentUser: user() }, events = [];
  const data = { t: key => key, openLocalAccount: async () => { events.push(["open"]); throw verificationRequired(); },
    hydrateFromCloud: async () => { events.push(["cloud"]); return "restored"; },
    setUserName: value => events.push(["name", value]), setUserEmail: value => events.push(["email", value]) };
  await route("app/register.tsx", "RegisterRoute", auth, data, events).props.onRegistered("Otra persona", "another@example.test");
  assert.deepEqual(events, [["open"], ["route", "/verify-email"]], "el alta no sustituye el perfil legacy al pedir confirmación ni va a setup");
  assert.ok(auth.currentUser, "pedir verificar conserva la sesión que enviará el correo");
}
{
  const auth = { currentUser: user() }, events = [];
  const data = { t: key => key, openLocalAccount: async () => { throw Object.assign(new Error("owner-mismatch"), { name: "LocalAccountAccessError" }); },
    hydrateFromCloud: async () => assert.fail("no abrir nube tras un error de dueño"),
    setUserName: () => assert.fail("no sustituir perfil protegido"), setUserEmail: () => assert.fail("no sustituir email protegido") };
  await assert.rejects(route("app/register.tsx", "RegisterRoute", auth, data, events).props.onRegistered("Ana", auth.currentUser.email), /owner-mismatch/);
  assert.deepEqual(events, [], "un error de dueño no se oculta como verificación ni navega");
}
{
  const auth = { currentUser: null }, events = [];
  const data = { t: key => key, openLocalAccount: () => assert.fail("sin Auth no abrir"),
    setUserName: () => assert.fail("sin Auth no sustituir"), setUserEmail: () => assert.fail("sin Auth no sustituir") };
  await route("app/login.tsx", "LoginRoute", auth, data, events).props.onLoggedIn();
  await route("app/register.tsx", "RegisterRoute", auth, data, events).props.onRegistered("Ana", "legacy-a@example.test");
  assert.deepEqual(events, []);
}

const result = await build({ stdin: { contents: `export * from '@/utils/storage';
  export { decryptText } from '@/utils/encryption';
  export { LocalAccountVaultError } from '@/utils/localAccountVault';
  export { default as disk } from '@react-native-async-storage/async-storage';`, resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
  alias: { "@": root, "@/utils/firebase": path.join(root, "pruebas/stubs/firebase-local.ts"),
    "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
    "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts"), "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts") } });
function environment() {
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}

// Se extrae la flecha REAL init().catch, no se reescribe el algoritmo.
function initCatch(dependencies) {
  const tree = ts.createSourceFile(file, context, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "catch"
      && ts.isCallExpression(node.expression.expression) && node.expression.expression.expression.getText(tree) === "init") found = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found, "callback de error original init().catch");
  const code = ts.transpileModule(`return ${found.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), code)(...Object.values(dependencies));
}

for (const reason of ["verification", "owner", "read"]) {
  const api = environment(), auth = { currentUser: user() }, events = [], active = auth.currentUser;
  const deps = { ...api, auth, localOpenRequest: { current: 0 }, localSessionVersion: { current: 0 }, cloudFieldsRef: { current: { private: "old" } },
    tRef: { current: key => key }, setReady: value => events.push(["ready", value]), setHasOnboarded: value => events.push(["configured", value]),
    setAccountStorageAvailable: value => { events.push(["storage", value]); api.setAccountStorageAvailable(value); },
    prepareLocalAccount: async () => { throw new api.LocalAccountVaultError(reason); },
    loadJSON: () => assert.fail("no leer perfil tras error de bóveda"),
    applyLocalProfile: () => assert.fail("no aplicar perfil tras error"), reloadPersistedData: () => assert.fail("no exponer historial tras error"),
    signOut: async () => { events.push(["signout"]); auth.currentUser = null; }, Alert: { alert: (...args) => events.push(["alert", ...args]) } };
  const open = handlerOriginal(file, "openLocalAccount", deps, context);
  const expectedName = reason === "verification" ? "LocalAccountVerificationRequired" : "LocalAccountAccessError";
  let originalError;
  await assert.rejects(open(active.uid, active.email), error => { originalError = error; return error.name === expectedName; });
  assert.equal(api.getAccountStorageSession(), null);
  assert.deepEqual(events.filter(([event]) => event === "ready"), [["ready", false], ["ready", true]], "openLocalAccount libera la pantalla incluso al rechazar");
  await initCatch(deps)(originalError);
  assert.equal(auth.currentUser, reason === "verification" ? active : null);
  assert.equal(events.some(([event]) => event === "signout"), reason !== "verification");
  assert.equal(events.some(([event]) => event === "alert"), reason !== "verification");
  assert.equal(api.getAccountStorageSession(), null);
  assert.deepEqual(events.at(-1), ["ready", true], "la carga inicial no queda congelada en el error");
}

async function closedFlow({ hasOnboarded = true, contextUid = null, rejectAuth = false } = {}) {
  const api = environment(), events = [], auth = { currentUser: user() };
  api.setAccountStorageAvailable(true);
  assert.equal(await api.saveJSONNow(api.STORAGE_KEYS.profile, { hasOnboarded: true, userName: "Historial anterior privado", userEmail: "legacy-a@example.test" }), true);
  assert.equal(await api.saveJSONNow(api.STORAGE_KEYS.transactions, [{ id: 51, amount: 50, description: "Dato anterior ficticio" }]), true);
  const keys = await api.disk.getAllKeys(), original = await api.disk.multiGet(keys);
  api.setAccountStorageAvailable(false);
  let writes = 0, unreadableChecks = 0;
  for (const name of ["setItem", "removeItem", "multiRemove"]) {
    const previous = api.disk[name].bind(api.disk);
    api.disk[name] = async (...args) => { writes++; return previous(...args); };
  }
  const deps = { ...api, auth, uid: contextUid, isPremium: true, hasOnboarded,
    captureBusy: { current: true }, localSessionVersion: { current: 1 }, tRef: { current: key => key },
    cloudSyncMetaRef: { current: { private: 1 } }, cloudFieldsRef: { current: { private: "old" } }, solicitarPermisoDePagos: { current: true },
    NEGOCIO_VACIO: {}, TESTER_PREMIUM_INACTIVE: {},
    setReady: value => events.push(["ready", value]), setStorageReadBlocked: value => events.push(["read-blocked", value]),
    hasUnreadableLocalData: () => { unreadableChecks++; return true; },
    notificationReader: { isEnabled: () => false, setEnabled: value => events.push(["reader-enabled", value]), clear: () => assert.fail("no borrar lector ajeno") },
    signOutFromGoogle: async () => events.push(["google"]),
    signOut: async () => { events.push(["signout"]); if (rejectAuth) throw Error("auth-close-failed"); auth.currentUser = null; },
    archiveLocalAccount: () => assert.fail("sin bóveda abierta no archivar originales ajenos"),
    resumeLocalAccount: () => assert.fail("sin bóveda abierta no escribir dueño al fallar Auth"),
    limpiarCuentaEnEsteDispositivo: () => assert.fail("sin bóveda abierta no borrar archivos, PIN, avisos ni integraciones ajenos"),
    clearAccountData: () => assert.fail("sin bóveda abierta no borrar disco"),
    saveCloudData: () => assert.fail("sin bóveda abierta no subir originales ajenos"), datosParaLaNube: () => assert.fail("sin bóveda abierta no recoger copia financiera") };
  // El cuerpo de limpieza es original; sus setters son adaptadores de React.
  // Esto comprueba las acciones directas, no efectos de una app montada.
  for (const name of ["setHasOnboarded", "setUserName", "setUserEmail", "setUserPhoto", "setUserCurrency", "setUserLanguage", "setUserCountry",
    "setBudgets", "setCategoryBudgets", "setCategoryOverridesState", "setOverrides", "setCategoriasPropiasState", "setPropias", "setIconosFavoritosState", "setFavoritos",
    "setCategoriaRecienCreada", "setTransactions", "setDeletedTransactionIds", "setDeletedGoalIds", "setGoals", "setPagosProgramados", "setAvisosProgramados", "setAvisosFallo",
    "setIsPremium", "setTesterPremium", "setDatosNegocio", "setAutoCaptureOnState", "setAutoCaptureLog", "setPruebaInicio", "setMerchantLearned", "setCarryoverCleared",
    "setCloudSyncMeta", "setRespaldoFallo", "setCelebrateGoal", "setVerComoGratis"]) deps[name] = value => events.push([name, value]);
  deps.clearLocalAccountMemory = handlerOriginal(file, "clearLocalAccountMemory", deps, context);
  const logout = handlerOriginal(file, "logout", deps, context);
  return { api, auth, events, deps, logout, original, keys, writes: () => writes, checks: () => unreadableChecks,
    retry: () => { rejectAuth = false; }, preserve: async () => {
      assert.deepEqual(await api.disk.multiGet(keys), original, "cerrar sin abrir nunca cambia los originales cifrados");
      assert.equal(writes, 0); assert.equal(api.getAccountStorageSession(), null);
      assert.deepEqual(await api.loadJSON(api.STORAGE_KEYS.transactions, []), [], "la lectura financiera permanece cerrada");
    } };
}
for (const options of [{ hasOnboarded: true, contextUid: null }, { hasOnboarded: false, contextUid: "old-context-uid" }]) {
  const h = await closedFlow(options); await h.logout(); await h.preserve();
  assert.equal(h.auth.currentUser, null); assert.equal(h.checks(), 0, "dato ilegible ajeno no impide salir de una sesión que nunca lo abrió");
  assert.deepEqual(h.events.filter(([event]) => event === "ready"), [["ready", false], ["ready", true]]);
  assert.ok(h.events.some(([event, value]) => event === "setTransactions" && Array.isArray(value) && value.length === 0));
  assert.equal(h.deps.cloudFieldsRef.current, null);
}
{
  const h = await closedFlow({ rejectAuth: true }), active = h.auth.currentUser;
  h.deps.notificationReader.isEnabled = () => true; // indicador antiguo no autoriza el servicio
  await assert.rejects(h.logout(), /auth-close-failed/); await h.preserve();
  assert.equal(h.auth.currentUser, active); assert.deepEqual(h.events.at(-1), ["ready", true]);
  assert.ok(h.events.some(([event, value]) => event === "setHasOnboarded" && value === false), "datos cerrados no vuelven a parecer configurados por un indicador antiguo");
  assert.equal(h.events.some(([event, value]) => event === "reader-enabled" && value === true), false, "no reactiva el lector de otra cuenta tras fallar Auth");
  h.retry(); await h.logout(); await h.preserve(); assert.equal(h.auth.currentUser, null);
}
{
  const h = await closedFlow(); h.auth.currentUser = null;
  await assert.rejects(h.logout(), /settings.noActiveSession/); await h.preserve();
  assert.deepEqual(h.events, [], "sin usuario no alterar integraciones ni pantalla");
}
console.log("Originales/JSX/IO adaptados: correo pendiente no abre datos, alta legacy va a verificar, error de bóveda tipado, arranque conserva Auth para verificar, salida sin bóveda no archiva/borra/sube/reactiva y permite reintento. Setters/efectos React, Android/Firebase reales pendientes.");

import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// Función y efecto originales; IO y setters React adaptados en memoria. No usa
// una cuenta, Android, archivos del emulador, Firebase ni datos financieros reales.
const file = "contexts/AppDataContext.tsx";
const revision = process.env.FINO_LOCAL_OPEN_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const text = revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const account = uid => ({ uid, email: `${uid.toLowerCase()}@example.test`, emailVerified: true });
const profile = { hasOnboarded: true, userEmail: "a@example.test", userName: "Perfil sintético" };
class VaultError extends Error {
  constructor(reason) { super("synthetic-vault"); this.reason = reason; this.messageKey = "localAccount.restoreFailed"; }
}

function openFixture() {
  const calls = [], user = account("A");
  const deps = {
    auth: { currentUser: user }, tRef: { current: key => key },
    localOpenRequest: { current: 0 }, localSessionVersion: { current: 0 }, cloudFieldsRef: { current: null },
    __DEV__: true,
    LocalAccountVaultError: VaultError,
    prepareLocalAccount: async () => true,
    loadJSON: async () => profile, STORAGE_KEYS: { profile: "synthetic-profile" },
    setReady: value => calls.push(["ready", value]),
    applyLocalProfile: value => calls.push(["profile", value]),
    reloadPersistedData: async value => calls.push(["reload", value]),
    setHasOnboarded: value => calls.push(["onboarded", value]),
    setAccountStorageAvailable: value => calls.push(["storage", value]),
  };
  return { calls, user, deps, open: handlerOriginal(file, "openLocalAccount", deps, text) };
}

function reloadFixture() {
  const calls = [], waiting = deferred(), auth = { currentUser: account("A") };
  const keyNames = ["budgets", "categoryBudgets", "transactions", "deletedTransactionIds", "goals", "deletedGoalIds", "isPremium", "merchantLearned", "carryoverCleared", "pagosProgramados", "cloudSyncMeta", "autoCaptureLog", "cloudBackupEnabled"];
  const deps = {
    auth, localSessionVersion: { current: 0 },
    cloudBackupPreference: { current: { enabled: true, saved: true, revision: 0 } }, setCloudBackupRevision() {}, setRespaldoFallo() {}, setRespaldoNegocioFallo() {},
    STORAGE_KEYS: Object.fromEntries(keyNames.map(key => [key, key])),
    loadJSON: async (key, fallback) => key === "budgets" ? waiting.promise : fallback,
    seedTransactions: [], seedGoals: [], loadOverrides: async () => ({}),
    loadPropias: async () => [], loadFavoritos: async () => [], loadPrueba: async () => null,
    cargarNegocio: async () => ({}),
    // El algoritmo monetario no está bajo prueba: estos límites conservan
    // las entradas y hacen visible si se cruzó la guardia de sesión original.
    mergeTransactionCopies: (transactions, _remote, deletedIds) => ({ transactions, deletedIds }),
    mergeGoalCopies: (goals, _remote, deletedIds) => ({ goals, deletedIds }),
    cloudSyncMetaRef: { current: {} }, cloudFieldsRef: { current: null },
    datosParaLaNube: () => ({}),
  };
  for (const name of ["setOverrides", "setPropias", "setFavoritos", "setBudgets", "setCategoryBudgets", "setCategoryOverridesState", "setCategoriasPropiasState", "setIconosFavoritosState", "setPruebaInicio", "setDeletedTransactionIds", "setTransactions", "setDeletedGoalIds", "setGoals", "setPagosProgramados", "protectExistingIds", "setIsPremium", "setMerchantLearned", "setCarryoverCleared", "setDatosNegocio", "setCloudSyncMeta", "setAutoCaptureLog", "setCloudBackupEnabledState"]) {
    deps[name] = (...values) => calls.push([name, ...values]);
  }
  return { calls, waiting, auth, deps, reload: handlerOriginal(file, "reloadPersistedData", deps, text) };
}

// Extraer el callback real que contiene init().catch, no una copia del manejo
// de error. Si cambia su estructura, exige adaptar la prueba, no darla por verde.
function initialEffect(deps) {
  let init;
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "init") init = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(init, "el efecto original conserva su función init");
  let enclosing = init.parent;
  while (enclosing && !ts.isCallExpression(enclosing)) enclosing = enclosing.parent;
  assert.equal(enclosing?.expression.getText(source), "useEffect");
  const code = ts.transpileModule(`const effect = (${enclosing.arguments[0].getText(source)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(deps), `${code}\nreturn effect;`)(...Object.values(deps));
}
function initFixture() {
  const calls = [], user = account("A"), opened = deferred(), finished = deferred();
  const auth = { currentUser: user, authStateReady: async () => {} };
  const deps = {
    clearRetiredAlternateData: async () => {}, loadJSON: async (_key, fallback) => fallback,
    STORAGE_KEYS: { themeMode: "theme", visualStyle: "style", profile: "profile" },
    setThemeMode: () => {}, setVisualStyle: () => {}, colorScheme: { set: () => {} },
    auth, localOpenRequest: { current: 0 }, localSessionVersion: { current: 0 },
    openLocalAccount: async () => { calls.push(["open", auth.currentUser?.uid]); return opened.promise; },
    allowPreAccountPreferences: async () => false,
    setReady: value => { calls.push(["ready", value]); if (value) finished.resolve(); },
    setAccountStorageAvailable: value => calls.push(["storage", value]),
    setHasOnboarded: value => calls.push(["onboarded", value]),
    signOut: async currentAuth => { calls.push(["signOut", currentAuth.currentUser?.uid]); currentAuth.currentUser = null; },
    tRef: { current: key => key }, Alert: { alert: (...values) => calls.push(["alert", ...values]) },
    LocalAccountVaultError: VaultError,
  };
  return { calls, user, deps, auth, opened, finished, start: initialEffect(deps) };
}
async function ticks(count = 20) { for (let index = 0; index < count; index++) await Promise.resolve(); }
const cases = [];
const test = (name, run) => cases.push({ name, run });

test("apertura normal de la misma instancia conserva perfil y éxito", async () => {
  const f = openFixture(); assert.equal(await f.open("A", f.user.email), true);
  assert.equal(f.calls.filter(([name]) => name === "profile").length, 1);
  assert.equal(f.calls.filter(([name]) => name === "reload").length, 1);
  assert.ok(f.calls.some(([name, value]) => name === "onboarded" && value === true));
});

for (const replacement of ["B", "A"]) {
  test(`apertura atrasada no publica tras reemplazar la instancia por ${replacement}`, async () => {
    const f = openFixture(), wait = deferred(); f.deps.prepareLocalAccount = () => wait.promise;
    // Las dependencias de la función extraída son valores; recompilar con este IO.
    f.open = handlerOriginal(file, "openLocalAccount", f.deps, text);
    const pending = f.open("A", f.user.email).catch(() => false);
    f.deps.auth.currentUser = account(replacement);
    if (replacement !== "A") f.deps.localSessionVersion.current += 1;
    const start = f.calls.length; wait.resolve(true); const result = await pending;
    assert.notEqual(result, true, "una apertura de sesión anterior no anuncia éxito");
    assert.deepEqual(f.calls.slice(start).filter(([name, value]) =>
      ["profile", "reload"].includes(name) || (name === "onboarded" && value === true)), [],
    "no aplica perfil, recarga ni configuración de la sesión anterior; liberar la carga vieja con datos bloqueados sí es seguro");
  });
  test(`fallo de apertura A no bloquea la sesión nueva ${replacement}`, async () => {
    const f = openFixture(), wait = deferred(); f.deps.prepareLocalAccount = () => wait.promise;
    f.open = handlerOriginal(file, "openLocalAccount", f.deps, text);
    const pending = f.open("A", f.user.email).catch(() => false);
    f.deps.auth.currentUser = account(replacement);
    if (replacement !== "A") f.deps.localSessionVersion.current += 1;
    // La nueva ruta ya empezó a abrir su propia cuenta. El catch/finally
    // antiguo ya no es dueño de la cubierta de carga ni de los datos.
    f.deps.localOpenRequest.current += 1;
    const start = f.calls.length; wait.reject(new VaultError("read")); await pending;
    assert.deepEqual(f.calls.slice(start), [], "error viejo no cambia almacenamiento, configuración ni carga nuevos");
  });
}

test("otra apertura de la misma sesión gana al error del request anterior", async () => {
  const f = openFixture(), first = deferred(); let count = 0;
  f.deps.prepareLocalAccount = () => ++count === 1 ? first.promise : Promise.resolve(true);
  f.open = handlerOriginal(file, "openLocalAccount", f.deps, text);
  const stale = f.open("A", f.user.email).catch(() => false);
  assert.equal(await f.open("A", f.user.email), true);
  const start = f.calls.length; first.reject(new VaultError("read")); await stale;
  assert.deepEqual(f.calls.slice(start), [], "request anterior no bloquea una apertura más reciente");
});

test("fallo genuino de la misma apertura conserva la guardia", async () => {
  const f = openFixture(); f.deps.prepareLocalAccount = async () => { throw new VaultError("read"); };
  f.open = handlerOriginal(file, "openLocalAccount", f.deps, text);
  let observedError;
  await assert.rejects(f.open("A", f.user.email), error => {
    observedError = error; return error.name === "LocalAccountAccessError";
  });
  assert.equal(observedError.message, "localAccount.restoreFailed\nlocalAccount.devReadDetail",
    "desarrollo distingue lectura sin mostrar identidad ni contenido financiero");
  assert.ok(f.calls.some(([name, value]) => name === "storage" && value === false));
  assert.ok(f.calls.some(([name, value]) => name === "onboarded" && value === false));
  assert.deepEqual(f.calls.filter(([name]) => ["profile", "reload"].includes(name)), []);
});

test("la versión de producción no emite el diagnóstico de apertura local", async () => {
  const f = openFixture(); f.deps.__DEV__ = false;
  f.deps.prepareLocalAccount = async () => { throw new VaultError("write"); };
  f.open = handlerOriginal(file, "openLocalAccount", f.deps, text);
  await assert.rejects(f.open("A", f.user.email), error => error.name === "LocalAccountAccessError"
    && error.message === "localAccount.restoreFailed");
});

test("desarrollo identifica el punto de lectura sin revelar datos de la cuenta", async () => {
  const f = openFixture();
  const failure = new VaultError("read"); failure.readDetail = "archive-missing";
  f.deps.prepareLocalAccount = async () => { throw failure; };
  f.open = handlerOriginal(file, "openLocalAccount", f.deps, text);
  await assert.rejects(f.open("A", f.user.email), error => error.name === "LocalAccountAccessError"
    && error.message === "localAccount.restoreFailed\nlocalAccount.devReadDetail (archive-missing)"
    && !error.message.includes(f.user.email));
  assert.deepEqual(f.calls.filter(([name]) => ["profile", "reload"].includes(name)), []);
  const production = openFixture(); production.deps.__DEV__ = false;
  production.deps.prepareLocalAccount = async () => { throw failure; };
  production.open = handlerOriginal(file, "openLocalAccount", production.deps, text);
  await assert.rejects(production.open("A", production.user.email),
    error => error.message === "localAccount.restoreFailed");
});

for (const replacement of ["B", "A"]) {
  test(`recarga original no publica bloques después de reemplazar la instancia por ${replacement}`, async () => {
    const f = reloadFixture(), pending = f.reload(profile);
    f.auth.currentUser = account(replacement);
    if (replacement !== "A") f.deps.localSessionVersion.current += 1;
    f.waiting.resolve({ "2026-10": 100 }); await pending;
    assert.deepEqual(f.calls, [], "lectura de la sesión anterior no publica ningún bloque");
    assert.equal(f.deps.cloudFieldsRef.current, null, "tampoco habilita una copia de campos vieja para nube");
  });
}

test("recarga original publica los bloques de su sesión vigente", async () => {
  const f = reloadFixture(), pending = f.reload(profile);
  f.waiting.resolve({ "2026-10": 100 }); await pending;
  assert.ok(f.calls.some(([name]) => name === "setBudgets"));
  assert.ok(f.calls.some(([name]) => name === "setTransactions"));
  assert.notEqual(f.deps.cloudFieldsRef.current, null);
});

for (const replacement of ["B", "A"]) {
  test(`init no cierra la sesión nueva ${replacement} por el error de A`, async () => {
    const f = initFixture(); f.start(); await ticks();
    assert.deepEqual(f.calls.find(([name]) => name === "open"), ["open", "A"]);
    f.auth.currentUser = account(replacement);
    if (replacement !== "A") f.deps.localSessionVersion.current += 1;
    const start = f.calls.length;
    const error = new Error("synthetic-open-failed"); error.name = "LocalAccountAccessError";
    f.opened.reject(error); await ticks();
    assert.equal(f.auth.currentUser?.uid, replacement, "el catch antiguo no cierra Auth nuevo");
    assert.deepEqual(f.calls.slice(start).filter(([name]) => name !== "ready"), [],
      "sin cierre, alerta ni cambios de datos; se permite liberar la carga vieja si no hay nueva apertura");
  });
}

test("init no libera la carga de una apertura más reciente", async () => {
  const f = initFixture(); f.start(); await ticks();
  f.auth.currentUser = account("B"); f.deps.localSessionVersion.current += 1;
  f.deps.localOpenRequest.current += 1;
  const start = f.calls.length;
  const error = new Error("synthetic-old-init-error"); error.name = "LocalAccountAccessError";
  f.opened.reject(error); await ticks();
  assert.equal(f.auth.currentUser?.uid, "B");
  assert.deepEqual(f.calls.slice(start), [], "un init anterior no cierra ni desbloquea la nueva apertura");
});

test("init sin cuenta no publica preferencias sobre un acceso nuevo", async () => {
  const f = initFixture(), preferences = deferred(); f.auth.currentUser = null;
  let waitingPreferences = false;
  f.deps.allowPreAccountPreferences = () => { waitingPreferences = true; return preferences.promise; };
  f.deps.loadJSON = async (key, fallback) => key === "profile" ? profile : fallback;
  for (const name of ["setUserName", "setUserEmail", "setUserPhoto", "setUserCurrency", "setUserLanguage", "setUserCountry"]) {
    f.deps[name] = value => f.calls.push([name, value]);
  }
  f.deps.countryFor = () => ({ id: "PE" });
  initialEffect(f.deps)(); await ticks(); assert.equal(waitingPreferences, true);
  f.auth.currentUser = account("B"); f.deps.localSessionVersion.current += 1;
  f.deps.localOpenRequest.current += 1;
  const start = f.calls.length; preferences.resolve(true); await ticks();
  assert.deepEqual(f.calls.slice(start), [], "preferencias viejas no cambian perfil ni liberan la cubierta nueva");
});

test("una sesión nueva durante el cierre de init no recibe su alerta ni carga viejas", async () => {
  const f = initFixture(), signingOut = deferred(); let reached = false;
  f.deps.signOut = async currentAuth => {
    f.calls.push(["signOut", currentAuth.currentUser?.uid]); reached = true;
    await signingOut.promise;
  };
  initialEffect(f.deps)(); await ticks();
  const error = new Error("synthetic-old-error"); error.name = "LocalAccountAccessError";
  f.opened.reject(error); await ticks(); assert.equal(reached, true);
  f.auth.currentUser = account("B"); f.deps.localSessionVersion.current += 1;
  f.deps.localOpenRequest.current += 1;
  const start = f.calls.length; signingOut.resolve(); await ticks();
  assert.deepEqual(f.calls.slice(start), [], "error anterior no muestra aviso ni libera carga después de cerrar Auth");
  assert.equal(f.auth.currentUser?.uid, "B");
});

test("init conserva aviso y cierre cuando falla su propia sesión", async () => {
  const f = initFixture(); f.start(); await ticks();
  const error = new Error("synthetic-own-open-failed"); error.name = "LocalAccountAccessError";
  f.opened.reject(error); await f.finished.promise;
  assert.deepEqual(f.calls.find(([name]) => name === "signOut"), ["signOut", "A"]);
  assert.equal(f.auth.currentUser, null);
  assert.ok(f.calls.some(([name]) => name === "alert"));
});

let failures = 0;
for (const { name, run } of cases) {
  try { await run(); console.log(`OK ${name}`); }
  catch (error) { failures++; console.error(`FALLO ${name}: ${error.message}`); }
}
if (failures) throw new Error(`${failures}/${cases.length} casos fallidos de apertura/sesión originales`);
console.log(`Apertura y efecto init originales: ${cases.length} casos verdes; no prueban restauración física de bóveda, SDK Google ni UI Android.`);

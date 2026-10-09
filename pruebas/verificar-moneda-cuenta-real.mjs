import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// Funciones originales con IO adaptado; no monta Android ni convierte dinero.
const baseline = process.env.FINO_TEST_CURRENCY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const file = "contexts/AppDataContext.tsx", source = read(file);
const api = {};
vm.runInNewContext(ts.transpileModule(read("utils/cloudFieldMerge.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: api, Error });
const historyFormats = {};
vm.runInNewContext(ts.transpileModule(read("utils/cloudHistoryMigration.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: historyFormats, Error, require: name => {
  if (name === "@/utils/mergeTransactions") return {};
  if (name === "@/utils/utf8") return { utf8ByteLength: text => Buffer.byteLength(text) };
  throw new Error(`Dependencia inesperada: ${name}`);
} });
const writes = [], notices = [], changes = [];
const deps = { accountConfigured: { current: true }, currencyForReturn: { current: "PEN" },
  userCurrency: "PEN", userCountry: "PE", userName: "Ana", userPhoto: null,
  userLanguage: "es", userEmail: "ana@example.com", budgets: {},
  t: key => key, showToast: value => notices.push(value),
  translations: { en: { "toast.countryUpdated": "Country updated", "country.updatedLocked": "Country updated; currency kept" } },
  CLOUD_SYNC_GROUPS: { profile: "profile", budgets: "budgets" },
  STORAGE_KEYS: { profile: "profile", budgets: "budgets", cloudSyncMeta: "meta" }, saveJSON: (key, value) => writes.push([key, value]),
  markCloudGroup: (_group, before, update) => { changes.push(_group); return update(before); },
  currentRealMonth: () => ({ y: 2026, m: 9 }), monthKey: () => "2026-10", setMonth() {}, setBudgets() {},
};
for (const name of ["setUserName", "setUserPhoto", "setUserLanguage", "setUserCountry"]) deps[name] = () => {};
deps.setUserCurrency = currency => { deps.currencyForReturn.current = currency; };
deps.setHasOnboarded = configured => { deps.accountConfigured.current = configured; };
// Cierra sobre el mismo objeto: cada dependencia delega al manejador original.
const functions = {};
for (const name of ["markCloudProfile", "persistCloudProfile", "updateCountry"]) deps[name] = (...args) => functions[name](...args);
for (const name of ["markCloudProfile", "persistCloudProfile", "updateCountry", "updateCurrency", "setInitialCountry", "completeOnboarding"])
  functions[name] = handlerOriginal(file, name, deps, source);

functions.updateCurrency("USD");
assert.equal(deps.currencyForReturn.current, "PEN", "no convertir visualmente S/100 en US$100");
assert.deepEqual(writes, [], "no escribir moneda ni marcas nuevas");
assert.deepEqual(changes, []);
assert.deepEqual(notices, ["currency.locked"]);
functions.updateCurrency("PEN"); assert.equal(notices.length, 1, "elegir la actual no finge un cambio");
functions.updateCountry("US", "en", "USD");
assert.equal(writes.at(-1)[1].userCurrency, "PEN");
assert.equal(writes.at(-1)[1].userCountry, "US");
assert.equal(writes.at(-1)[1].userLanguage, "en");
assert.equal(writes.at(-1)[1].hasOnboarded, true);
assert.equal(notices.at(-1), "Country updated; currency kept");
functions.setInitialCountry("EC", "es", "USD");
assert.equal(writes.at(-1)[1].userCurrency, "PEN", "el recorrido de bienvenida tampoco cambia una cuenta configurada");
assert.equal(writes.at(-1)[1].hasOnboarded, true, "no reabre la configuración para eludir el bloqueo");

// Una cuenta nueva puede elegir; completar la configuración bloquea inmediatamente.
deps.accountConfigured.current = false;
functions.setInitialCountry("US", "en", "USD");
assert.equal(writes.at(-1)[1].userCurrency, "USD");
assert.equal(writes.at(-1)[1].hasOnboarded, false);
// Simula el nuevo dibujado sin copiar el algoritmo del registro.
const configuredDeps = { ...deps, userCurrency: "USD", ready: true,
  auth: { currentUser: { uid: "synthetic", email: "ana@example.com" } },
  localSessionVersion: { current: 1 }, Platform: { OS: "android" },
  cloudFieldsRef: { current: null }, cloudSyncMetaRef: { current: {} },
  tRef: { current: key => key }, captureAccountTask: () => ({ current: () => true }),
  isSafeMoneyAmount: amount => Number.isFinite(amount) && amount > 0,
  amountInputError: () => null, withLocalAccountOperation: work => work(),
  datosParaLaNube: () => ({ userName: "Ana", userPhoto: null, userCurrency: "USD", userLanguage: "en", budgets: {} }),
  pagosProgramados: [], iconosFavoritos: [],
  recordCloudGroupChange: api.recordCloudGroupChange, cloudGroupValue: api.cloudGroupValue,
  setCloudSyncMeta() {}, saveJSONBatchNow: async (_keys, prepare) => {
    const batch = await prepare(); if (!batch.stillValid()) return false;
    for (const entry of batch.entries) writes.push(entry);
    batch.committed(); return true;
  },
};
const complete = handlerOriginal(file, "completeOnboarding", configuredDeps, source);
await complete(100);
assert.equal(deps.accountConfigured.current, true);
functions.updateCurrency("PEN");
assert.equal(deps.currencyForReturn.current, "USD");
// Sin movimientos también sigue fija: la condición no depende de su cantidad.
assert.equal(writes.findLast(([key]) => key === "profile")[1].hasOnboarded, true);

// Ejecuta la implementación del setter de React: actualización inmediata
// antes del siguiente dibujado, restauración y limpieza de otra cuenta.
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let setter;
function find(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "setHasOnboarded") setter = node.initializer?.arguments?.[0];
  ts.forEachChild(node, find);
}
find(tree); assert.ok(setter, "la protección inmediata es parte del contexto real");
const lock = { current: false }, rendered = [];
const setConfigured = new Function("accountConfigured", "setRenderedHasOnboarded",
  ts.transpileModule(`return ${setter.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(lock, value => rendered.push(value));
setConfigured(true); assert.equal(lock.current, true);
setConfigured(false); assert.equal(lock.current, false);
setConfigured(true); assert.deepEqual(rendered, [true, false, true]);

// Fusión original: rechaza antes de cambiar presupuesto, calendario o perfil.
const data = extra => ({ hasOnboarded: true, userName: "Ana", userPhoto: null,
  userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {},
  transactions: [], goals: [], isPremium: false, ...extra });
const a = data({ budgets: { "2026-10": 100 }, syncUpdatedAt: { profile: 10 } });
const b = data({ userCurrency: "USD", budgets: { "2026-09": 50 }, syncUpdatedAt: { profile: 1000 } });
const unchanged = JSON.stringify([a, b]);
assert.throws(() => api.mergeCloudFields(a, b), /account-currency-conflict/);
assert.throws(() => api.mergeCloudFields(b, a), /account-currency-conflict/);
assert.equal(JSON.stringify([a, b]), unchanged);
const merged = api.mergeCloudFields(a, { ...b, userCurrency: "PEN" });
assert.equal(merged.userCurrency, "PEN");
assert.deepEqual(JSON.parse(JSON.stringify(merged.budgets)), { "2026-09": 50, "2026-10": 100 });
assert.equal(api.mergeCloudFields(data({ hasOnboarded: false, syncUpdatedAt: { profile: 9000 } }), b).userCurrency, "USD",
  "preferencia previa no reetiqueta el respaldo existente");
assert.equal(api.mergeCloudFields(b, data({ hasOnboarded: false, syncUpdatedAt: { profile: 9000 } })).userCurrency, "USD");

// Recepción original devuelve false antes de tocar cualquiera de los datos.
let receive;
function findReceive(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "applyNewerCloudFields") receive = node.initializer.arguments[0];
  ts.forEachChild(node, findReceive);
}
findReceive(tree); assert.ok(receive);
const failure = [];
const receiveDeps = { auth: { currentUser: { uid: "a" } }, privateBoxCloudResponseCurrent: () => true,
  cloudFieldsRef: { current: a }, cloudSyncMetaRef: { current: a.syncUpdatedAt }, mergeCloudFields: api.mergeCloudFields,
  transactionsLive: { current: a.transactions },
  goalsLive: { current: a.goals },
  mergeGoals: (left, right) => { assert.deepEqual(left, []); assert.deepEqual(right, []); return []; },
  // Esta suite aísla moneda/perfil: las listas son vacías. La fusión de
  // movimientos se ejecuta originalmente en sus suites, no se acredita aquí.
  mergeTransactions: (left, right) => { assert.deepEqual(left, []); assert.deepEqual(right, []); return []; },
  setRespaldoFallo: reason => failure.push(reason) };
const apply = new Function(...Object.keys(receiveDeps), ts.transpileModule(`return ${receive.getText(tree)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText)(...Object.values(receiveDeps));
assert.equal(apply(b), false); assert.equal(receiveDeps.cloudFieldsRef.current, a);
assert.deepEqual(failure, ["monedas-distintas"]);
const restoreDeps = { ...receiveDeps, ...api, localSessionVersion: { current: 1 },
  tRef: { current: key => key }, loadCloudData: async () => b,
};
const restore = handlerOriginal(file, "hydrateFromCloud", restoreDeps, source);
await assert.rejects(restore("a"), /settings.backupCurrencyConflict/);
assert.equal(receiveDeps.cloudFieldsRef.current, a);
assert.equal(failure.at(-1), "monedas-distintas", "restauración tampoco modifica la cuenta ni oculta el conflicto");
const readable = handlerOriginal("utils/cloudSync.ts", "motivoLegible", {}, read("utils/cloudSync.ts"));
assert.equal(readable(Error("account-currency-conflict")), "monedas-distintas");

// Guardado original: aborta ANTES de escribir raíz o historial separado.
for (const historyFormat of [1, 2]) {
  let saved = { ...b, historyFormat };
  const operations = [], snap = () => ({ exists: () => true, data: () => saved });
  const cloudDeps = { ...api, ...historyFormats, db: {}, doc: () => "user", getDoc: async () => snap(),
    hasUnreadableLocalData: () => false, utf8ByteLength: text => Buffer.byteLength(text),
    withPrivateBoxCloudOperation: async (_uid, work) => work({ wait: work => work(), remember: value => value, assertCurrent() {} }),
    assertLegacyHistoryFormat() {}, LIMITE_FIRESTORE: 1_000_000, TOPE_SEGURO: 800_000,
    mergeTransactions: left => left, mergeGoals: left => left,
    pruneDeletedTransactionIds: values => values, pruneDeletedGoalIds: values => values,
    runTransaction: async (_db, work) => work({ get: async () => snap(), set: (_ref, value) => { operations.push("root"); saved = value; } }),
    saveHistoryV2: async (...args) => { operations.push(["history", args[4]]); return { transactions: args[1], deletedIds: args[2] }; },
  };
  const cloudFunctions = {};
  for (const name of ["conservarPremiumManual", "saveCloudDataV2", "pesa", "sinFotos", "motivoLegible"])
    cloudDeps[name] = (...args) => cloudFunctions[name](...args);
  for (const name of ["conservarPremiumManual", "saveCloudDataV2", "pesa", "sinFotos", "motivoLegible", "saveCloudData"])
    cloudFunctions[name] = handlerOriginal("utils/cloudSync.ts", name, cloudDeps, read("utils/cloudSync.ts"));
  const before = JSON.stringify(saved);
  assert.deepEqual(await cloudFunctions.saveCloudData("a", a), { ok: false, motivo: "monedas-distintas" });
  assert.deepEqual(operations, [], `formato ${historyFormat}: sin escrituras parciales`);
  assert.equal(JSON.stringify(saved), before);
  saved = { ...b, historyFormat, userCurrency: "PEN" };
  assert.equal((await cloudFunctions.saveCloudData("a", a)).ok, true, `formato ${historyFormat}: misma moneda sí guarda`);
  if (historyFormat === 2) assert.deepEqual(operations[0], ["history", "PEN"]);
}

// Reconsulta por fila: si cambia la raíz tras el primer control, no escribe
// esa fila de importes. El SDK de red se adapta; no se copia el guardado.
const historyWrites = [], historyDeps = { ...api, ...historyFormats, db: {},
  withPrivateBoxCloudLease: async (_uid, _lease, work) => work({ wait: work => work(), remember: value => value, assertCurrent() {} }),
  exclusive: (_uid, work) => work(), refresh: async () => ({ entries: [], checkpoint: null }),
  planLocalHistoryChanges: () => [{ id: 1, deleted: false, transaction: { id: 1, amount: 100 } }],
  doc: (_db, ...parts) => parts.join("/"), historyDocumentId: String,
  runTransaction: async (_db, work) => work({
    get: async ref => ref === "users/a" ? { exists: () => true, data: () => ({ hasOnboarded: true, historyFormat: 2, userCurrency: "USD" }) }
      : { exists: () => false },
    set: (...args) => historyWrites.push(args),
  }), UnsupportedHistoryFormatError: class extends Error {},
};
const historySave = handlerOriginal("utils/cloudHistoryV2.ts", "saveHistoryV2", historyDeps, read("utils/cloudHistoryV2.ts"));
await assert.rejects(historySave("a", [{ id: 1, amount: 100 }], [], undefined, "PEN"), /account-currency-conflict/);
assert.deepEqual(historyWrites, []);

// Contratos estáticos adicionales, NO pruebas visuales ni reglas publicadas.
assert.match(read("screens/CurrencyPicker.tsx"), /disabled=\{hasOnboarded\}/);
assert.match(read("screens/CountryPicker.tsx"), /export \{ default \} from "\.\/LanguagePicker"/,
  "el selector antiguo es alias de idioma, no una vía para elegir moneda");
assert.match(source, /setHasOnboarded\(onboarded\)/, "restaura bloqueo de la cuenta local");
assert.match(source, /setHasOnboarded\(false\)/, "limpia bloqueo al salir");
assert.match(read("utils/cloudSync.ts"), /lease, clean\.userCurrency\)/, "historial separado recibe moneda de origen");
console.log("Moneda fija: manejadores y fusión originales aprobados; UI/restauración con contratos estáticos, Android pendiente.");

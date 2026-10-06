import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { buildSync } from "esbuild";

// Corre las funciones propias, no una copia de su lógica. Android y la
// conexión de red se sustituyen; no se usa Firebase ni una cuenta real.
const read = (file) => process.env.FINO_TEST_BASELINE
  ? execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" })
  : fs.readFileSync(file, "utf8");
const exports = {};
vm.runInNewContext(ts.transpile(read("utils/cloudFieldMerge.ts"), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}), { exports });
const { mergeCloudFields, recordCloudGroupChange, cloudGroupValue, replaceCloudGroup, CLOUD_SYNC_GROUPS } = exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
// Dependencia de coordinación sustituida solo para probar la fusión original;
// su cola/sesión/archivo se ejecutan en verificar-barrera-personal-caja.mjs.
const coordinator = {
  PrivateBoxSyncError: class extends Error {}, privateBoxCloudResponseCurrent: () => true,
  withPrivateBoxCloudOperation: async (_uid, work) => work({ assertCurrent() {}, wait: work => work(), remember: data => data }),
};
const data = (extra = {}) => ({ hasOnboarded: true, userName: "Ana", userPhoto: null,
  userCurrency: "PEN", userLanguage: "es", budgets: {}, categoryBudgets: {},
  transactions: [], goals: [], isPremium: false, ...extra });
const category = (id) => ({ id, nombre: id, tipo: "expense", color: "#123456", icono: "Home" });
const payment = (id) => ({ id, nombre: id, tipo: "pago", monto: 50, dia: 24,
  repite: "mensual", categoria: "servicios", avisoDiasAntes: 1, avisoHora: "09:00", pagados: [], creado: 1 });
const changed = (source, group, after, when) => ({
  ...replaceCloudGroup(source, group, after), syncFormat: 2,
  syncUpdatedAt: recordCloudGroupChange(source.syncUpdatedAt ?? {}, group, cloudGroupValue(source, group), after, when),
});

// Primera regresión: el código anterior sustituía la lista remota completa.
const a = data({ categoriasPropias: [category("local")], pagosProgramados: [payment("local")],
  categoryBudgets: { local: 100 }, categoryOverrides: { local: { name: "Local" } },
  budgets: { "2026-10": 1000 }, merchantLearned: { local: "local" },
  carryoverCleared: ["2026-10"], iconosFavoritos: ["Home"],
  syncUpdatedAt: { customCategories: 20, payments: 20, categoryBudgets: 20, categoryOverrides: 20,
    budgets: 20, merchants: 20, carryover: 20, favoriteIcons: 20 } });
const b = data({ categoriasPropias: [category("remota")], pagosProgramados: [payment("remoto")],
  categoryBudgets: { remota: 200 }, categoryOverrides: { remota: { name: "Remota" } },
  budgets: { "2026-09": 900 }, merchantLearned: { remoto: "remota" },
  carryoverCleared: ["2026-09"], iconosFavoritos: ["Zap"],
  syncUpdatedAt: { customCategories: 10, payments: 10, categoryBudgets: 10, categoryOverrides: 10,
    budgets: 10, merchants: 10, carryover: 10, favoriteIcons: 10 } });
const combined = mergeCloudFields(a, b);
assert.equal(combined.categoriasPropias.length, 2, "pasar a Pro conserva categorías del teléfono Y de la nube");
assert.equal(combined.pagosProgramados.length, 2, "pasar a Pro conserva ambos calendarios");
for (const field of ["categoryBudgets", "categoryOverrides", "budgets", "merchantLearned"]) {
  assert.equal(Object.keys(combined[field]).length, 2, `${field}: no sustituye un mapa entero`);
}
assert.equal(combined.carryoverCleared.length, 2);
assert.equal(combined.iconosFavoritos.length, 2);
assert.equal(mergeCloudFields(a, data({ syncUpdatedAt: { customCategories: 1000 } })).categoriasPropias.length, 1,
  "una lista ausente o vacía, sin marcas de borrado, no elimina categorías");

// No cambiar el reloj de campos no editados durante la migración.
const legacy = data({ budgets: { "2026-09": 900, "2026-10": 1000 }, syncUpdatedAt: { budgets: 10 } });
const october = changed(legacy, "budgets", { "2026-09": 900, "2026-10": 1200 }, 100);
const september = changed(legacy, "budgets", { "2026-09": 950, "2026-10": 1000 }, 80);
assert.deepEqual(plain(mergeCloudFields(october, september).budgets), { "2026-09": 950, "2026-10": 1200 });

// Ediciones independientes de un MISMO registro conservan los dos campos.
const base = mergeCloudFields(data({ categoriasPropias: [category("c")],
  categoryOverrides: { comida: { name: "Comida", color: "#000000", image: "data:image/jpeg;base64,FOTO" } },
  pagosProgramados: [payment("p")], syncUpdatedAt: { customCategories: 10, categoryOverrides: 10, payments: 10 } }), data());
const renamed = changed(base, "customCategories", [{ ...category("c"), nombre: "Nuevo nombre" }], 100);
const recolored = changed(base, "customCategories", [{ ...category("c"), color: "#ffffff" }], 90);
const both = mergeCloudFields(renamed, recolored);
assert.equal(both.categoriasPropias[0].nombre, "Nuevo nombre");
assert.equal(both.categoriasPropias[0].color, "#ffffff");
const photoMissing = { ...base, categoryOverrides: { comida: { name: "Comida", color: "#000000" } } };
assert.equal(mergeCloudFields(base, photoMissing).categoryOverrides.comida.image, "data:image/jpeg;base64,FOTO",
  "quitar fotos de una copia grande no borra la foto local");
const photoDeleted = changed(base, "categoryOverrides", { comida: { name: "Comida", color: "#000000" } }, 110);
assert.equal(mergeCloudFields(photoDeleted, base).categoryOverrides.comida.image, undefined,
  "una eliminación expresa sí quita la foto aunque el otro teléfono tenga la vieja");

// Un borrado real no resucita frente a una edición posterior de OTRO elemento.
for (const [group, oldValue, deletedValue, staleValue] of [
  ["customCategories", [category("c")], [], [category("c"), category("otra")]],
  ["payments", [payment("p")], [], [payment("p"), payment("otro")]],
  ["categoryOverrides", { comida: { name: "Comida" } }, {}, { comida: { name: "Comida" }, otra: { name: "Otra" } }],
  ["categoryBudgets", { comida: 100 }, {}, { comida: 100, otra: 200 }],
  ["carryover", ["2026-09"], [], ["2026-09", "2026-10"]],
  ["favoriteIcons", ["Home"], [], ["Home", "Zap"]],
  ["merchants", { viejo: "comida" }, {}, { viejo: "comida", nuevo: "otra" }],
]) {
  const original = mergeCloudFields(replaceCloudGroup(data(), group, oldValue), data());
  const deleted = changed(original, group, deletedValue, 100);
  const stale = changed(original, group, staleValue, 200);
  const result = cloudGroupValue(mergeCloudFields(deleted, stale), group);
  assert.equal(Array.isArray(result) ? result.length : Object.keys(result).length, 1,
    `${group}: solo queda el elemento añadido; no revive el borrado`);
  assert.deepEqual(plain(cloudGroupValue(mergeCloudFields(deleted, original), group)), deletedValue);
}
const removedCategory = changed(base, "customCategories", [], 100);
assert.equal(mergeCloudFields(removedCategory, data({ categoriasPropias: [category("c")],
  syncUpdatedAt: { customCategories: 9999 } })).categoriasPropias.length, 0,
  "un formato antiguo con solo fecha de bloque no puede demostrar una recreación");
const recreatedCategory = changed(removedCategory, "customCategories", [category("c")], 200);
assert.equal(mergeCloudFields(recreatedCategory, removedCategory).categoriasPropias.length, 1, "recrear expresamente sí vuelve a añadir");
const lateEdit = changed(base, "customCategories", [{ ...category("c"), nombre: "Editado sin conocer el borrado" }], 200);
assert.equal(mergeCloudFields(removedCategory, lateEdit).categoriasPropias.length, 0, "editar una copia vieja no recrea una categoría borrada");

// Meses pagados/enlaces se unen independientemente y se respeta desmarcar.
const octoberPaid = changed(base, "payments", [{ ...payment("p"), pagados: ["2026-10"], movimientos: { "2026-10": 10 } }], 100);
const novemberPaid = changed(base, "payments", [{ ...payment("p"), pagados: ["2026-11"], movimientos: { "2026-11": 11 } }], 90);
const months = mergeCloudFields(octoberPaid, novemberPaid);
assert.deepEqual(plain(months.pagosProgramados[0].pagados), ["2026-10", "2026-11"]);
assert.deepEqual(plain(months.pagosProgramados[0].movimientos), { "2026-10": 10, "2026-11": 11 });
const unmarked = changed(months, "payments", [{ ...months.pagosProgramados[0], pagados: ["2026-11"] }], 200);
assert.deepEqual(plain(mergeCloudFields(unmarked, months).pagosProgramados[0].pagados), ["2026-11"]);
assert.equal(mergeCloudFields(unmarked, months).pagosProgramados[0].movimientos["2026-10"], 10,
  "desmarcar un pago no borra su gasto ni su enlace");

// Empates convergen, con un reloj atrasado se avanza desde el observado.
const tieA = changed(base, "customCategories", [{ ...category("c"), nombre: "A" }], 100);
const tieB = changed(base, "customCategories", [{ ...category("c"), nombre: "B" }], 100);
assert.deepEqual(plain(mergeCloudFields(tieA, tieB)), plain(mergeCloudFields(tieB, tieA)), "empates no cambian según orden de llegada");
assert.deepEqual(plain(mergeCloudFields(both, both)), plain(both), "recibir la misma copia es idempotente");
const slowClock = changed(tieA, "customCategories", [{ ...category("c"), nombre: "Después" }], 1);
assert.ok(slowClock.syncUpdatedAt.customCategories > tieA.syncUpdatedAt.customCategories);
assert.equal(mergeCloudFields(slowClock, tieA).categoriasPropias[0].nombre, "Después");
assert.throws(() => recordCloudGroupChange({ profile: Number.MAX_SAFE_INTEGER }, "budgets", {}, { mes: 10 }, 1), /sync-clock-overflow/);
const localPhoto = "data:image/jpeg;base64,NO_SUBIR";
const noPhotoMetadata = changed(data({ iconosFavoritos: [localPhoto, "Home"] }), "favoriteIcons", [localPhoto, "Zap"], 100);
assert.equal(JSON.stringify(noPhotoMetadata.syncUpdatedAt).includes("NO_SUBIR"), false, "no sube la foto escondida dentro de las marcas");
assert.throws(() => mergeCloudFields(data({ categoriasPropias: [category("c"), category("c")] }), data()),
  /cloud-field-duplicate-id/, "los IDs duplicados se rechazan, no se pisotean silenciosamente");

// Extrae y ejecuta las rutas reales del contexto, incluyendo una respuesta
// que llega ANTES del siguiente dibujado después de editar o borrar.
const source = ts.createSourceFile("context.tsx", read("contexts/AppDataContext.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function code(name, ast = source) {
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) {
      found = `const ${name} = ${node.initializer.arguments[0].getText(ast)};`;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, name);
  return ts.transpile(found.replace(/^export\s+/, ""), { target: ts.ScriptTarget.ES2022 });
}
const scope = { ...exports, ...coordinator, auth: { currentUser: { uid: "test" } }, cloudFieldsRef: { current: a }, cloudSyncMetaRef: { current: a.syncUpdatedAt },
  setCloudSyncMeta() {}, setRespaldoFallo() {}, userEmail: "test@example.com", userCountry: "PE",
  saveJSON() {}, STORAGE_KEYS: {}, getFavoritos: () => [], ready: true, hasOnboarded: true,
};
for (const name of ["setUserName", "setUserPhoto", "setUserCurrency", "setUserLanguage", "setBudgets", "setCategoryBudgets",
  "setPagosProgramados", "setMerchantLearned", "saveOverrides", "setCategoryOverridesState", "savePropias", "setCategoriasPropiasState",
  "setCarryoverCleared", "saveFavoritos", "setIconosFavoritosState"]) scope[name] = () => {};
vm.createContext(scope);
vm.runInContext(code("markCloudGroup") + code("applyNewerCloudFields"), scope);
vm.runInContext('markCloudGroup("customCategories", [], () => []); applyNewerCloudFields(incoming);',
  Object.assign(scope, { incoming: b }));
assert.deepEqual(plain(scope.cloudFieldsRef.current.categoriasPropias).map((c) => c.id), ["remota"],
  "la recepción respeta un borrado local todavía no dibujado y añade la categoría remota");
const enqueued = [];
scope.STORAGE_KEYS = { budgets: "budgets", cloudSyncMeta: "metadata" };
scope.saveJSON = (key, value) => enqueued.push({ key, value: plain(value) });
vm.runInContext('markCloudGroup("budgets", {}, (before) => ({ ...before, "2026-11": 1100 }));', scope);
assert.equal(enqueued.find((write) => write.key === "budgets").value["2026-11"], 1100,
  "un presupuesto queda encolado antes de dibujar o cerrar sesión");
assert.ok(enqueued.some((write) => write.key === "metadata" && write.value.budgets > 20),
  "sus marcas de edición se encolan en el mismo gesto");
scope.cloudFieldsRef.current = { ...a, iconosFavoritos: [localPhoto] };
scope.cloudSyncMetaRef.current = a.syncUpdatedAt;
scope.saveFavoritos = (values) => { scope.favorites = values; };
scope.getFavoritos = () => scope.favorites;
vm.runInContext("applyNewerCloudFields(incoming);", scope);
assert.ok(scope.cloudFieldsRef.current.iconosFavoritos.includes(localPhoto), "recibir favoritos no quita fotos locales");
assert.equal(scope.cloudFieldsRef.current.pagosProgramados.length, 2);

const profileScope = { ...exports, userName: "Ana", userPhoto: null, userCurrency: "PEN", userLanguage: "es",
  userCountry: "PE", userEmail: "test@example.com", STORAGE_KEYS: { profile: "profile" },
  markCloudGroup: (_group, before, update) => update(before),
  saveJSON: (_key, saved) => { profileScope.saved = saved; },
};
for (const [setter, field] of [["setUserName", "userName"], ["setUserPhoto", "userPhoto"],
  ["setUserCurrency", "userCurrency"], ["setUserLanguage", "userLanguage"], ["setUserCountry", "userCountry"]]) {
  profileScope[setter] = (value) => { profileScope[field] = value; };
}
vm.createContext(profileScope);
vm.runInContext(code("markCloudProfile") + code("persistCloudProfile") + code("setInitialCountry"), profileScope);
profileScope.setInitialCountry("CL", "es", "CLP");
assert.equal(profileScope.saved.hasOnboarded, false, "elegir país no termina el setup");
assert.equal(profileScope.saved.userCurrency, "CLP");
assert.equal(profileScope.saved.userCountry, "CL");

// Las dos rutas de escritura reales (lista antigua e historial v2) y la
// restauración se ejecutan con una red aislada en memoria.
// esbuild asigna module.exports al empaquetar estos auxiliares reales.
const txScope = { module: { exports: {} } };
vm.runInNewContext(buildSync({ entryPoints: ["utils/mergeTransactions.ts"], bundle: true,
  platform: "node", format: "cjs", write: false, alias: { "@": process.cwd() } }).outputFiles[0].text, txScope);
const helpers = txScope.module.exports;
const cloudAst = ts.createSourceFile("cloud.ts", read("utils/cloudSync.ts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const cloudCode = ["conservarPremiumManual", "pesa", "sinFotos", "motivoLegible", "saveCloudData", "saveCloudDataV2"]
  .map((name) => code(name, cloudAst)).join("\n");
const transaction = (id) => ({ id, updatedAt: id, type: "expense", amount: 50,
  category: "servicios", date: "2026-10-05", method: "cash", description: "Pago", notes: "" });
function noUndefined(value) {
  assert.notEqual(value, undefined, "Firestore no admite undefined ni dentro de mapas o listas");
  if (value && typeof value === "object") Object.values(value).forEach(noUndefined);
}
for (const historyFormat of [1, 2]) {
  let stored = { ...b, isPremium: true, transactions: [transaction(2)] };
  if (historyFormat === 2) { stored.historyFormat = 2; delete stored.transactions; }
  const snap = () => ({ exists: () => true, data: () => structuredClone(stored) });
  const cloudScope = {
    ...exports, ...helpers, ...coordinator, db: {}, doc: () => "isolated-user", getDoc: async () => snap(),
    hasUnreadableLocalData: () => false, utf8ByteLength: (text) => Buffer.byteLength(text, "utf8"),
    assertLegacyHistoryFormat: (raw) => { if (raw?.historyFormat === 2) throw new Error("not-legacy"); },
    UnsupportedHistoryFormatError: class extends Error {},
    LIMITE_FIRESTORE: 1_000_000, TOPE_SEGURO: 800_000,
    runTransaction: async (_db, run) => { await run({ get: async () => snap(), set: (_ref, next) => { noUndefined(next); stored = plain(next); } }); },
    saveHistoryV2: async (_uid, rows, deletes) => ({ transactions: helpers.mergeTransactions(rows, [transaction(2)]), deletedIds: deletes }),
  };
  vm.createContext(cloudScope);
  vm.runInContext(cloudCode, cloudScope);
  const result = await cloudScope.saveCloudData("test", { ...a, transactions: [transaction(1)] });
  assert.equal(result.ok, true, `subida real formato ${historyFormat}`);
  assert.equal(stored.categoriasPropias.length, 2);
  assert.equal(stored.pagosProgramados.length, 2);
  assert.equal(result.data.transactions.length, 2);
  assert.equal(stored.isPremium, true, "no se sobrescribe la concesión del servidor con un false local");
  assert.equal(stored.syncFormat, 2);
  if (historyFormat === 2) assert.equal("transactions" in stored, false, "el historial v2 no vuelve a incrustar la lista");
  const fullPhoto = { ...a, categoriasPropias: [{ ...category("foto"), image: `data:image/jpeg;base64,${"A".repeat(820_000)}` }] };
  const compacted = await cloudScope.saveCloudData("test", fullPhoto);
  assert.equal(compacted.ok, true, "una foto grande no bloquea el respaldo ni envía undefined");
  assert.equal(stored.categoriasPropias.find((c) => c.id === "foto").image, undefined);
  const rejected = await cloudScope.saveCloudData("test", { ...a,
    categoriasPropias: [{ ...category("texto"), nombre: "A".repeat(1_000_000) }] });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.motivo, "demasiado-grande");
  assert.ok(stored.categoriasPropias.some((c) => c.id === "foto"), "rechazar un respaldo grande conserva lo último confirmado");
}

const localHydrate = { ...a, transactions: [transaction(1), transaction(3)], deletedTransactionIds: [3],
  iconosFavoritos: [localPhoto, "Home"] };
const remoteHydrate = { ...b, isPremium: true, transactions: [transaction(2), transaction(3)] };
const hydrateScope = { ...exports, ...helpers, ...coordinator, setRespaldoFallo() {}, auth: { currentUser: { uid: "test" } }, localSessionVersion: { current: 1 },
  cloudFieldsRef: { current: localHydrate }, cloudSyncMetaRef: { current: a.syncUpdatedAt },
  tRef: { current: (key) => key }, loadCloudData: async () => remoteHydrate,
  CloudPremiumRequiredError: class extends Error {}, userCountry: "PE", userEmail: "test@example.com", pruebaInicio: null,
  countryById: () => ({ id: "PE", currency: "PEN" }), countryFor: () => ({ id: "PE" }),
  saveJSON() {}, STORAGE_KEYS: {}, savePrueba() {}, protectExistingIds() {},
  bajarNegocio: async () => null, saveOverrides() {}, savePropias() {}, saveFavoritos() {},
};
for (const [setter, field] of [["setUserName", "userName"], ["setUserPhoto", "userPhoto"], ["setUserCurrency", "userCurrency"],
  ["setUserLanguage", "userLanguage"], ["setUserCountry", "userCountry"], ["setBudgets", "budgets"],
  ["setCategoryBudgets", "categoryBudgets"], ["setTransactions", "transactions"], ["setDeletedTransactionIds", "deletedTransactionIds"],
  ["setGoals", "goals"], ["setDeletedGoalIds", "deletedGoalIds"], ["setPagosProgramados", "pagosProgramados"],
  ["setIsPremium", "isPremium"], ["setPruebaInicio", "pruebaInicio"], ["setMerchantLearned", "merchantLearned"],
  ["setCategoryOverridesState", "categoryOverrides"], ["setCategoriasPropiasState", "categoriasPropias"],
  ["setIconosFavoritosState", "iconosFavoritos"], ["setCarryoverCleared", "carryoverCleared"],
  ["setCloudSyncMeta", "cloudSyncMeta"], ["setHasOnboarded", "hasOnboarded"]]) {
  hydrateScope[setter] = (value) => { hydrateScope[field] = value; };
}
vm.createContext(hydrateScope);
vm.runInContext(code("hydrateFromCloud"), hydrateScope);
assert.equal(await hydrateScope.hydrateFromCloud("test"), "restored");
assert.equal(hydrateScope.categoriasPropias.length, 2, "la restauración real conserva ambas listas");
assert.equal(hydrateScope.pagosProgramados.length, 2);
assert.deepEqual(plain(hydrateScope.transactions).map((tx) => tx.id), [2, 1], "une movimientos y no resucita los borrados");
assert.equal(hydrateScope.isPremium, true);
assert.ok(hydrateScope.iconosFavoritos.includes(localPhoto));
const beforeInvalid = plain(scope.cloudFieldsRef.current);
scope.incoming = data({ categoriasPropias: [category("c"), category("c")] });
assert.equal(vm.runInContext("applyNewerCloudFields(incoming);", scope), false,
  "una respuesta inválida también detiene la aplicación de sus movimientos");
assert.deepEqual(plain(scope.cloudFieldsRef.current), beforeInvalid, "una respuesta inválida no modifica ni borra datos");

// Un temporizador creado por un dibujado viejo no mezcla valores antiguos
// con las marcas de una edición nueva, aunque dispare antes de redibujar.
const favoritesAst = ts.createSourceFile("favorites.ts", read("utils/iconosFavoritos.ts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const paymentsAst = ts.createSourceFile("payments.ts", read("utils/calendarioPagos.ts"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const builderScope = { ...exports, ...a, deletedTransactionIds: [], deletedGoalIds: [],
  isPremiumDeLaCuenta: false, pruebaInicio: null, ready: true,
  cloudFieldsRef: { current: { ...a, iconosFavoritos: [localPhoto, "Home"],
    pagosProgramados: [{ ...payment("local"), icono: localPhoto }] } },
  cloudSyncMetaRef: { current: a.syncUpdatedAt }, MAX_FAVORITOS: 30,
  setCloudSyncMeta() {}, saveJSON() {}, STORAGE_KEYS: {},
};
vm.createContext(builderScope);
vm.runInContext([code("esFoto", favoritesAst), code("limpiar", favoritesAst), code("paraLaNube", favoritesAst),
  code("pagosParaLaNube", paymentsAst), code("datosParaLaNube"), code("markCloudGroup")].join("\n"), builderScope);
builderScope.markCloudGroup("budgets", a.budgets, (current) => ({ ...current, "2026-10": 500 }));
const outgoing = builderScope.datosParaLaNube();
assert.equal(outgoing.budgets["2026-10"], 500, "la subida inmediata no usa el presupuesto viejo del dibujado anterior");
assert.ok(outgoing.syncUpdatedAt.budgets > 20);
assert.equal(JSON.stringify(outgoing.iconosFavoritos).includes("NO_SUBIR"), false);
assert.equal(outgoing.pagosProgramados[0].icono, undefined, "también limpia fotos al armar desde la referencia reciente");
assert.equal(builderScope.datosParaLaNube(true).budgets["2026-10"], 1000, "la captura de React sigue leyendo sus propios datos al actualizar la referencia");

const onboarding = read("app/onboarding.tsx");
assert.match(onboarding, /await openLocalAccount\(user.uid, user.email\)/, "Google desde bienvenida abre la copia de su propia cuenta antes de Firebase");
assert.match(onboarding, /if \(restoredLocal\)/, "una copia local recuperada no se reemplaza por una nube antigua");
console.log("Gratis → Pro: unión real por elemento, borrados, fotos, meses, ediciones y respuestas pendientes comprobados.");

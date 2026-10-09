import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Lógica original, solo red/almacenamiento/cola nativa adaptados. No Firebase
// real ni datos de usuario; tarjetas no se cargan. La regresión debe fallar
// por interpretar el formato desconocido, no por ausencia de un export nuevo.
const read = createSourceReader({ revision: process.env.FINO_TEST_FORMAT_BARRIER_BASELINE ?? "" });
const local = { hasOnboarded: true, userName: "Ana", userPhoto: null, userCurrency: "PEN", userLanguage: "es",
  budgets: {}, categoryBudgets: {}, transactions: [], goals: [], isPremium: true };
let remote, writes, historyReads, historyWrites, afterInitialRead;
const copy = value => JSON.parse(JSON.stringify(value));
const snap = value => ({ exists: () => value !== null, data: () => copy(value) });
const reset = data => { remote = copy(data); writes = []; historyReads = 0; historyWrites = 0; afterInitialRead = null; };
const sdk = {
  doc: (_db, ...path) => path.join("/"), collection: (_db, ...path) => path.join("/"),
  getDoc: async () => { const snapshot = snap(remote); afterInitialRead?.(); return snapshot; },
  getDocs: async () => ({ docs: [], empty: true }),
  runTransaction: async (_db, work) => work({
    get: async path => path.split("/").length === 2 ? snap(remote) : snap(null),
    set: (path, value) => { writes.push([path, copy(value)]); if (path.split("/").length === 2) remote = copy(value); },
  }),
  serverTimestamp: () => "SERVER_TIME", Timestamp: class {},
};
const queue = {
  PrivateBoxSyncError: class extends Error {},
  withPrivateBoxCloudOperation: async (_uid, work) => work({ wait: work => work(), remember: value => value, assertCurrent() {} }),
  withPrivateBoxCloudLease: async (_uid, _lease, work) => work({ wait: work => work(), remember: value => value, assertCurrent() {} }),
};
const cache = new Map();
function load(file, overrides = {}) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  vm.runInNewContext(ts.transpile(read(file), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
    exports, require: name => {
      if (overrides[name]) return overrides[name];
      if (name === "firebase/firestore") return sdk;
      if (name === "@/utils/firebase") return { db: {} };
      if (name === "@/utils/storage") return { hasUnreadableLocalData: () => false };
      if (name === "@/utils/privateBoxSync") return queue;
      if (name === "@/utils/cloudAccountAccess") return { getCloudAccountAccess: async () => ({ canSync: true, hasCloudCopy: true }) };
      if (name === "@/utils/cloudHistoryV2") return {
        loadHistoryV2: async () => { historyReads++; return { transactions: [], deletedIds: [] }; },
        saveHistoryV2: async (_uid, transactions, deletedIds) => { historyWrites++; return { transactions, deletedIds }; },
      };
      if (/^@\/utils\/(cloudNegocio|cloudCajas|cloudFamilia|cloudCajasCompartidas|creditCloud)$/.test(name)) return {};
      assert.ok(name.startsWith("@/"), `dependencia no adaptada ${name}`);
      return load(`${name.slice(2)}.ts`);
    },
  });
  return exports;
}
const cloud = load("utils/cloudSync.ts");
for (const historyFormat of [1, 2]) {
  // Las cuentas históricas y la revisión conocida siguen funcionando.
  for (const recordIdentityFormat of [undefined, 1]) {
    reset({ ...local, historyFormat, recordIdentityFormat });
    if (historyFormat === 2) { delete remote.transactions; delete remote.deletedTransactionIds; }
    assert.equal((await cloud.loadCloudData("fixture")).userName, "Ana");
    assert.equal((await cloud.saveCloudData("fixture", local)).ok, true);
    assert.equal(remote.recordIdentityFormat, 1);
  }
  for (const recordIdentityFormat of [2, "1", null, false, 0]) {
    reset({ ...local, historyFormat, recordIdentityFormat });
    const original = copy(remote), before = JSON.stringify(remote);
    const expectedCode = typeof recordIdentityFormat === "number" && recordIdentityFormat > 1
      ? "cloud/history-format-unsupported" : "cloud/record-identity-invalid";
    const expectedReason = expectedCode === "cloud/history-format-unsupported" ? "actualizacion-necesaria" : "datos-nube-invalidos";
    await assert.rejects(cloud.loadCloudData("fixture"), error => error.code === expectedCode,
      "un formato desconocido no se disfraza de copia vacía ni se devuelve sin su marcador");
    assert.equal(historyReads, 0, "rechazar antes de descargar el historial");
    const result = await cloud.saveCloudData("fixture", local);
    assert.equal(result.ok, false);
    assert.equal(result.motivo, expectedReason);
    assert.equal(historyWrites, 0);
    assert.deepEqual(writes, []);
    assert.equal(JSON.stringify(remote), before);
    assert.deepEqual(remote, original);
  }
}
for (const recordIdentityFormat of [2, "1", null, false, 0]) {
  reset(local);
  const input = { ...local, recordIdentityFormat }, before = JSON.stringify(input);
  const result = await cloud.saveCloudData("fixture", input);
  assert.equal(result.ok, false, "validar también la entrada antes de cambiarle el marcador a 1");
  assert.equal(result.motivo, typeof recordIdentityFormat === "number" && recordIdentityFormat > 1 ? "actualizacion-necesaria" : "datos-nube-invalidos");
  assert.deepEqual(writes, []);
  assert.equal(historyWrites, 0);
  assert.equal(JSON.stringify(input), before);
}
// El formato puede cambiar entre la consulta inicial y la transacción.
reset({ ...local, recordIdentityFormat: 1 });
afterInitialRead = () => { remote = { ...remote, recordIdentityFormat: 2 }; };
assert.equal((await cloud.saveCloudData("fixture", local)).ok, false);
assert.deepEqual(writes, []);
assert.equal(remote.recordIdentityFormat, 2, "no rebajar la copia recién cambiada");
// También se revalida en la transacción de metadatos v2; no anuncia éxito
// si hubo un cambio posterior al control inicial. No prueba lote multi-fila.
reset({ ...local, historyFormat: 2, recordIdentityFormat: 1 });
afterInitialRead = () => { remote = { ...remote, recordIdentityFormat: 2 }; };
assert.equal((await cloud.saveCloudData("fixture", local)).ok, false);
assert.deepEqual(writes, []);
assert.equal(remote.recordIdentityFormat, 2);

// Guardado original por fila, con SDK adaptado: una raíz incompatible corta
// antes de escribir la fila aunque el llamador ya preparara el cambio.
const history = load("utils/cloudHistoryV2.ts");
reset({ ...local, historyFormat: 2, recordIdentityFormat: 2 });
const identified = { id: 7, creationId: "origen-B", updatedAt: 10, type: "expense", amount: 10,
  category: "otros", date: "2026-10-09", method: "cash", description: "Fixture", notes: "" };
await assert.rejects(history.saveHistoryV2("fila-incompatible", [identified], []), error => error.code === "cloud/history-format-unsupported");
assert.deepEqual(writes, []);

const importer = load("utils/importCommit.ts"), migration = load("utils/cloudHistoryMigration.ts");
const before = JSON.stringify(identified);
for (const proof of [{ creationId: "B" }, { captureId: "captura-B" }, { internalTransferLink: "aporte-B" }]) {
  const row = { ...identified, creationId: undefined, ...proof };
  assert.throws(() => importer.applyImportedTransactions([], [row], [], [row.id]), /record-origin-conflict/);
  assert.throws(() => migration.stageLegacyHistory([row], [row.id]), /record-origin-conflict/);
}
// Importación sin contradicción/edición del mismo origen siguen disponibles.
const added = importer.applyImportedTransactions([], [identified], [], []);
assert.equal(added.count, 1);
assert.equal(added.transactions[0].creationId, "origen-B");
assert.equal(importer.applyImportedTransactions([identified], [identified], [], []).count, 0);
assert.equal(importer.applyImportedTransactions([identified], [], [{ ...identified, amount: 20 }], []).transactions[0].amount, 20);
assert.equal(migration.stageLegacyHistory([identified], []).length, 1);
assert.equal(JSON.stringify(identified), before);
const catalog = load("constants/i18n.ts").translations;
for (const language of ["es", "en", "pt"]) assert.ok(catalog[language]["settings.backupUpdateRequired"]);
assert.ok(read("screens/Settings.tsx").includes('respaldoFallo === "actualizacion-necesaria"'));
console.log("Originales/IO adaptado: formatos desconocidos rechazados en lectura/entrada/transacciones/fila; copias intactas, formatos históricos y operaciones normales válidos. Importación/migración no descartan un alta identificada frente a una marca dudosa. Mensajes verificados estáticamente; Android, mínimo de servidor y protocolo de borrados pendientes.");

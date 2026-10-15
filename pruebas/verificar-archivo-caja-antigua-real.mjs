import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_BOX_ARCHIVE_BASELINE || "" });
const js = value => ts.transpile(value, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
const requireCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  vm.runInNewContext(js(read(file)), { module, exports: module.exports, Error, Date, require: name => name.startsWith("@/")
    ? load(name.slice(2) + ".ts") : requireCore(name === "./utf8" ? "./utf8.ts" : name) });
  cache.set(file, module.exports); return module.exports;
}
const screenFile = "screens/Cajas.tsx", screen = read(screenFile);
const box = { id: "caja-hj", nombre: "hj", creadaEn: 1 };
const other = { id: "caja-nueva", nombre: "Nueva", creadaEn: 2 };
const moves = [11, 12].map(id => ({ id: `mov-${id}`, cajaId: box.id, tipo: "ingreso", monto: 10,
  descripcion: "hj", fecha: "2026-10-02", creadoEn: id, personalTransactionId: id }));
moves.push({ ...moves[0], id: "mov-return", tipo: "gasto", monto: 10, personalReturnAmount: 10, personalTransactionId: 13 });
moves.push({ id: "mov-externo", cajaId: box.id, tipo: "ingreso", monto: 10, descripcion: "Dinero externo", fecha: "2026-10-02", creadoEn: 14 });
const data = { cajas: [box, other], movimientos: moves, cajasBorradas: [], movimientosBorrados: [] };
const personalRows = [{ id: 900, type: "income", amount: 50, date: "2026-10-02", description: "Conservar" }];
const deleted = [11, 12, 13];

// Primero el síntoma anterior: Cerrar ofrecía solo saldo cero, sin salida
// reversible para una Caja pendiente. La regresión falla por comportamiento.
{
  let offers = 0;
  const scope = { caja: box, ready: true, movimientos: moves, cajaNecesitaRevision: () => true,
    confirmarArchivoCaja: () => offers++, canCloseLinkedSpace: () => false, showToast() {}, t: key => key };
  handlerOriginal(screenFile, "cerrarCajaActual", scope, screen)();
  assert.equal(offers, 1, "Cerrar una Caja dudosa ofrece conservarla en historial, no exige una devolución imposible");
}

const boxes = load("utils/cajas.ts"), repairs = load("utils/privateBoxRepair.ts"), reservations = load("utils/privateBoxMoneyLocalWrite.ts");
const sourceJson = JSON.stringify(data);
const archived = repairs.planPrivateBoxArchive(data, box.id, true);
assert.equal(boxes.saldoCaja(box.id, archived.movimientos), 20);
assert.deepEqual(archived.movimientos, data.movimientos);
assert.equal(JSON.stringify(data), sourceJson, "no modifica la fuente al preparar");
assert.equal(repairs.planPrivateBoxRepair(archived, personalRows, deleted, "A").conflicts.length, 3, "archivar no finge resolver las referencias dudosas");
repairs.validatePrivateBoxRepair(data, archived, personalRows, deleted, [], [], "A", { from: "archive", boxId: box.id, archived: true });
for (const forged of [
  { ...archived, movimientos: archived.movimientos.slice(1) },
  { ...archived, movimientos: archived.movimientos.map(row => ({ ...row, monto: 999 })) },
  { ...archived, cajasBorradas: [box.id] },
  { ...archived, cajas: archived.cajas.map(row => ({ ...row, nombre: "otro" })) },
]) assert.throws(() => repairs.validatePrivateBoxRepair(data, forged, personalRows, deleted, [], [], "A", { from: "archive", boxId: box.id, archived: true }), /repair-conflict/);
assert.throws(() => repairs.validatePrivateBoxRepair(data, archived, personalRows, deleted, personalRows, [], "A", { from: "archive", boxId: box.id, archived: true }), /repair-conflict/);
assert.throws(() => repairs.validatePrivateBoxRepair(data, archived, personalRows, deleted, [], deleted, "A", { from: "archive", boxId: box.id, archived: true }), /repair-conflict/);
assert.throws(() => repairs.planPrivateBoxArchive({ ...data, cajas: [{ ...box, sharingPending: true }] }, box.id, true), /archive-unavailable/);
assert.throws(() => repairs.planPrivateBoxArchive({ ...data, revisionesImporte: [{ estado: "pendiente" }] }, box.id, true), /archive-unavailable/);
assert.throws(() => boxes.validarCajas({ ...data, cajas: [{ ...box, archivadaLocal: "yes" }] }), /invalid-data/);
const restored = repairs.planPrivateBoxArchive(archived, box.id, false);
assert.deepEqual(plain(restored), data, "reactivar recupera la misma Caja, sin recrear movimientos");

// Filtro original de pantalla, no un algoritmo duplicado para la prueba.
const tree = ts.createSourceFile(screenFile, screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let filter;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "cajasEnLista") filter = node.initializer.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree); assert.ok(filter);
assert.deepEqual(Array.from(vm.runInNewContext(filter, { datos: archived, verArchivadas: false, cajasOcultas: new Set() }), row => row.id), [other.id]);
assert.deepEqual(Array.from(vm.runInNewContext(filter, { datos: archived, verArchivadas: true, cajasOcultas: new Set() }), row => row.id), [box.id]);

// No se importa una preferencia de otro teléfono y un ACK no la retira.
assert.equal(boxes.fusionarCajas(archived, data).cajas.find(row => row.id === box.id).archivadaLocal, true);
assert.equal(boxes.fusionarCajas(data, archived).cajas.find(row => row.id === box.id).archivadaLocal, undefined);
const separate = boxes.fusionarCajasProtegidas(archived, data, [box.id]);
assert.equal(separate.local.cajas.find(row => row.id === box.id).archivadaLocal, true);
assert.equal(separate.remoto.cajas.find(row => row.id === box.id).archivadaLocal, undefined);
assert.equal(JSON.stringify(separate.local.movimientos.filter(row => row.cajaId === box.id)), JSON.stringify(moves));

// Cliente de subida original con IO aislado: la preferencia del teléfono
// jamás viaja a Firebase, ni siquiera junto a una Caja protegida.
for (const protectedIds of [[], [box.id]]) {
  let transmitted;
  const cloudModule = { exports: {} };
  vm.runInNewContext(js(read("utils/cloudCajas.ts")), { module: cloudModule, exports: cloudModule.exports, Error,
    require: name => {
      if (name === "firebase/firestore") return { doc: (_db, _collection, uid) => uid,
        runTransaction: async (_db, work) => work({ get: async () => ({ exists: () => true, data: () => data }),
          set: (_ref, value) => { transmitted = plain(value); } }) };
      if (name.endsWith("/firebase")) return { db: {} };
      if (name.endsWith("/cajas")) return boxes;
      if (name.endsWith("/accountTask")) return { captureAccountTask: () => ({ current: () => true, wait: work => work() }) };
      if (name.endsWith("/storage")) return { hasUnreadableLocalData: () => false };
      if (name.endsWith("/privateBoxSync")) return { withPrivateBoxCloudOperation: (_uid, work) => work({
        assertCurrent() {}, remember: value => value }) };
      throw Error(`Dependencia inesperada: ${name}`);
    } });
  assert.equal(await cloudModule.exports.subirCajas("A", archived, undefined, undefined, protectedIds), true);
  assert.ok(transmitted.cajas.every(row => !("archivadaLocal" in row)), "no sube la preferencia local");
  assert.deepEqual(transmitted.movimientos, moves);
  assert.equal(archived.cajas[0].archivadaLocal, true, "limpiar el envío no cambia la fuente del teléfono");
}

function harness(failure = null) {
  const db = new DatabaseSync(":memory:"); db.exec("CREATE TABLE store(key TEXT PRIMARY KEY, value TEXT)");
  const get = key => db.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
  const put = (key, value) => db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value);
  let writes = 0, released;
  const gate = failure === "account" ? new Promise(resolve => { released = resolve; }) : null;
  const adapter = { getItem: async key => get(key), setItem: async (key, value) => put(key, value),
    multiGet: async keys => keys.map(key => [key, get(key)]), getAllKeys: async () => [],
    multiRemove: async () => {}, multiSet: async entries => {
      if (gate) await gate;
      db.exec("BEGIN IMMEDIATE");
      try { for (const [key, value] of entries) { put(key, value); if (failure === "rollback") throw Error("disk-full"); }
        db.exec("COMMIT"); writes++;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      if (failure === "lost-ack") throw Error("response-lost");
    } };
  const module = { exports: {} };
  vm.runInNewContext(js(read("utils/storage.ts")), { module, exports: module.exports, Error, setTimeout, clearTimeout,
    require: name => name.includes("async-storage") ? { default: adapter } : { encryptText: async value => `v2:${value}`, decryptText: async value => value.slice(3) } });
  const storage = module.exports; storage.setAccountStorageAvailable(true);
  put(storage.STORAGE_KEYS.cajasDinero, `v2:${JSON.stringify(data)}`);
  put(storage.STORAGE_KEYS.transactions, `v2:${JSON.stringify(personalRows)}`);
  put(storage.STORAGE_KEYS.deletedTransactionIds, `v2:${JSON.stringify(deleted)}`);
  let visible = data, alive = true, cloudReads = 0;
  const scope = { ...boxes, ...repairs, ...reservations, STORAGE_KEYS: storage.STORAGE_KEYS,
    ready: true, hasOnboarded: true, isPremium: true, Platform: { OS: "android" },
    auth: { currentUser: { uid: "A" } }, localSessionVersion: { current: 1 },
    captureAccountTask: () => { const version = scope.localSessionVersion.current; return { current: () => alive && scope.localSessionVersion.current === version, wait: work => work() }; },
    transactionsLive: { current: personalRows }, deletedTransactionIdsRef: { current: deleted },
    cloudSyncMetaRef: { current: {} }, currencyForReturn: { current: "PEN" },
    withLocalAccountOperation: work => work(), hasUnreadableLocalData: storage.hasUnreadableLocalData,
    saveJSONBatchNow: storage.saveJSONBatchNow,
    loadPrivateBoxRepairCloud: async () => { cloudReads++; throw Error("NO_CLOUD_FOR_LOCAL_ARCHIVE"); },
    guardarCajasEnMemoria() {}, setTransactions() { throw Error("NO_CHANGE_PERSONAL"); }, setDeletedTransactionIds() { throw Error("NO_CHANGE_DELETED"); },
  };
  const commit = handlerOriginal("contexts/AppDataContext.tsx", "commitPrivateBoxData", scope, read("contexts/AppDataContext.tsx"));
  const personalRaw = get(storage.STORAGE_KEYS.transactions), deletedRaw = get(storage.STORAGE_KEYS.deletedTransactionIds);
  return { db, get, storage, scope, commit, cloudReads: () => cloudReads, writes: () => writes, personalRaw, deletedRaw,
    visible: () => visible, apply: value => { visible = value; }, release: () => released?.(),
    changeAccount: () => { scope.localSessionVersion.current++; alive = false; storage.setAccountStorageAvailable(false); storage.setAccountStorageAvailable(true); } };
}
for (const failure of [null, "rollback", "lost-ack"]) {
  const h = harness(failure);
  try {
    const ok = await h.commit(data, archived, [], [], () => true, h.apply, { from: "archive", boxId: box.id, archived: true });
    assert.equal(ok, failure !== "rollback");
    const disk = await h.storage.loadJSON(h.storage.STORAGE_KEYS.cajasDinero, boxes.CAJAS_VACIAS);
    assert.equal(disk.cajas.find(row => row.id === box.id).archivadaLocal, ok ? true : undefined);
    assert.equal(h.visible().cajas.find(row => row.id === box.id).archivadaLocal, ok ? true : undefined, "espera el guardado antes de retirar de activas");
    assert.equal(JSON.stringify(disk.movimientos), JSON.stringify(moves));
    assert.equal(h.get(h.storage.STORAGE_KEYS.transactions), h.personalRaw, "bytes de Personal intactos");
    assert.equal(h.get(h.storage.STORAGE_KEYS.deletedTransactionIds), h.deletedRaw, "marcas antiguas intactas");
    assert.equal(h.cloudReads(), 0, "preferencia local no requiere servidor ausente");
    if (ok) {
      assert.equal(await h.commit(archived, restored, [], [], () => true, h.apply, { from: "archive", boxId: box.id, archived: false }), true);
      assert.equal(JSON.stringify(await h.storage.loadJSON(h.storage.STORAGE_KEYS.cajasDinero, boxes.CAJAS_VACIAS)), JSON.stringify(data));
    }
  } finally { h.db.close(); }
}
{
  const h = harness("account");
  try {
    const pending = h.commit(data, archived, [], [], () => true, h.apply, { from: "archive", boxId: box.id, archived: true });
    await new Promise(resolve => setTimeout(resolve, 20)); h.changeAccount(); h.release();
    assert.equal(await pending, false); assert.equal(h.visible(), data, "cambio de sesión no publica el archivo en otra cuenta");
  } finally { h.db.close(); }
}
// La confirmación original es reversible y Cancelar nunca ejecuta guardado.
{
  let proposal, applied = 0;
  const scope = { caja: box, ready: true, guardandoRef: { current: false }, cuentaActual: () => true,
    datosActuales: { current: data }, saldoCaja: boxes.saldoCaja, fmt: String, t: key => key,
    Alert: { alert: (_title, _message, options) => { proposal = options; } }, cambiarArchivoCaja: async () => applied++ };
  handlerOriginal(screenFile, "confirmarArchivoCaja", scope, screen)();
  assert.equal(applied, 0); assert.equal(proposal[0].style, "cancel");
  await proposal[1].onPress(); assert.equal(applied, 1);
}
console.log("Archivo local reversible: acciones/contexto/SQLite originales; historial y Personal intactos, filtro, regreso, fallos y sesión comprobados. Sin borrar ni reparar datos reales; Android pendiente.");

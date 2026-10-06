import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
const requireCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const requirePure = name => requireCore(name === "./utf8" ? "./utf8.ts" : name);

const baseline = process.env.FINO_TEST_INCOMPLETE_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = text => ts.transpile(text, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const module = { exports: {} };
  vm.runInNewContext(js(read(file)), { module, exports: module.exports, Error, Date,
    require: name => name.startsWith(".") ? requirePure(name) : load(name.replace("@/", "") + ".ts") });
  return cache[file] = module.exports;
}
function pick(file, predicate) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found;
  function visit(node) { if (!found && predicate(node, tree)) found = node; if (!found) ts.forEachChild(node, visit); }
  visit(tree); assert.ok(found); return { node: found, tree };
}
const api = load("utils/privateBoxRepair.ts");
const box = { id: "caja-a", nombre: "Viaje", creadaEn: 1 };
const move = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-06", creadoEn: 2, personalTransactionId: 10 };
const tx = { id: 10, type: "expense", amount: 100, date: move.fecha, category: "otros", description: "Aporte", notes: "Conservar", internalTransfer: "box", internalTransferLink: move.id, internalTransferSpaceId: box.id, internalTransferSpaceName: box.nombre };
const data = { cajas: [box], movimientos: [move], cajasBorradas: [], movimientosBorrados: [] };
const closed = { ...data, cajasBorradas: [box.id] };
const effect = pick("screens/Cajas.tsx", (node, tree) => ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect" && node.arguments[0]?.getText(tree).includes("const prior = reparacionIntentada"));
function auto(original, rows) {
  const writes = [], plan = api.planPrivateBoxRepair(original, rows, [], "a");
  const scope = { cuentaActual: () => true, personalReady: true, hasOnboarded: true, ready: true, cloudReady: true, guardando: false, isPremium: false,
    accountUid: "a", nubeConfirmadaPara: { current: null }, guardandoRef: { current: false }, compartiendo: false, hasUnreadableLocalData: () => false,
    repairPlan: plan, reparacionIntentada: { current: null }, datos: original, transactions: rows, refreshVersion: 0,
    guardarCambioCaja: (...args) => writes.push(args) };
  vm.runInNewContext(js(`globalThis.run = (${effect.node.arguments[0].getText(effect.tree)});`), scope); scope.run(); return { writes, plan };
}
const regressionCase = process.env.FINO_TEST_INCOMPLETE_CASE;
if (regressionCase && !["date", "allocations"].includes(regressionCase)) throw Error("Caso de regresión desconocido.");
if (regressionCase === "date") assert.equal(auto({ ...data, movimientos: [{ ...move, fecha: "2026-02-30" }] }, []).writes.length, 0, "una fecha inexistente no se reconstruye en Personal");
if (regressionCase === "allocations") {
  const returned = { ...move, id: "mov-return", tipo: "gasto", monto: 40, personalReturnAmount: 40, personalTransactionId: 11, creadoEn: 3 };
  const original = { ...data, movimientos: [move, returned] };
  const rows = [tx, { ...tx, id: 11, type: "income", amount: 40, internalTransferLink: returned.id, internalTransferAllocations: {} }];
  assert.doesNotThrow(() => auto(original, rows), "un reparto dañado no debe impedir abrir Cajas");
  assert.equal(auto(original, rows).writes.length, 0);
}
assert.equal(auto(closed, []).writes.length, 0, "una Caja cerrada con restos antiguos no debe reconstruir Personal como abierta");
assert.ok(auto(closed, []).plan.conflicts.length);

const receipt = { uid: "a", sourceId: box.id, targetId: `a_${box.id}`, name: box.nombre, currency: "PEN", createdAt: 1, completedAt: 2, digest: "a".repeat(64), links: [{ personalId: tx.id, movementId: move.id }] };
const converted = { ...data, syncFormat: 3, conversiones: { [box.id]: receipt } };
assert.equal(auto(converted, []).writes.length, 0, "una copia privada residual no se reabre después de convertirla");
assert.equal(auto(data, []).plan.upserts[0].amount, 100, "un ID exacto válido y abierto mantiene la recuperación ya comprobada");

for (const fields of [{ monto: 0.0001 }, { monto: NaN }, { monto: Infinity }, { fecha: "2026-02-30" }, { fecha: "06/10/2026" }]) {
  const original = { ...data, movimientos: [{ ...move, ...fields }] }, before = JSON.stringify(original);
  const result = auto(original, []);
  assert.equal(result.writes.length, 0); assert.ok(result.plan.conflicts.length);
  assert.equal(result.plan.data, original); assert.equal(JSON.stringify(original), before);
}
const returnedMove = { ...move, id: "mov-return", tipo: "gasto", monto: 40, personalReturnAmount: 40, personalTransactionId: 11, creadoEn: 3 };
const returnedTx = { ...tx, id: 11, type: "income", amount: 40, internalTransferLink: returnedMove.id };
const returning = { ...data, movimientos: [move, returnedMove] };
for (const allocations of [{}, "40", [{ transactionId: 10, amount: NaN }], [{ transactionId: 10, amount: 0.0001 }], [{ transactionId: 10, amount: 20 }, { transactionId: 10, amount: 20 }]]) {
  assert.doesNotThrow(() => auto(returning, [tx, { ...returnedTx, internalTransferAllocations: allocations }]), "un reparto dañado no debe romper la pantalla");
  assert.ok(auto(returning, [tx, { ...returnedTx, internalTransferAllocations: allocations }]).plan.conflicts.length);
  assert.equal(auto(returning, [tx, { ...returnedTx, internalTransferAllocations: allocations }]).writes.length, 0);
}
const unlinkedReturn = { ...returning, movimientos: [move, { ...returnedMove, personalTransactionId: undefined }] };
assert.ok(auto(unlinkedReturn, [tx]).plan.conflicts.length, "una devolución sin ID o mitad Personal requiere revisión, no reparto inferido");
assert.equal(auto(unlinkedReturn, [tx]).writes.length, 0);
const exactUnlinked = auto(unlinkedReturn, [tx, returnedTx]);
assert.equal(exactUnlinked.plan.conflicts.length, 0); assert.equal(exactUnlinked.plan.data.movimientos[1].personalTransactionId, 11, "un enlace exacto sí permite recuperar el ID faltante de una devolución");

for (const fields of [{ amount: 0.0001 }, { date: "2026-02-30" }, { internalTransferAllocations: {} }, { internalTransferSpaceId: 123 }, { internalTransferLink: {} }, { internalTransferSettled: "false" }, { internalTransferConsumedAmount: 101 }]) {
  const originalTx = { ...tx, ...fields }, source = plain(data);
  const result = auto(source, [originalTx]); assert.equal(result.writes.length, 0); assert.ok(result.plan.conflicts.length);
  assert.throws(() => api.resolvePrivateBoxConflict(source, [originalTx], [], "a", { movementId: move.id, from: "box" }), /repair-conflict/);
}
for (const rows of [[null], [tx, null], { unknown: true }]) {
  assert.doesNotThrow(() => api.planPrivateBoxRepair(data, rows, [], "a"));
  const plan = api.planPrivateBoxRepair(data, rows, [], "a");
  assert.equal(plan.upserts.length, 0); assert.equal(plan.data, data); assert.equal(plan.conflicts[0].reason, "invalid");
  assert.equal(api.privateBoxLinkCandidates(data, rows, [], move.id).length, 0);
}
const shared = { id: 30, internalTransfer: "box", internalTransferSpaceId: "shared-box", internalTransferLink: "shared-move", internalTransferAllocations: {} };
assert.equal(api.planPrivateBoxRepair(data, [tx, shared], [], "a").conflicts.length, 0, "la revisión privada no modifica ni valida el historial de otra Caja compartida");
const ownIncomplete = api.planPrivateBoxRepair({ ...data, movimientos: [] }, [{ ...tx, date: undefined }, shared], [], "a");
assert.deepEqual(Array.from(ownIncomplete.conflicts, item => item.personalId), [10], "la explicación conserva la identidad privada disponible, sin mezclar compartidas");
const large = { ...data, cajas: [box, ...Array.from({ length: 1000 }, (_value, id) => ({ ...box, id: `caja-large-${id}` }))] };
const many = [tx, ...Array.from({ length: 10000 }, (_value, id) => ({ id: id + 1000, type: "expense", amount: 1, date: move.fecha }))];
const largePlan = api.planPrivateBoxRepair(large, many, [], "a");
assert.equal(largePlan.conflicts.length, 0); assert.equal(largePlan.upserts.length, 0); assert.equal(largePlan.data, large);
assert.equal(auto({ ...data, cajas: [{ ...box, sharingPending: true }] }, []).writes.length, 0);
assert.equal(api.planPrivateBoxRepair(data, [], [tx.id], "a").upserts.length, 0);
assert.equal(api.planPrivateBoxRepair({ ...data, movimientosBorrados: [move.id] }, [], [], "a").upserts.length, 0);
assert.throws(() => api.validatePrivateBoxRepair(closed, closed, [], [], [tx], [], "a", true), /repair-conflict/, "el guardado real no puede aceptar un plan viejo que reabre una Caja cerrada");

// Validación dentro del commit/almacén originales con SQLite real: un plan
// antiguo no escribe Personal, Caja ni sus marcas después de estas guardias.
const selected = pick("contexts/AppDataContext.tsx", node => ts.isFunctionDeclaration(node) && node.name?.text === "commitPrivateBoxData");
const core = load("utils/cajas.ts"), patch = load("utils/privateBoxPersonal.ts");
const synthesized = { id: 10, type: "expense", amount: 100, date: move.fecha, category: "otros", method: "transfer", description: box.nombre, notes: "", origin: "manual", internalTransfer: "box", internalTransferLink: move.id, internalTransferSpaceId: box.id, internalTransferSpaceName: box.nombre };
for (const source of [closed, { ...data, movimientos: [{ ...move, fecha: "2026-02-30" }] }, { ...data, movimientos: [{ ...move, monto: 0.0001 }] }]) {
  const sqlite = new DatabaseSync(":memory:"); sqlite.exec("CREATE TABLE store (key TEXT PRIMARY KEY,value TEXT)");
  const get = key => sqlite.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
  const put = (key, value) => sqlite.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value);
  let writes = 0, published = false;
  const adapter = { getItem: async key => get(key), multiGet: async keys => keys.map(key => [key, get(key)]),
    setItem: async (key, value) => { writes++; put(key, value); }, multiSet: async entries => {
      writes++; sqlite.exec("BEGIN IMMEDIATE"); try { for (const [key, value] of entries) put(key, value); sqlite.exec("COMMIT"); }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    } };
  const module = { exports: {} };
  vm.runInNewContext(js(read("utils/storage.ts")), { module, exports: module.exports, Error, setTimeout, clearTimeout,
    require: name => name.includes("async-storage") ? { default: adapter } : { encryptText: async text => "v2:" + text, decryptText: async text => text.slice(3) } });
  const storage = module.exports; storage.setAccountStorageAvailable(true);
  put(storage.STORAGE_KEYS.transactions, "v2:[]"); put(storage.STORAGE_KEYS.cajasDinero, "v2:" + JSON.stringify(source));
  const ctx = { ...core, ...patch, ...api, ready: true, hasOnboarded: true, isPremium: false, Platform: { OS: "android" }, auth: { currentUser: { uid: "a" } },
    localSessionVersion: { current: 1 }, transactionsLive: { current: [] }, deletedTransactionIdsRef: { current: [] }, returnReceipt: { current: null },
    captureAccountTask: () => ({ current: () => true }), withLocalAccountOperation: work => work(), hasUnreadableLocalData: storage.hasUnreadableLocalData,
    saveJSONBatchNow: storage.saveJSONBatchNow, STORAGE_KEYS: storage.STORAGE_KEYS, guardarCajasEnMemoria: () => { published = true; },
    setTransactions: () => { published = true; }, setDeletedTransactionIds: () => { published = true; }, Error };
  vm.runInNewContext(js(selected.node.getText(selected.tree)), ctx);
  const forged = { ...synthesized, date: source.movimientos[0].fecha, amount: source.movimientos[0].monto };
  const ok = await ctx.commitPrivateBoxData(source, source, [forged], [], () => true, () => { published = true; }, true);
  assert.equal(ok, false); assert.equal(writes, 0); assert.equal(published, false);
  assert.equal(get(storage.STORAGE_KEYS.transactions), "v2:[]");
  assert.deepEqual(JSON.parse(get(storage.STORAGE_KEYS.cajasDinero).slice(3)), source); sqlite.close();
}

// Se ejecuta la revisión original; estos casos solo explican, no ofrecen
// una elección de monto que pudiera reabrir la Caja o reparar a ciegas.
const review = pick("screens/Cajas.tsx", node => ts.isFunctionDeclaration(node) && node.name?.text === "revisarTransferencias");
for (const original of [closed, { ...data, movimientos: [{ ...move, fecha: "2026-02-30" }] }]) {
  const dialogs = [], plan = api.planPrivateBoxRepair(original, [], [], "a");
  const scope = { repairPlan: plan, cuentaActual: () => true, guardandoRef: { current: false }, datos: original, transactions: [], deletedTransactionIds: [],
    privateBoxLinkCandidates: api.privateBoxLinkCandidates, t: key => key, Alert: { alert: (...args) => dialogs.push(args) } };
  vm.runInNewContext(js(review.node.getText(review.tree)), scope); scope.revisarTransferencias();
  assert.equal(dialogs.length, 1); assert.equal(dialogs[0][2].length, 1);
  assert.equal(dialogs[0][1], original === closed ? "boxes.repairClosedDetails" : "boxes.repairInvalidDetails");
}
console.log("Recuperación incompleta: cierres/conversiones no reabren dinero, datos inválidos y repartos dañados se conservan sin romper la pantalla.");

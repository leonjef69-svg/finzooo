import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
const requireCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const requirePure = name => requireCore(name === "./utf8" ? "./utf8.ts" : name);

const baseline = process.env.FINO_TEST_PAIR_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere hash Git.");
const js = code => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
const code = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
function pick(file, predicate) {
  const tree = ts.createSourceFile(file, code(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found;
  function visit(node) { if (!found && predicate(node, tree)) found = node; if (!found) ts.forEachChild(node, visit); }
  visit(tree); assert.ok(found); return found.getText(tree);
}
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const module = { exports: {} };
  vm.runInNewContext(js(fs.readFileSync(file, "utf8")), { module, exports: module.exports,
    require: name => name.startsWith(".") ? requirePure(name) : load(name.replace("@/", "") + ".ts"), Error, Date });
  return cache[file] = module.exports;
}
const cajas = load("utils/cajas.ts"), linked = load("utils/linkedTransfers.ts"), repairs = load("utils/privateBoxRepair.ts"), patch = load("utils/privateBoxPersonal.ts");
const box = { id: "caja-a", nombre: "Viaje", creadaEn: 1 };
const move = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-06", creadoEn: 2, personalTransactionId: 10 };
const tx = { id: 10, type: "expense", amount: 100, category: "otros", date: move.fecha, time: "10:00", method: "transfer", description: "Mi aporte", notes: "conservar", icono: "foto", tags: ["viaje"], internalTransfer: "box", internalTransferLink: move.id, internalTransferSpaceId: box.id, internalTransferSpaceName: box.nombre };
const data = { cajas: [box], movimientos: [move], cajasBorradas: [], movimientosBorrados: [] };
const plan = (d = data, rows = [tx], deleted = []) => repairs.planPrivateBoxRepair(d, rows, deleted, "a");
const conflicting = { ...tx, amount: 80 };
// Regresión ejecutando la recuperación original, no una copia de su lógica.
const effect = pick("screens/Cajas.tsx", (node, tree) => ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect"
  && (node.arguments[0]?.getText(tree).includes("const movimientosPorId =") || node.arguments[0]?.getText(tree).includes("const prior = reparacionIntentada")));
const callback = effect.slice(effect.indexOf("(" ) + 1, effect.lastIndexOf(", ["));
let mutations = [];
const scope = { cuentaActual: () => true, personalReady: true, hasOnboarded: true, ready: true, cloudReady: true, guardando: false, compartiendo: false, isPremium: false,
  accountUid: "a", nubeConfirmadaPara: { current: null }, guardandoRef: { current: false }, hasUnreadableLocalData: () => false,
  datos: data, transactions: [conflicting], t: key => key, horaDe: () => "12:00", ...linked,
  setDatos: value => mutations.push(value), repairLinkedTransferTransactions: value => mutations.push(value),
  repairPlan: plan(data, [conflicting]), reparacionIntentada: { current: null }, refreshVersion: 0,
  guardarCambioCaja: value => mutations.push(value) };
vm.runInNewContext(js(`globalThis.run = (${callback});`), scope); scope.run();
assert.equal(mutations.length, 0, "no impone Caja S/100 sobre Personal S/80 automáticamente");
if (baseline) throw new Error("La regresión anterior debía fallar; verificar el hash.");

assert.equal(plan().upserts.length, 0, "pareja correcta no dispara guardados repetidos");
assert.equal(plan(data, [conflicting]).conflicts[0].selectable, true);
for (const bad of [{ ...tx, internalTransfer: undefined }, { ...tx, internalTransfer: "family" }, { ...tx, internalTransferLink: "mov-otra" }, { ...tx, internalTransferSpaceId: "caja-otra" }, { ...tx, type: "income" }]) {
  const p = plan(data, [bad]); assert.equal(p.upserts.length, 0); assert.equal(p.data, data); assert.ok(p.conflicts.length);
}
assert.ok(plan(data, [{ ...tx, internalTransferSettled: true, internalTransferConsumedAmount: 100 }]).conflicts.length);
assert.ok(plan(data, [], [10]).conflicts.length, "un borrado de Personal no se resucita por una mitad antigua");
assert.ok(plan({ ...data, movimientos: [] }).conflicts.length, "ausencia sin prueba no devuelve dinero");
assert.ok(plan({ ...data, movimientos: [], movimientosBorrados: [move.id] }).conflicts.length, "marca antigua no borra un aporte automáticamente");
assert.ok(plan(data, [tx, tx]).conflicts.length);
assert.ok(plan({ ...data, movimientos: [move, { ...move, id: "mov-b" }] }).conflicts.length, "ID Personal reutilizado bloquea recuperación");
const half = { ...data, movimientos: [{ ...move, personalTransactionId: undefined }] };
const weak = { ...tx, internalTransferLink: undefined };
assert.ok(plan(half, [weak]).conflicts.length, "monto/fecha iguales sin ID cruzado no bastan");
const recovered = plan(half);
assert.equal(recovered.data.movimientos[0].personalTransactionId, tx.id);
assert.equal(recovered.upserts.length, 0, "recuperar el ID no vuelve a agregar Personal");
const missing = plan(data, []); assert.equal(missing.upserts[0].amount, 100); assert.equal(missing.upserts[0].id, 10);
const fill = plan(data, [{ ...tx, internalTransferLink: undefined, internalTransferSpaceId: undefined }]);
assert.equal(fill.upserts[0].notes, "conservar"); assert.equal(fill.upserts[0].icono, "foto"); assert.deepEqual(plain(fill.upserts[0].tags), ["viaje"]);
const restoreReturn = { ...move, id: "mov-return", tipo: "gasto", monto: 40, personalReturnAmount: 40, personalTransactionId: 11, creadoEn: 3 };
const returned = { ...tx, id: 11, type: "income", amount: 40, internalTransferLink: restoreReturn.id };
const withReturn = { ...data, movimientos: [move, restoreReturn] };
assert.deepEqual(plain(plan(withReturn, [tx, returned]).upserts[0].internalTransferAllocations), [{ transactionId: 10, amount: 40 }]);
assert.ok(plan(withReturn, [tx, { ...returned, internalTransferAllocations: [{ transactionId: 12, amount: 40 }] }]).conflicts.length);
assert.equal(plan(withReturn, [conflicting, returned]).conflicts[0].selectable, false, "repartos posteriores no ofrecen una solución parcial ciega");
const copy = plain(data), rowsCopy = plain([conflicting]);
const useBox = repairs.resolvePrivateBoxConflict(data, [conflicting], [], "a", { movementId: move.id, from: "box" });
assert.equal(useBox.upserts[0].amount, 100); assert.equal(useBox.upserts[0].notes, conflicting.notes);
const usePersonal = repairs.resolvePrivateBoxConflict(data, [conflicting], [], "a", { movementId: move.id, from: "personal" });
assert.equal(usePersonal.data.movimientos[0].monto, 80); assert.equal(usePersonal.upserts[0].amount, 80);
assert.deepEqual(data, copy); assert.deepEqual([conflicting], rowsCopy, "planificar no escribe ni modifica originales");
const spent = { ...data, movimientos: [move, { ...move, id: "mov-spent", tipo: "gasto", monto: 90, personalTransactionId: undefined }] };
assert.throws(() => repairs.resolvePrivateBoxConflict(spent, [conflicting], [], "a", { movementId: move.id, from: "personal" }), /conflict/);
assert.throws(() => repairs.validatePrivateBoxRepair(data, data, [conflicting], [], [tx], [], "a", true), /conflict/);
assert.throws(() => repairs.validatePrivateBoxRepair(data, recovered.data, [tx], [], [], [10], "a", true), /conflict/);

const review = pick("screens/Cajas.tsx", node => ts.isFunctionDeclaration(node) && node.name?.text === "revisarTransferencias");
for (const kind of ["cancel", "box", "personal", "changed-box", "changed-personal", "account", "premium", "disk-failure"]) {
  const events = [], dialogs = [];
  const s = { repairPlan: plan(data, [conflicting]), cuentaActual: () => kind !== "account", guardandoRef: { current: false },
    datos: data, transactions: [conflicting], deletedTransactionIds: [], datosActuales: { current: data }, personalActuales: { current: null },
    premiumForSync: { current: false }, isPremium: false, cloudReady: true, syncIssue: null, accountUid: "a", nubeConfirmadaPara: { current: null },
    resolvePrivateBoxConflict: repairs.resolvePrivateBoxConflict, fmt: String, t: key => key, Alert: { alert: (...args) => dialogs.push(args) },
    guardarCambioCaja: async (...args) => { events.push(args); return kind !== "disk-failure"; }, showToast: key => events.push(key) };
  s.personalActuales.current = s.transactions;
  vm.runInNewContext(js(review), s); s.revisarTransferencias();
  if (kind === "account") { assert.equal(dialogs.length, 0); continue; }
  assert.equal(dialogs[0][2].length, 3);
  if (kind === "cancel") { assert.equal(dialogs[0][2][0].style, "cancel"); assert.equal(events.length, 0); continue; }
  if (kind === "changed-box") s.datosActuales.current = { ...data };
  if (kind === "changed-personal") s.personalActuales.current = [...s.transactions];
  if (kind === "premium") s.premiumForSync.current = true;
  await dialogs[0][2][kind === "personal" ? 1 : 2].onPress();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  if (kind.startsWith("changed-") || kind === "premium") { assert.equal(events.length, 0, "no aplica una elección desde un aviso antiguo"); continue; }
  assert.equal(events[0][3].from, kind === "personal" ? "personal" : "box");
  assert.equal(events.includes("boxes.repairSaved"), kind !== "disk-failure");
}

const proofModule = { exports: {} };
let rootData = { transactions: [tx], deletedTransactionIds: [] }, rootCache = false, uid = "a", session = 1, history = new Map(), reads = [], gate;
const fakeAuth = { get currentUser() { return { uid }; } };
const fakeStorage = { getAccountStorageSession: () => session };
const taskModule = { exports: {} };
vm.runInNewContext(js(fs.readFileSync("utils/accountTask.ts", "utf8")), { module: taskModule, exports: taskModule.exports, Error,
  require: name => name.endsWith("firebase") ? { auth: fakeAuth } : fakeStorage });
vm.runInNewContext(js(fs.readFileSync("utils/privateBoxRepairCloud.ts", "utf8")), { module: proofModule, exports: proofModule.exports, Error,
  require: name => name === "firebase/firestore" ? {
    doc: (_db, ...parts) => parts.join("/"), getDocFromServer: async ref => {
      reads.push(ref); if (gate) await gate;
      const value = ref.includes("/history/") ? history.get(ref.split("/").pop()) : rootData;
      return { id: ref.split("/").pop(), metadata: { fromCache: rootCache, hasPendingWrites: false }, exists: () => value != null, data: () => value };
    } } : name.endsWith("firebase") ? { db: {} } : name.endsWith("accountTask") ? taskModule.exports : load("utils/cloudHistoryMigration.ts") });
const proofApi = proofModule.exports;
let proof = await proofApi.loadPrivateBoxRepairCloud("a", [10]);
assert.throws(() => proofApi.assertPrivateBoxRepairCloud([conflicting], proof), /source-changed/);
assert.throws(() => proofApi.assertPrivateBoxRepairCloud([], proof), /source-changed/);
assert.doesNotThrow(() => proofApi.assertPrivateBoxRepairCloud([tx], proof));
rootCache = true; await assert.rejects(proofApi.loadPrivateBoxRepairCloud("a", [10]), /unconfirmed/); rootCache = false;
rootData = { historyFormat: 2 }; history.set("10", { id: 10, deleted: false, transaction: tx }); history.set("11", { id: 11, deleted: true });
reads = []; proof = await proofApi.loadPrivateBoxRepairCloud("a", [10, 11, 10]);
assert.equal(reads.length, 3); assert.deepEqual(Array.from(proof.deletedIds), [11]);
assert.throws(() => proofApi.assertPrivateBoxRepairCloud([tx], proof), /source-changed/);
history.set("10", { id: 99, deleted: false, transaction: { ...tx, id: 99 } }); await assert.rejects(proofApi.loadPrivateBoxRepairCloud("a", [10]), /invalid/);
rootData = { historyFormat: 7 }; await assert.rejects(proofApi.loadPrivateBoxRepairCloud("a", [10]), /invalid/);
rootData = { transactions: [tx] };
let finish; gate = new Promise(done => { finish = done; });
const obsoleteProof = proofApi.loadPrivateBoxRepairCloud("a", [10]); uid = "b"; session = 2; uid = "a"; session = 3; finish();
await assert.rejects(obsoleteProof, /account-task-obsolete/); gate = null; session = 1;

// Contexto y almacén reales sobre SQLite; solo Auth, cifrado y React se sustituyen.
const commit = pick("contexts/AppDataContext.tsx", node => ts.isFunctionDeclaration(node) && node.name?.text === "commitPrivateBoxData");
const weakLink = { ...tx, internalTransferLink: undefined, internalTransferSpaceId: undefined };
const linkChoice = { movementId: move.id, personalId: tx.id, from: "link" };
const linkPlan = repairs.resolvePrivateBoxConflict(half, [weakLink], [], "a", linkChoice);
for (const [source, sourceRows, expected, mode] of [[data, [], missing, true], [half, [tx], recovered, true], [data, [conflicting], useBox, { movementId: move.id, from: "box" }], [half, [weakLink], linkPlan, linkChoice]]) {
  for (const failure of [null, "rollback", "lost-ack", "obsolete", "remote-edit", "remote-deleted", "remote-restore", "remote-unavailable"]) {
    const db = new DatabaseSync(":memory:"); db.exec("CREATE TABLE store (key TEXT PRIMARY KEY, value TEXT)");
    const get = key => db.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
    const events = []; let current = true;
    const adapter = { getItem: async key => get(key), setItem: async (key, value) => db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value),
      multiGet: async keys => keys.map(key => [key, get(key)]), multiSet: async entries => {
        db.exec("BEGIN IMMEDIATE"); try {
          for (const [key, value] of entries) { db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value); if (failure === "rollback") throw Error("disk-full"); }
          db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
        if (failure === "lost-ack") throw Error("lost-response");
      } };
    const module = { exports: {} };
    vm.runInNewContext(js(fs.readFileSync("utils/storage.ts", "utf8")), { module, exports: module.exports, Error, setTimeout, clearTimeout,
      require: name => name.includes("async-storage") ? { default: adapter } : {
        encryptText: async text => { if (failure === "obsolete") current = false; return "v2:" + text; }, decryptText: async text => text.slice(3) } });
    const storage = module.exports; storage.setAccountStorageAvailable(true);
    const ctx = { ready: true, hasOnboarded: true, isPremium: failure?.startsWith("remote-") || false, Platform: { OS: "android" }, auth: { currentUser: { uid: "a" } }, localSessionVersion: { current: 1 },
      transactionsLive: { current: sourceRows }, deletedTransactionIdsRef: { current: [] }, returnReceipt: { current: null },
      captureAccountTask: () => ({ current: () => current, wait: work => work() }), withLocalAccountOperation: work => work(), hasUnreadableLocalData: storage.hasUnreadableLocalData,
      assertPrivateBoxRepairCloud: proofApi.assertPrivateBoxRepairCloud,
      loadPrivateBoxRepairCloud: async () => {
        if (failure === "remote-unavailable") throw Error("unavailable");
        return { transactions: failure === "remote-deleted" ? [] : [{ ...(mode.from === "link" ? weakLink : tx), amount: failure === "remote-edit" ? 140 : 100 }], deletedIds: failure === "remote-deleted" ? [10] : [] };
      },
      saveJSONBatchNow: storage.saveJSONBatchNow, STORAGE_KEYS: storage.STORAGE_KEYS, ...cajas, ...patch, ...repairs,
      guardarCajasEnMemoria: () => events.push("box-cache"), setTransactions: rows => { ctx.transactionsLive.current = rows; events.push("personal"); },
      setDeletedTransactionIds: ids => { ctx.deletedTransactionIdsRef.current = ids; }, Error };
    vm.runInNewContext(js(commit), ctx);
    const ok = await ctx.commitPrivateBoxData(source, expected.data, expected.upserts, [], () => current, () => events.push("box"), mode).catch(error => {
      assert.ok(failure.startsWith("remote-")); assert.match(error.message, /source-changed|unavailable/); return false;
    });
    assert.equal(ok, failure === null || failure === "lost-ack" || (failure === "remote-restore" && sourceRows[0]?.amount === 100), `${failure}: solo éxito comprobado publica ambas mitades`);
    assert.equal(events.includes("personal"), ok); assert.equal(events.includes("box"), ok);
    assert.equal(get(storage.STORAGE_KEYS.transactions) !== null, ok); assert.equal(get(storage.STORAGE_KEYS.cajasDinero) !== null, ok);
    if (ok) {
      const savedRows = JSON.parse(get(storage.STORAGE_KEYS.transactions).slice(3));
      const savedBox = JSON.parse(get(storage.STORAGE_KEYS.cajasDinero).slice(3));
      assert.equal(savedRows[0].amount, savedBox.movimientos[0].monto);
    }
    db.close();
  }
}
console.log("Pares heredados: IDs, diferencias sin sobrescritura, elección explícita, conservación y guardado conjunto real comprobados.");

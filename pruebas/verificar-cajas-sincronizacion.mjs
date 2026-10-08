import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const requireCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const requirePure = name => requireCore(name === "./utf8" ? "./utf8.ts" : name);

const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere un hash de Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = code => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
function load(file, require = requirePure) {
  const module = { exports: {} };
  vm.runInNewContext(js(read(file)), { module, exports: module.exports, require }); return module.exports;
}
function select(file, predicate) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) { if (!result && predicate(node, tree)) result = node; if (!result) ts.forEachChild(node, visit); }
  visit(tree); assert.ok(result); return { node: result, tree };
}
const deferred = () => {
  let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const api = load("utils/cajas.ts");
const moneyLocalWrite = load("utils/privateBoxMoneyLocalWrite.ts");
const box = { id: "caja-a", nombre: "A", creadaEn: 1 };
const row = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-05", creadoEn: 1 };
const data = (rows = [row], boxes = [box]) => ({ cajas: boxes, movimientos: rows, cajasBorradas: [], movimientosBorrados: [] });
const old = data([{ ...row, updatedAt: 10 }], [{ ...box, updatedAt: 10 }]);
const recent = data([{ ...row, monto: 120, updatedAt: 20 }], [{ ...box, nombre: "Editada", updatedAt: 20 }]);
for (const [a, b] of [[old, recent], [recent, old]]) {
  const result = api.fusionarCajas(a, b);
  assert.equal(result.movimientos[0].monto, 120, "gana la edición más nueva, no el lado llamado local");
  assert.equal(result.cajas[0].nombre, "Editada"); assert.equal(result.syncFormat, 2);
}
assert.equal(api.siguienteVersionCaja({ ...box, updatedAt: 50 }, 10), 51, "un reloj atrasado no rebaja la versión de la edición local");
assert.throws(() => api.fusionarCajas(old, data([{ ...row, monto: 90, updatedAt: 10 }], old.cajas)), /cajas-sync-conflict/);
assert.throws(() => api.fusionarCajas(data(), data([{ ...row, monto: 90 }])), /cajas-sync-conflict/, "datos antiguos distintos no se eligen a ciegas");
assert.equal(old.movimientos[0].monto, 100, "las fuentes no se modifican");
assert.equal(api.copiaPrivadaCoincide(box, [row], data()), true);
assert.equal(api.copiaPrivadaCoincide(box, [row], recent), false, "no convertir una vista anterior a la edición remota");
assert.equal(api.copiaPrivadaCoincide(box, [row], data([row, { ...row, id: "otro" }])), false, "no dejar atrás movimientos remotos al convertir");
const deleted = api.fusionarCajas(old, { ...data([{ ...row, monto: 90, updatedAt: 10 }], old.cajas), movimientosBorrados: [row.id] });
assert.equal(deleted.movimientos.length, 0, "borrar prevalece incluso sobre una edición conflictiva");
assert.equal(api.fusionarCajas(recent, { ...data(), cajasBorradas: [box.id] }).movimientos.length, 0);
const expense = { ...row, tipo: "gasto", monto: 80 };
const spendA = data([row, { ...expense, id: "mov-gasto-a" }]), spendB = data([row, { ...expense, id: "mov-gasto-b" }]);
assert.throws(() => api.fusionarCajas(spendA, spendB), /cajas-sync-conflict/, "gastar el mismo saldo desde dos teléfonos no se confirma a ciegas");
assert.equal(spendA.movimientos.length, 2); assert.equal(spendB.movimientos.length, 2);
for (const invalid of [{}, { cajas: [], movimientos: "no" }, { ...data(), syncFormat: 3 }, data([row, row]), data([{ ...row, monto: Infinity }]), data([{ ...row, cajaId: "ausente" }])]) {
  assert.throws(() => api.validarCajas(invalid), /cajas-invalid-data/);
}

let uid = "A", session = 1, unreadable = false;
const auth = { get currentUser() { return { uid }; } };
const storage = { getAccountStorageSession: () => session, hasUnreadableLocalData: () => unreadable };
const capture = load("utils/accountTask.ts", name => name.endsWith("firebase") ? { auth } : storage).captureAccountTask;
let remote = recent, cache = false, pending = false, exists = true, readGate = null, reads = 0;
const writes = [];
const snapshot = () => ({ exists: () => exists, data: () => remote, metadata: { fromCache: cache, hasPendingWrites: pending } });
const cloud = load("utils/cloudCajas.ts", name => {
  if (name === "@/utils/privateBoxSync") return { withPrivateBoxCloudOperation: async (_uid, work) => work({ assertCurrent() {}, wait: work => work(), remember: data => data }) };
  if (name === "@/utils/firebase") return { db: {}, auth };
  if (name === "@/utils/cajas") return api;
  if (name === "@/utils/accountTask") return { captureAccountTask: capture };
  if (name === "@/utils/storage") return storage;
  if (name === "firebase/firestore") return { doc: (_db, collection, owner) => ({ collection, owner }), deleteDoc: async () => {},
    getDoc: async () => { reads++; return snapshot(); }, getDocFromServer: async () => { reads++; return snapshot(); },
    runTransaction: async (_db, callback) => callback({ get: async () => { reads++; if (readGate) await readGate.promise; return snapshot(); },
      set: (ref, value) => writes.push({ ref, value }) }) };
  throw new Error(name);
});
let confirmed;
assert.equal(await cloud.subirCajas(uid, old, undefined, value => { confirmed = value; }), true);
assert.equal(confirmed.movimientos[0].monto, 120, "la pantalla recibe el resultado real del guardado, sin otra lectura");
assert.equal(writes[0].value.movimientos[0].monto, 120, "subir un teléfono atrasado no pisa la nube");
assert.equal(writes[0].value.syncFormat, 2);
writes.length = 0; remote = data([{ ...row, monto: 90, updatedAt: 10 }], old.cajas);
assert.equal(await cloud.subirCajas(uid, old), false); assert.equal(writes.length, 0, "conflicto no confirma una sobrescritura");
remote = old; unreadable = true; const previousReads = reads;
assert.equal(await cloud.subirCajas(uid, data([])), false); assert.equal(reads, previousReads); unreadable = false;
cache = true; await assert.rejects(cloud.bajarCajas(uid), /cajas-unconfirmed/);
cache = false; pending = true; await assert.rejects(cloud.bajarCajas(uid), /cajas-unconfirmed/);
pending = false; remote = {}; await assert.rejects(cloud.bajarCajas(uid), /cajas-invalid-data/);
remote = old; readGate = deferred();
const upload = cloud.subirCajas(uid, old); await flush();
uid = "B"; session = 2; uid = "A"; session = 3;
readGate.resolve(); assert.equal(await upload, false); assert.equal(writes.length, 0, "reintento de otra sesión no escribe aunque la UID vuelva a coincidir");
readGate = null; session = 1;
readGate = deferred(); const becameUnreadable = cloud.subirCajas(uid, old); await flush();
unreadable = true; readGate.resolve(); assert.equal(await becameUnreadable, false);
assert.equal(writes.length, 0, "un fallo local aparecido durante la transacción también impide subir");
unreadable = false; readGate = null;
const memory = load("utils/cajasMemoria.ts", name => name.endsWith("privateBoxMoneyLocalWrite") ? moneyLocalWrite : name.endsWith("firebase") ? { auth } : storage);
memory.guardarCajasEnMemoria(old); assert.ok(memory.leerCajasEnMemoria());
uid = "B"; assert.equal(memory.leerCajasEnMemoria(), null); uid = "A"; session++;
assert.equal(memory.leerCajasEnMemoria(), null, "la caché no sobrevive a una sesión distinta");

// Conversión real: una vista vieja/otra sesión no alcanza a crear el grupo.
session = 1; let groupWrites = 0, sourceGate = null;
const sharing = load("utils/cloudCajasCompartidas.ts", name => {
  // Estos escenarios financieros presuponen documentos aceptados. La barrera
  // sin aceptación se ejecuta aparte con el módulo original de recibos.
  if (name === "@/utils/legalAcceptance") return { assertSharedContentAccepted: async () => {} };
  if (name === "@/utils/firebase") return { db: {}, auth };
  if (name === "@/utils/cajas") return api;
  if (name === "@/utils/accountTask") return { captureAccountTask: capture };
  if (name === "@/utils/cloudCajas") return { subirCajas: async () => true };
  if (name === "@/utils/incompleteBoxDeletion") return { prepararBorradoConversionesCaja: async () => { throw new Error("NO_ACCOUNT_DELETION_WHILE_SHARING"); } };
  if (name === "@/utils/boxMigration") return { huellaCaja: async () => "a".repeat(64), confirmarConversionCaja: async () => null };
  if (name === "@/functions/src/private-box-source") return {};
  if (name === "@/utils/familia" || name === "@/utils/amount" || name === "@/utils/linkedTransfers" || name === "@/utils/personalContribution") return {};
  if (name === "firebase/firestore") return { doc: (...parts) => ({ parts }), collection: (...parts) => ({ parts }), serverTimestamp: () => 1,
    getDocFromServer: async () => { if (sourceGate) await sourceGate.promise; return { exists: () => true, data: () => recent }; },
    getDoc: async () => ({ exists: () => true, data: () => recent }),
    runTransaction: async (_db, callback) => callback({ get: async () => ({ exists: () => false }), set: () => groupWrites++ }),
    getDocs: async () => ({ docs: [] }), writeBatch: () => ({ set: () => groupWrites++, commit: async () => {} }), updateDoc: async () => groupWrites++ };
  throw new Error(name);
});
await assert.rejects(sharing.compartirCajaExistente(uid, "A", box, [row]), /cajas-sync-conflict/);
assert.equal(groupWrites, 0, "no crea una copia compartida omitiendo la edición remota");
sourceGate = deferred(); const conversion = sharing.compartirCajaExistente(uid, "A", box, [row]); await flush();
session = 3; sourceGate.resolve(); await assert.rejects(conversion, /account-task-obsolete/);
assert.equal(groupWrites, 0);

// Se ejecutan el callback de carga y el aplicador originales de Cajas.
const focusNode = select("screens/Cajas.tsx", (n, tree) => ts.isCallExpression(n) && n.expression.getText(tree) === "useFocusEffect");
const focus = focusNode.node.arguments[0].arguments[0].getText(focusNode.tree);
const setterNode = select("screens/Cajas.tsx", (n, tree) => ts.isVariableDeclaration(n) && n.name.getText(tree) === "setDatos");
const setter = setterNode.node.initializer.arguments[0].getText(setterNode.tree);
const repairNode = select("screens/Cajas.tsx", (node, tree) => ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect"
  && node.arguments[0]?.getText(tree).includes("const prior = reparacionIntentada"));
const repairEffect = repairNode.node.arguments[0].getText(repairNode.tree);
for (const [ready, cloudReady, premium, confirmed, sameAccount] of [[false, true, false, null, true], [true, false, true, "A", true], [true, true, true, null, true], [true, true, false, null, false]]) {
  const scope = { personalReady: true, hasOnboarded: true, ready, cloudReady, guardando: false, isPremium: premium, accountUid: "A", nubeConfirmadaPara: { current: confirmed }, cuentaActual: () => sameAccount };
  Object.defineProperty(scope, "datos", { get() { throw new Error("PASSED_GUARD"); } });
  vm.runInNewContext(js(`globalThis.repair = (${repairEffect});`), scope);
  assert.doesNotThrow(() => scope.repair(), "no concilia antes de cargar ni con cuenta/copia sin confirmar");
}
function screenHarness(premium = true) {
  uid = "A"; session = 1;
  memory.limpiarCajasEnMemoria();
  const state = {}, localRead = deferred(), cloudRead = deferred(); let count = 0;
  const scope = { auth, accountUid: "A", cuentaActual: () => uid === "A" && session === 1, isPremium: premium,
    guardandoRef: { current: false },
    refreshVersion: 0, requestedRefresh: { current: 0 },
    premiumForSync: { current: premium }, nubeConfirmadaPara: { current: null }, datosActuales: { current: data() },
    ...moneyLocalWrite, captureAccountTask: capture, hasUnreadableLocalData: () => false, STORAGE_KEYS: { cajasDinero: "cajas" }, CAJAS_VACIAS: data([]),
    validarCajas: api.validarCajas, fusionarCajas: api.fusionarCajas,
    privateBoxCloudResponseCurrent: () => true,
    loadJSON: () => localRead.promise, bajarCajas: () => { count++; return cloudRead.promise; },
    leerCajasEnMemoria: memory.leerCajasEnMemoria, revisionCajasEnMemoria: memory.revisionCajasEnMemoria,
    guardarCajasEnMemoria: value => { memory.guardarCajasEnMemoria(value); state.memory = value; }, saveJSON: async (_key, value) => { state.saved = value; },
    setRenderedDatos: value => { state.rendered = value; }, setReady: value => { state.ready = value; },
    setCloudReady: value => { state.cloudReady = value; }, setSyncIssue: value => { state.issue = value; },
    setNameCopies: value => { state.nameCopies = value; },
    reportSyncError: error => { state.error = error.message; } };
  state.rendered = scope.datosActuales.current;
  vm.runInNewContext(js(`globalThis.setDatos = (${setter}); globalThis.focus = (${focus});`), scope);
  const stop = scope.focus();
  return { scope, state, localRead, cloudRead, stop, count: () => count };
}
{
  const h = screenHarness(); h.localRead.resolve(data()); await flush();
  h.scope.setDatos(before => ({ ...before, movimientos: [...before.movimientos, { ...row, id: "mov-fast", creadoEn: 2 }] }));
  h.cloudRead.resolve(recent); await flush();
  assert.ok(h.state.rendered.movimientos.some(item => item.id === "mov-fast"), "la carga conserva una anotación todavía no pintada");
  assert.equal(h.state.rendered.movimientos.find(item => item.id === row.id).monto, 120);
  assert.equal(h.state.cloudReady, true);
  const rendered = h.state.rendered;
  h.scope.setDatos(plain(rendered)); assert.equal(h.state.rendered, rendered, "confirmar lo mismo no inicia un bucle de subidas");
}
{
  const h = screenHarness(); h.localRead.resolve(data()); await flush();
  uid = "A"; session = 3; h.cloudRead.resolve(recent); await flush();
  assert.equal(h.state.rendered.movimientos[0].monto, 100);
  assert.equal(h.scope.nubeConfirmadaPara.current, null); assert.equal(h.state.cloudReady, false);
}
{
  const h = screenHarness(false); h.localRead.resolve(data()); await flush();
  assert.equal(h.count(), 0, "Gratis conserva solo la copia del celular"); assert.equal(h.state.cloudReady, true);
}
{
  const h = screenHarness(false);
  h.scope.guardarCajasEnMemoria(recent);
  h.localRead.resolve(old); await flush();
  assert.equal(h.state.rendered.movimientos[0].monto,120,"una lectura anterior al lote no restaura la copia vieja al abrir Cajas");
  assert.equal(h.state.saved.movimientos[0].monto,120);
}
{
  const h = screenHarness(); h.localRead.resolve(old); await flush();
  const different = { ...old, cajas: [{ ...old.cajas[0], nombre: "Otra elección" }] };
  h.cloudRead.resolve(different); await flush();
  assert.equal(h.state.rendered.cajas[0].nombre, "A", "el empate de nombre conserva el celular original");
  assert.equal(h.state.cloudReady, false); assert.equal(h.scope.nubeConfirmadaPara.current, null);
  assert.equal(h.state.nameCopies.local.cajas[0].nombre, "A");
  assert.equal(h.state.nameCopies.remoto.cajas[0].nombre, "Otra elección");
  assert.equal(h.state.error, "cajas-sync-conflict");
}

// Reparación original: no pierde información ni reabre dinero consumido.
const contextNode = select("contexts/AppDataContext.tsx", n => ts.isFunctionDeclaration(n) && n.name?.text === "repairLinkedTransferTransactions");
const queued = [], marks = [], ctx = { ...moneyLocalWrite, deletedTransactionIdsRef: { current: [10] }, removeTransactions() {},
  setDeletedTransactionIds: callback => marks.push(callback), setTransactions: callback => queued.push(callback), Date };
vm.runInNewContext(js(contextNode.node.getText(contextNode.tree)), ctx);
ctx.repairLinkedTransferTransactions([{ id: 10, internalTransfer: "box", amount: 120, updatedAt: 1 }]);
let personal = [{ id: 10, internalTransfer: "box", amount: 100, updatedAt: 100, extraField: "conservar" }];
for (const update of queued.splice(0)) personal = update(personal);
assert.equal(personal[0].extraField, "conservar"); assert.ok(personal[0].updatedAt > 100);
assert.deepEqual(Array.from(ctx.deletedTransactionIdsRef.current), []);
ctx.repairLinkedTransferTransactions([{ id: 10, internalTransfer: "box", amount: 200 }]);
personal[0].internalTransferSettled = true; personal[0].internalTransferConsumed = 120;
for (const update of queued.splice(0)) personal = update(personal);
assert.equal(personal[0].amount, 120); assert.equal(personal[0].internalTransferConsumed, 120);
console.log("Cajas privadas: versión reciente, conflicto sin reemplazo, servidor, datos inválidos, caché/sesión y aportes consumidos protegidos.");

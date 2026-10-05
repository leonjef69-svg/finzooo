import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";

// Ejecuta las funciones/callbacks del código real, no una copia de su lógica.
// La plataforma/SDK se sustituyen para ordenar deliberadamente las respuestas.
const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere un hash de Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const transpile = code => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const ast = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(tree, test) {
  let found;
  function visit(node) { if (!found && test(node)) found = node; if (!found) ts.forEachChild(node, visit); }
  visit(tree); assert.ok(found, "manejador original presente"); return found;
}
const fn = (tree, name) => find(tree, node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(tree);
const effect = (tree, fragment) => find(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect"
  && node.arguments[0]?.getText(tree).includes(fragment)).arguments[0].getText(tree);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const plain = value => JSON.parse(JSON.stringify(value));
let uid = "A", session = 1;
const auth = { get currentUser() { return uid ? { uid } : null; } };
const getAccountStorageSession = () => session;
// El auxiliar nuevo no existía antes; no se inyecta protección en los
// manejadores antiguos, que no lo llaman. La regresión falla en recargar.
const module = { exports: {} };
vm.runInNewContext(transpile(fs.readFileSync("utils/accountTask.ts", "utf8")), {
  module, exports: module.exports, require: name => name.endsWith("firebase") ? { auth } : { getAccountStorageSession },
});
const { captureAccountTask } = module.exports;
const family = ast("screens/Family.tsx");
const reload = find(family, node => ts.isVariableDeclaration(node) && node.name.getText(family) === "recargar").initializer.arguments[0].getText(family);
function familyHarness() {
  uid = "A"; session = 1;
  const state = {}, calls = [], cache = new Map();
  const scope = { auth, accountUid: "A", accountSession: 1, getAccountStorageSession, captureAccountTask,
    mounted: { current: true }, reloadId: { current: 0 }, confirmedReload: { current: 0 }, actionLock: { current: false },
    tRef: { current: key => key }, toastRef: { current: key => calls.push(key) }, showToast: key => calls.push(key),
    t: key => key, spaceErrorKey: () => "error", familiaEnMemoria: cache,
    listarFamilias: async () => [{ id: "f", nombre: "Casa" }], cargarFamiliaActiva: async () => null,
    listarMovimientosFamilia: async () => [{ id: "old", tipo: "ingreso", monto: 40 }], listarMiembrosFamilia: async () => [{ uid: "A" }] };
  for (const name of ["Cargando", "FamiliasSincronizadas", "Familias", "SaldosFamilias", "MovimientosFamilias", "Familia", "Miembros", "Movimientos", "Ocupado"]) {
    scope[`set${name}`] = value => { state[name] = value; };
  }
  vm.runInNewContext(transpile(`globalThis.recargar = (${reload});\n${fn(family, "ejecutar")}`), scope);
  return { state, calls, cache, scope };
}

// Nada de medio resultado mientras aún faltan miembros de la misma consulta.
{
  const { scope, state } = familyHarness(), members = deferred();
  scope.listarMiembrosFamilia = () => members.promise;
  const load = scope.recargar(); await flush();
  assert.equal(state.Familias, undefined, "no publicar una lista parcial antes del último paso");
  members.resolve([{ uid: "A" }]); await load;
  assert.equal(state.FamiliasSincronizadas, true);
  assert.equal(state.Movimientos[0].id, "old");
}
// Respuesta de A después de entrar a B; también A -> B -> A (misma UID, otra sesión).
for (const nextUid of ["B", "A"]) {
  const { scope, state, calls, cache } = familyHarness(), movements = deferred();
  scope.listarMovimientosFamilia = () => movements.promise;
  const load = scope.recargar(); await flush();
  uid = nextUid; session = 3;
  movements.resolve([{ id: "old", tipo: "ingreso", monto: 40 }]); await load;
  assert.equal(state.Movimientos, undefined); assert.equal(state.Familias, undefined);
  assert.equal(cache.size, 0); assert.equal(calls.length, 0);
  assert.equal(state.Cargando, undefined, "el finally viejo tampoco finaliza la carga nueva");
}
// Invalida la lectura ANTES de enviar el borrado, no solo al recargar después.
{
  const { scope, state } = familyHarness(), movements = deferred(), deletion = deferred();
  scope.listarMovimientosFamilia = () => movements.promise;
  const load = scope.recargar(); await flush();
  const mutation = scope.ejecutar(async wait => { await wait(() => deletion.promise); });
  movements.resolve([{ id: "deleted-return", tipo: "gasto", monto: 40 }]); await load;
  assert.equal(state.Movimientos, undefined, "no revive el retorno mientras el borrado se confirma");
  uid = "B"; session++; deletion.resolve(); await mutation;
}
// Una carga superada no muestra error ni cambia cargando desde su catch/finally.
{
  const { scope, state, calls } = familyHarness(), old = deferred(), recent = deferred();
  scope.listarFamilias = () => old.promise;
  const a = scope.recargar(); await flush();
  scope.listarFamilias = () => recent.promise;
  const b = scope.recargar(); await flush();
  old.reject(new Error("offline")); await a;
  assert.equal(calls.length, 0); assert.equal(state.Cargando, undefined);
  recent.resolve([]); await b; assert.equal(state.Cargando, false);
}
// Tampoco vale una actualización manual iniciada DURANTE la modificación.
{
  const { scope, state } = familyHarness(), deletion = deferred(), after = deferred();
  const mutation = scope.ejecutar(async wait => { await wait(() => deletion.promise); });
  await scope.recargar();
  const intermediateRevision = scope.confirmedReload.current;
  scope.listarMovimientosFamilia = () => after.promise;
  let finalLoad;
  const originalReload = scope.recargar;
  scope.recargar = (...args) => { finalLoad = originalReload(...args); return finalLoad; };
  deletion.resolve(); await mutation;
  assert.notEqual(scope.reloadId.current, intermediateRevision);
  assert.equal(state.FamiliasSincronizadas, false, "se obliga a leer después de la confirmación, no se usa la foto intermedia");
  assert.ok(finalLoad, "inició la carga posterior a la modificación");
  after.resolve([]); await finalLoad;
  assert.deepEqual(plain(state.Movimientos), []);
  assert.equal(scope.confirmedReload.current, scope.reloadId.current);
}
// Una acción terminada en otra sesión no escribe Personal ni envía el siguiente paso.
{
  const { scope } = familyHarness(), response = deferred(); let writes = 0, requests = 0;
  const pending = scope.ejecutar(async wait => {
    await wait(() => { requests++; return response.promise; });
    writes++;
    await wait(async () => { requests++; });
  });
  uid = "A"; session = 4; response.resolve(); await pending;
  assert.equal(requests, 1); assert.equal(writes, 0);
}

const boxes = ast("screens/SharedBoxes.tsx");
const listen = effect(boxes, "escucharMovimientosCaja");
const reconcile = effect(boxes, "const upserts = movimientos.flatMap");
const ledger = { exports: {} };
vm.runInNewContext(transpile(read("utils/linkedTransfers.ts")), { module: ledger, exports: ledger.exports });
function boxHarness() {
  uid = "A"; session = 1;
  const state = {}, members = deferred(), confirmation = deferred();
  let receive, stopCount = 0;
  const scope = { auth, uid: "A", accountSession: 1, getAccountStorageSession, captureAccountTask,
    caja: { id: "box-a", nombre: "Caja" }, cajaId: "box-a", mounted: { current: true },
    selectedBoxId: { current: "box-a" }, movementEpoch: { current: 0 }, confirmedSource: { current: null },
    lock: { current: false }, errorRef: { current: error => { state.error = error; } },
    listarMiembrosCaja: () => members.promise, confirmarCajaAbierta: () => confirmation.promise,
    escucharMovimientosCaja: (_id, callback) => { receive = callback; return () => stopCount++; },
    setMovimientos: items => { state.movimientos = items; }, setMiembros: items => { state.miembros = items; },
    setMovimientosConfirmados: value => { state.confirmado = value; } };
  vm.runInNewContext(transpile(`globalThis.listen = (${listen}); globalThis.reconcile = (${reconcile});`), scope);
  const stop = scope.listen();
  return { scope, state, members, confirmation, stop, receive: (...args) => receive(...args), stops: () => stopCount };
}
// No vuelven miembros/snapshots de la Caja anterior tras cambiar de pantalla.
{
  const h = boxHarness(); h.stop(); h.scope.selectedBoxId.current = "box-b";
  h.members.resolve([{ uid: "old-member" }]); h.receive([{ id: "old" }], true); await flush();
  assert.deepEqual(plain(h.state.miembros), []); assert.deepEqual(plain(h.state.movimientos), []);
  assert.equal(h.stops(), 1);
}
// UI puede mostrar caché, pero Personal nunca se corrige/borrar con ella.
{
  const h = boxHarness();
  h.receive([{ id: "cached" }], false); await flush();
  assert.equal(h.state.movimientos[0].id, "cached"); assert.equal(h.state.confirmado, false);
  h.receive([], true); h.confirmation.resolve(true); await flush();
  assert.equal(h.state.confirmado, true);
  const tx = (id, space, settled = false) => ({ id, internalTransfer: "box", internalTransferSpaceId: space,
    internalTransferLink: `return_${id}`, internalTransferSettled: settled });
  Object.assign(h.scope, { movimientos: [], movimientosConfirmados: true, transactions: [tx(1, "box-a"), tx(2, "box-b"), tx(3, "box-a", true)],
    transferLedger: { allocationsByReturnId: new Map() }, t: key => key, horaDe: () => "12:00",
    orphanedPersonalTransferIds: ledger.exports.orphanedPersonalTransferIds,
    repairLinkedTransferTransactions: (upserts, ids) => { h.state.repaired = { upserts, ids }; } });
  h.scope.reconcile();
  assert.deepEqual(plain(h.state.repaired.ids), [1], "solo retira el vínculo ausente del espacio activo/confirmado, nunca otro espacio ni dinero consumido");
  h.state.repaired = null; h.scope.movimientosConfirmados = false; h.scope.reconcile();
  assert.equal(h.state.repaired, null);
}
// Cerrar/purgar no convierte aportes consumidos en devoluciones inventadas.
{
  const h = boxHarness(); h.receive([], true); h.confirmation.resolve(false); await flush();
  assert.equal(h.state.confirmado, false);
}
// Una segunda instantánea invalida la comprobación de espacio abierto anterior.
{
  const h = boxHarness(); h.receive([{ id: "old" }], true); h.receive([], false);
  h.confirmation.resolve(true); await flush(); assert.equal(h.state.confirmado, false);
}
console.log("Consultas de espacios: respuesta vieja, cambio de cuenta, borrado, caché, miembros y cierres protegidos con manejadores reales.");

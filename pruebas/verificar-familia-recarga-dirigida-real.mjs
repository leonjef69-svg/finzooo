import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const read = createSourceReader();
const js = value => ts.transpile(value, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
function original(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(js(read(file)), { module, exports: module.exports, require: name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  } });
  return module.exports;
}
const file = "screens/Family.tsx", source = read(file);
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map(), effects = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.set(node.name.getText(tree), node);
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect") effects.push(node.arguments[0]);
  ts.forEachChild(node, visit);
}
visit(tree);
const effect = fragment => effects.find(node => node.getText(tree).includes(fragment)).getText(tree);
const callback = name => declarations.get(name).initializer.arguments[0].getText(tree);
const arrow = name => declarations.get(name).initializer.getText(tree);
function harness() {
  const network = { lists: 0, movements: [], members: [], writes: 0, fail: false };
  const account = { uid: "A", session: 1 }, auth = { get currentUser() { return { uid: account.uid }; } };
  const getAccountStorageSession = () => account.session;
  const rows = Array.from({ length: 8 }, (_, id) => ({ id: `f${id}`, nombre: `Familia ${id}`, ownerUid: "A", currency: "PEN" }));
  const remote = Object.fromEntries(rows.map((family, i) => [family.id, [{ id: `aporte-${i}`, tipo: "ingreso", monto: 100,
    personalTransactionId: i + 1, personalOwnerUid: "A", creadoEn: 1, creadoPor: "A", fecha: "2026-10-23", descripcion: "Aporte" }]]));
  const memory = new Map(), messages = [], repairs = [];
  const scope = { ...original("utils/familyMutation.ts"), ...original("utils/linkedTransfers.ts"), ...original("utils/spaceRead.ts"), ...original("utils/immediateRemoval.ts"),
    ...original("utils/accountTask.ts", { "@/utils/firebase": { auth }, "@/utils/storage": { getAccountStorageSession } }),
    auth, accountUid: "A", accountSession: 1, getAccountStorageSession, familiaEnMemoria: memory,
    mounted: { current: true }, reloadId: { current: 0 }, confirmedReload: { current: 0 }, familiaConfirmada: { current: null },
    familiaElegida: { current: "f0" }, listaFamiliasVisible: { current: false }, actionLock: { current: false },
    cierresPendientes: { current: new Set() }, legacyRepairIds: { current: new Set() }, pendingDebit: { current: null },
    VENTANA_CAMBIO_RAPIDO_MS: 2000, familia: rows[0], familias: [], movimientosFamilias: {}, movimientos: [], transactions: [],
    cargando: false, familiasSincronizadas: false, movimientosOcultos: new Set(), owner: true, isPremium: true, userCurrency: "PEN",
    t: (key, values = {}) => `${key}:${values.name || ""}`, tRef: { current: key => key }, toastRef: { current: key => messages.push(key) },
    showToast: key => messages.push(key), spaceErrorKey: error => error.message, horaDe: () => "", fechaHoy: () => "2026-10-23",
    listarFamilias: async () => { network.lists++; return rows; },
    listarMovimientosFamilia: async id => { network.movements.push(id); if (network.fail) throw Error("family-unconfirmed"); return remote[id]; },
    listarMiembrosFamilia: async id => { network.members.push(id); return [{ uid: "A", nombre: "A", rol: "owner" }]; },
    repairLinkedTransferTransactions: (upserts, deleted) => { repairs.push(plain({ upserts, deleted })); return true; },
    vincularMovimientoPersonalFamilia() { throw Error("No hay legado que migrar"); },
    amountInputError: () => null, parseAmountInput: Number, validSpaceDate: () => true, saldoPersonalEn: () => 1000,
    tipo: "gasto", monto: "5", descripcion: "Gasto", category: "otros", notes: "", method: "cash", movementDate: "2026-10-23",
    editandoAporteId: null, origenDinero: "externo", nextId: () => 55,
    hayMovimientoCompartidoPendiente: async () => false,
    nuevaOperacionMovimientoCompartido: () => ({ id: "synthetic-operation", currency: "PEN" }),
    confirmarMovimientoCompartido: async () => true,
    guardarMovimientoFamilia: async (id, uid, movement) => { network.writes++; remote[id] = [...remote[id], { ...movement, id: "nuevo", creadoEn: 5, creadoPor: uid }]; return "nuevo"; },
    devolverAportePersonal: async request => {
      network.writes++; const item = { id: "devuelto", tipo: "gasto", monto: request.amount, personalTransactionId: 500, personalOwnerUid: "A",
        personalReturnAmount: request.amount, creadoEn: 6, creadoPor: "A", fecha: request.fecha, descripcion: "Devolución" };
      remote[request.spaceId] = [...remote[request.spaceId], item]; return item;
    },
    recordPersonalReturn: async () => true,
    borrarMovimientoFamilia: async (id, movementId) => { network.writes++; remote[id] = remote[id].filter(item => item.id !== movementId); },
    deleteLinkedTransferTransaction: async () => true,
  };
  scope.invalidarCopiaFamilia = handlerOriginal(file, "invalidarCopiaFamilia", scope, source);
  scope.retirarMovimientoConfirmado = handlerOriginal(file, "retirarMovimientoConfirmado", scope, source);
  for (const key of ["Familias", "Familia", "SaldosFamilias", "MovimientosFamilias", "Miembros", "Movimientos", "FamiliasSincronizadas", "Cargando", "Actualizando", "ErrorCarga", "Ocupado", "MoneyRevision", "VerTodas", "Monto", "Descripcion", "Notes", "MovementDate", "OrigenDinero", "Tipo", "EditandoAporteId", "MovimientosOcultos", "Seleccionados", "Seleccionando"]) {
    const field = key[0].toLowerCase() + key.slice(1);
    scope[`set${key}`] = value => { scope[field] = typeof value === "function" ? value(scope[field]) : value; };
  }
  scope.recargar = vm.runInNewContext(js(`(${callback("recargar")})`), scope);
  scope.ejecutar = handlerOriginal(file, "ejecutar", scope, source);
  vm.runInNewContext(js(`globalThis.save = ${arrow("guardar")}; globalThis.giveBack = ${arrow("devolverAPersonal")};
    globalThis.remove = ${arrow("borrarSeleccionados")}; globalThis.reconcile = (${effect("const todosLosMovimientos")});
    globalThis.stopMutation = (${effect("observeFamilyMutation(accountUid")})();`), scope);
  return { scope, network, memory, rows, remote, repairs, account, messages,
    reset() { network.lists = network.writes = 0; network.movements.length = network.members.length = repairs.length = messages.length = 0; },
    async load() { await scope.recargar("f0", true); await tick(); } };
}

const h = harness(); await h.load();
assert.equal(h.network.lists, 1); assert.equal(h.network.movements.length, 8); assert.equal(h.network.members.length, 1);
const full = { lists: h.network.lists, histories: h.network.movements.length, members: h.network.members.length };
h.scope.transactions = h.rows.map((family, i) => ({ id: i + 1, type: "expense", amount: 100, internalTransfer: "family",
  internalTransferSpaceId: family.id, internalTransferLink: `aporte-${i}`, internalTransferSpaceName: family.nombre }));
// Otra copia visual incompleta no representa la prueba de un borrado remoto.
h.memory.get("A").movimientosFamilias.f7 = [];
h.scope.movimientosFamilias.f7 = [];
h.reset(); await h.scope.save(); await tick();
const directed = { lists: h.network.lists, histories: h.network.movements.length, members: h.network.members.length };
assert.equal(h.network.writes, 1); assert.equal(h.scope.movimientos.at(-1).monto, 5);
console.log(JSON.stringify({ familyAPICalls: { full, directed } }));
assert.deepEqual(directed, { lists: 0, histories: 1, members: 1 }, "guardar+observer+finalización solo consultan la afectada");
assert.equal(h.scope.familiaConfirmada.current, "f0", "la conciliación conoce exactamente qué Familia confirmó");
assert.equal(h.memory.get("A").actualizadaEn, 0, "las demás copias no pasan a considerarse confirmadas");
h.scope.reconcile();
assert.deepEqual(h.repairs, [], "no elimina el aporte válido de la Familia que no se releyó");

for (const action of [
  () => { h.scope.devolvibleAPersonal = 95; return h.scope.giveBack(); },
  () => { h.scope.seleccionados = ["nuevo"]; return h.scope.remove(); },
]) {
  h.reset(); await action(); await tick();
  assert.equal(h.network.writes, 1); assert.equal(h.network.lists, 0);
  assert.deepEqual(h.network.movements, ["f0"]); assert.deepEqual(h.network.members, ["f0"]);
  assert.equal(h.scope.familiaConfirmada.current, "f0", "devolver y borrar reales también usan el alcance dirigido");
}

// El fallback de una operación sin reload explícito también conserva el alcance.
h.reset();
await h.scope.ejecutar(async wait => { await wait(async () => { h.network.writes++; }); }, undefined, true, "f0"); await tick();
assert.equal(h.network.lists, 0); assert.deepEqual(h.network.movements, ["f0"]);
assert.deepEqual(h.network.members, ["f0"]); assert.equal(h.scope.familiaConfirmada.current, "f0");

// Una lectura fallida nunca autoriza conciliar la vieja copia de ninguna Familia.
h.reset(); h.network.fail = true;
await h.scope.ejecutar(async wait => { await wait(async () => {}); await wait.reload(); }, undefined, true, "f0"); await tick();
h.scope.reconcile(); assert.deepEqual(h.repairs, []); assert.equal(h.scope.familiasSincronizadas, false);
assert.equal(h.network.lists, 0); assert.deepEqual(h.network.movements, ["f0"]);
h.network.fail = false;

// Manual/foco y acciones estructurales conservan la consulta global. No se
// reutiliza el alcance anterior por accidente al cerrar, crear o unirse.
for (const load of [
  () => h.scope.recargar(undefined, true),
  () => h.scope.ejecutar(async wait => { await wait(async () => {}); await wait.reload("f0"); }),
]) {
  h.reset(); await load(); await tick();
  assert.equal(h.network.lists, 1); assert.equal(h.network.movements.length, 8);
  assert.equal(h.scope.familiaConfirmada.current, null);
}
// Si la sesión cambia durante la confirmación, tampoco inicia la recarga.
h.reset();
await h.scope.ejecutar(async wait => { await wait(async () => { h.account.session = 2; }); }, undefined, true, "f0"); await tick();
assert.equal(h.network.lists, 0); assert.equal(h.network.movements.length, 0); assert.deepEqual(h.repairs, []);
h.scope.stopMutation();
console.log(JSON.stringify({ familyAPICalls: { full, directed }, accountGuards: true, confirmedScopeOnly: true, syntheticOnly: true }));

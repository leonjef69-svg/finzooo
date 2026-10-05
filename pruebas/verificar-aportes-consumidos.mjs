import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = file => process.env.FINO_TEST_BASELINE && (process.env.FINO_TEST_BASELINE !== "local-delete" || file === "screens/Cajas.tsx")
  ? execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const localScope = { exports: {}, module: { exports: {} } };
localScope.exports = localScope.module.exports;
vm.runInNewContext(ts.transpile(read("utils/linkedTransfers.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), localScope);
const local = localScope.module.exports;
const serverScope = { module: { exports: {} } };
vm.runInNewContext(read("functions/src/personal-contribution.js"), serverScope);
const server = serverScope.module.exports;

const contribution = { id: "mov-aporte", cajaId: "caja-local", tipo: "ingreso", monto: 100,
  personalTransactionId: 10, personalOwnerUid: "ana" };
const spent = { id: "mov-gasto", cajaId: "caja-local", tipo: "gasto", monto: 100 };
const returned = { id: "mov-retorno", cajaId: "caja-local", tipo: "gasto", monto: 40,
  personalTransactionId: 11, personalOwnerUid: "ana", personalReturnAmount: 40 };
for (const [movements, allowed] of [
  [[contribution, spent], true],
  [[contribution, { ...spent, monto: 60 }, returned], true],
  [[contribution, { ...spent, monto: 60 }], false],
  [[contribution, { ...returned, monto: 100, personalReturnAmount: 100 }], true],
  [[contribution, { ...returned, monto: 100, personalReturnAmount: 100, personalOwnerUid: "bob" }], false],
  [[contribution, { ...returned, monto: 100, personalReturnAmount: 120 }], false],
  [[{ ...contribution, monto: NaN }], false],
]) {
  assert.equal(local.canCloseLinkedSpace(movements), allowed, "cierre local según saldo recuperable, no deuda ficticia");
  assert.equal(server.canCloseLinkedSpace(movements), allowed, "el servidor coincide con el teléfono");
}
assert.equal(local.hasUnreturnedPersonalContribution([contribution, spent], "ana"), false);
assert.equal(server.hasUnreturnedPersonalContribution([contribution, spent], "ana"), false);
assert.equal(local.hasUnreturnedPersonalContribution([contribution, { ...spent, monto: 60 }], "ana"), true);
assert.equal(local.returnableToPersonal([contribution, spent], "ana"), 0);
assert.equal(local.canUndoContribution([contribution, spent], contribution), false, "consumido no autoriza borrar un aporte gastado");
assert.equal(server.contributionLimits([contribution, spent], "ana", 100).canDelete, false);

const personal = [
  { id: 10, type: "expense", amount: 100, internalTransfer: "box", internalTransferSpaceId: "caja-local", internalTransferLink: contribution.id },
  { id: 11, type: "income", amount: 40, internalTransfer: "box", internalTransferSpaceId: "caja-local", internalTransferLink: returned.id,
    internalTransferAllocations: [{ transactionId: 10, amount: 40 }] },
  { id: 12, type: "expense", amount: 20, internalTransfer: "box", internalTransferSpaceId: "caja-otra", internalTransferLink: "mov-otra" },
];
const settled = local.settlePersonalTransfers(personal, "box", "caja-local");
assert.equal(settled.length, 2, "marca aporte y devolución, no otra Caja");
assert.equal(personal[0].internalTransferSettled, undefined, "la preparación no modifica la lista original");
const closedPersonal = personal.map(item => settled.find(updated => updated.id === item.id) || item);
assert.equal(local.settlePersonalTransfers(closedPersonal, "box", "caja-local").length, 0, "cerrar de nuevo no duplica registros");
const balance = items => items.reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0);
assert.equal(balance(closedPersonal), balance(personal), "cerrar no inventa un ingreso ni cambia montos");
assert.equal(local.personalTransferStatuses(closedPersonal).get(10), "consumed");
const summary = local.compactPersonalTransferRows(closedPersonal).find(row => row.item.id === 10).transferGroup;
assert.equal(summary.pending, 0);
assert.equal(summary.consumed, 60);
assert.equal(summary.returned, 40);
assert.equal(summary.sent, 100);
assert.equal(summary.status, "consumed");
const previousMonth = local.compactPersonalTransferRows([closedPersonal[0]])[0].transferGroup;
assert.equal(previousMonth.consumed, 60, "la devolución de otro mes no se cuenta como consumida");
assert.equal(previousMonth.pending, 0, "el filtro mensual no inventa una deuda en el espacio cerrado");
assert.equal(local.netTransferredFromPersonal(closedPersonal, "box"), 80, "lo consumido sigue descontado de Personal");
const large = Array.from({ length: 10_000 }, (_, id) => [
  { id: `income-${id}`, tipo: "ingreso", monto: 1, personalTransactionId: id + 1, personalOwnerUid: `owner-${id}` },
  { id: `spent-${id}`, tipo: "gasto", monto: 1 },
]).flat();
const started = performance.now();
assert.equal(local.canCloseLinkedSpace(large), true);
assert.equal(server.canCloseLinkedSpace(large), true);
assert.ok(performance.now() - started < 3000, "20.000 registros no generan una comprobación cuadrática del cierre");

function declarations(file, names) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.set(node.name.text, node.getText(ast));
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) found.set(node.name.getText(ast), `const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return names.map(name => { assert.ok(found.has(name), `declaración real ${name}`); return found.get(name); }).join("\n");
}
function execute(source, scope, expression) {
  vm.runInNewContext(ts.transpile(source + `\nresult = ${expression};`, { target: ts.ScriptTarget.ES2022 }), scope);
  return scope.result;
}
const deleteSource = declarations("screens/Cajas.tsx", ["borrarSeleccionados"]);
async function deleteLocal(movements, selected) {
  let data = { cajas: [{ id: "caja-local" }], movimientos: movements, movimientosBorrados: [] };
  const removedPersonal = [], messages = [];
  let rpcCount = 0;
  const scope = { movimientos: movements, seleccionados: selected, planSpaceMovementDeletion: local.planSpaceMovementDeletion,
    cuentaActual: () => true, ready: true, compartiendo: false,
    borrarAportePersonal: async () => { rpcCount++; throw new Error("NO_SERVER_FOR_LOCAL_BOX"); },
    deleteLinkedTransferTransaction: id => removedPersonal.push(id), setDatos: update => { data = update(data); },
    showToast: message => messages.push(message), t: key => key, setSeleccionados() {}, setSeleccionando() {} };
  await execute(deleteSource, scope, "borrarSeleccionados()");
  return { data, removedPersonal, messages, rpcCount };
}
const intact = await deleteLocal([contribution], [contribution.id]);
assert.equal(intact.rpcCount, 0, "Caja privada no usa el servidor compartido");
assert.equal(intact.data.movimientos.length, 0);
assert.deepEqual(intact.removedPersonal, [10]);
const blocked = await deleteLocal([contribution, spent], [contribution.id]);
assert.equal(blocked.data.movimientos.length, 2);
assert.deepEqual(blocked.removedPersonal, []);
assert.deepEqual(blocked.messages, ["boxes.contributionUsed"]);
const fullPair = await deleteLocal([contribution, { ...returned, monto: 100, personalReturnAmount: 100 }], [contribution.id, returned.id]);
assert.equal(fullPair.data.movimientos.length, 0);
assert.deepEqual(fullPair.removedPersonal, [11, 10]);

const cajaScope = { isPremium: true, nubeConfirmadaPara: { current: "ana" }, auth: { currentUser: { uid: "ana" } },
  datos: { cajas: [{ id: "caja-otra" }], movimientosBorrados: [contribution.id, returned.id] },
  transactions: personal, movimientosPorId: new Map() };
const deleted = execute(declarations("screens/Cajas.tsx", ["borradosExplicitos", "cajasActivas", "orphanIds"]), cajaScope, "orphanIds");
assert.deepEqual(Array.from(deleted), [], "ni Caja cerrada ni ausencia sin marca devuelven dinero ficticio");
cajaScope.datos.movimientosBorrados.push("mov-otra");
const explicitDeleted = execute(declarations("screens/Cajas.tsx", ["borradosExplicitos", "cajasActivas", "orphanIds"]), { ...cajaScope }, "orphanIds");
assert.deepEqual(Array.from(explicitDeleted), [12], "una marca explícita sí permite conciliar el borrado de la Caja activa, sin tocar la cerrada");
const familyScope = { familias: [{ id: "familia-activa" }], transactions: [
  { id: 1, internalTransfer: "family", internalTransferSpaceId: "familia-cerrada", internalTransferLink: "cerrado" },
  { id: 2, internalTransfer: "family", internalTransferSpaceId: "familia-activa", internalTransferLink: "eliminado" },
], validMovementIds: [], orphanedPersonalTransferIds: local.orphanedPersonalTransferIds };
const familyDeleted = execute(declarations("screens/Family.tsx", ["familiasActivas", "conciliables", "orphanIds"]), familyScope, "orphanIds");
assert.deepEqual(Array.from(familyDeleted), [2], "Familia cerrada no convierte su ausencia en devolución ficticia");

const closeScope = { datos: { cajas: [{ id: "caja-local" }], movimientos: [contribution, { ...spent, monto: 60 }, returned], cajasBorradas: [], movimientosBorrados: [] },
  cuentaActual: () => true, ready: true, compartiendo: false,
  cajasSeleccionadas: ["caja-local"], canCloseLinkedSpace: local.canCloseLinkedSpace, settlePersonalTransfers: local.settlePersonalTransfers,
  transactions: personal, repairLinkedTransferTransactions: updates => { closeScope.personalUpdates = updates; },
  setDatos: update => { closeScope.datos = update(closeScope.datos); }, setCajasSeleccionadas() {}, setSeleccionandoCajas() {},
  showToast() { throw new Error("SHOULD_CLOSE"); }, t: key => key };
execute(declarations("screens/Cajas.tsx", ["borrarCajas"]), closeScope, "borrarCajas()");
assert.equal(closeScope.datos.cajas.length, 0);
assert.equal(closeScope.personalUpdates.length, 2, "cerrar conserva las dos mitades históricas");
assert.equal(balance(closeScope.personalUpdates), -60);
assert.equal(closeScope.datos.movimientosBorrados.length, 3);

// No se evalúa ni modifica ningún dato real de Firebase.
assert.equal(require("../functions/src/personal-contribution.js").canCloseLinkedSpace([contribution, spent]), true);
console.log("Aportes: consumidos sin deuda ficticia; cierre sin reaparecer dinero; borrado local intacto y gastado comprobados.");

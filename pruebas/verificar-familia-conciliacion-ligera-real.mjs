import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// Ejecuta el efecto original completo, incluidas sus guardas. Solo se adaptan
// React, sesión e IO: las asignaciones de devoluciones son las de la app.
const read = createSourceReader();
const transpile = source => ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
function originalModule(file, require = () => ({})) {
  const module = { exports: {} };
  vm.runInNewContext(transpile(read(file)), { module, exports: module.exports, require });
  return module.exports;
}
const linked = originalModule("utils/linkedTransfers.ts");
const horaDe = handlerOriginal("utils/format.ts", "horaDe", {}, read("utils/format.ts"));
const file = "screens/Family.tsx";
const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect"
    && node.arguments[0]?.getText(tree).includes("const todosLosMovimientos")) effect = node.arguments[0].getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(effect, "efecto real de conciliación encontrado");
const metrics = { movementIds: 0, personalIds: 0, ledgers: 0 };
function countedId(item, key) {
  const { id, ...rest } = item;
  return Object.freeze({ ...rest, get id() { metrics[key]++; return id; } });
}
function fixture() {
  const familias = [], movimientosFamilias = {};
  for (let f = 0; f < 8; f++) {
    const spaceId = `family-${f}`, base = f * 1_000;
    familias.push({ id: spaceId, nombre: `Familia ${f}` });
    const movements = [];
    for (let c = 0; c < 30; c++) movements.push({ id: `${spaceId}-aporte-${c}`, tipo: "ingreso", monto: 100,
      personalTransactionId: base + c + 1, personalOwnerUid: "A", creadoEn: c + 1, fecha: "2026-10-22", creadoPor: "A", descripcion: "Aporte" });
    for (let r = 0; r < 20; r++) movements.push({ id: `${spaceId}-retorno-${r}`, tipo: "gasto", monto: 10,
      personalReturnAmount: 10, personalTransactionId: base + 100 + r, personalOwnerUid: "A", creadoEn: 101 + r,
      fecha: "2026-10-23", creadoPor: "A", descripcion: "Devolución" });
    movements.push({ id: `${spaceId}-ajeno`, tipo: "ingreso", monto: 55, personalTransactionId: base + 999,
      personalOwnerUid: "B", creadoEn: 1, fecha: "2026-10-23", creadoPor: "B", descripcion: "Otro integrante" });
    movements.push({ id: `${spaceId}-externo`, tipo: "ingreso", monto: 45, creadoEn: 2,
      fecha: "2026-10-23", creadoPor: "A", descripcion: "Externo" });
    movimientosFamilias[spaceId] = Object.freeze(movements.map(item => countedId(item, "movementIds")));
  }
  return { familias: Object.freeze(familias), movimientosFamilias: Object.freeze(movimientosFamilias) };
}
function harness(data, transactions = []) {
  const writes = [], account = { uid: "A", session: 1 }, auth = { get currentUser() { return { uid: account.uid }; } };
  const getAccountStorageSession = () => account.session;
  const { captureAccountTask } = originalModule("utils/accountTask.ts", name => name.endsWith("firebase") ? { auth } : { getAccountStorageSession });
  const mutations = originalModule("utils/familyMutation.ts");
  const scope = { ...linked, ...mutations, ...data, auth, accountUid: "A", accountSession: 1, getAccountStorageSession, captureAccountTask,
    mounted: { current: true }, reloadId: { current: 7 }, confirmedReload: { current: 7 }, familiaConfirmada: { current: null }, actionLock: { current: false },
    cargando: false, familiasSincronizadas: true, familia: null, movimientos: [], transactions,
    horaDe, t: (key, values) => `${key}:${values.name}`, legacyRepairIds: { current: new Set() },
    linkedTransferLedger: (...args) => { metrics.ledgers++; return linked.linkedTransferLedger(...args); },
    repairLinkedTransferTransactions: (upserts, removed) => { writes.push(plain({ upserts, removed })); return true; },
    vincularMovimientoPersonalFamilia() { throw new Error("No se deben crear vínculos adicionales"); } };
  vm.runInNewContext(transpile(`globalThis.reconcile = (${effect});`), scope);
  return { scope, writes, account, run: () => { scope.reconcile(); } };
}
const data = fixture();
const before = plain(data);
const existing = [
  { id: 90_000, type: "expense", amount: 9, internalTransfer: "family", internalTransferSpaceId: "family-0", internalTransferLink: "quitado" },
  { id: 90_001, type: "expense", amount: 7, internalTransfer: "family", internalTransferSpaceId: "cerrada", internalTransferLink: "histórico" },
  { id: 90_002, type: "expense", amount: 8, internalTransfer: "family", internalTransferSpaceId: "family-0", internalTransferLink: "consumido", internalTransferSettled: true },
  { id: 90_003, type: "expense", amount: 1, internalTransfer: "box", internalTransferSpaceId: "family-0", internalTransferLink: "otra-caja" },
];
metrics.movementIds = metrics.personalIds = metrics.ledgers = 0;
const first = harness(data, existing);
first.run();
assert.equal(first.writes.length, 1);
assert.equal(first.writes[0].upserts.length, 400, "solo 30 aportes y 20 devoluciones de la cuenta por cada familia");
assert.deepEqual(first.writes[0].removed, [90_000], "ausencia activa se concilia; cerrado, consumido y Caja se conservan");
for (let f = 0; f < 8; f++) {
  const base = f * 1_000;
  const sent = first.writes[0].upserts.find(item => item.id === base + 1);
  assert.equal(sent.type, "expense"); assert.equal(sent.amount, 100);
  assert.equal(sent.internalTransferSpaceId, `family-${f}`);
  assert.equal(sent.description, `family.transferTo:Familia ${f}`);
  for (let r = 0; r < 20; r++) {
    const returned = first.writes[0].upserts.find(item => item.id === base + 100 + r);
    assert.equal(returned.type, "income"); assert.equal(returned.amount, 10);
    assert.equal(returned.description, `family.returnFrom:Familia ${f}`);
    assert.deepEqual(returned.internalTransferAllocations, [{ transactionId: base + Math.floor(r / 10) + 1, amount: 10 }]);
  }
}
// Releer una copia confirmada correcta no provoca otra escritura financiera.
const complete = [...first.writes[0].upserts, ...existing.slice(1)].map(item => countedId(item, "personalIds"));
metrics.movementIds = metrics.personalIds = metrics.ledgers = 0;
const stable = harness(data, Object.freeze(complete));
stable.run();
assert.deepEqual(stable.writes, []);
const measured = { ...metrics };
const duplicate = harness(data, [...complete, { ...plain(complete[0]), amount: 999 }]);
duplicate.run();
assert.deepEqual(duplicate.writes, [], "un ID repetido conserva la primera coincidencia, como la búsqueda anterior");

// Los índices se reconstruyen con la fuente nueva, no sobreviven a un cambio.
const changed = { ...data, movimientosFamilias: { ...data.movimientosFamilias,
  "family-0": data.movimientosFamilias["family-0"].map(item => item.id === "family-0-retorno-0"
    ? { ...item, monto: 18, personalReturnAmount: 18 } : item) } };
const next = harness(changed, complete);
next.run();
const newReturn = next.writes[0].upserts.find(item => item.id === 100);
assert.equal(newReturn.amount, 18);
assert.deepEqual(newReturn.internalTransferAllocations, [{ transactionId: 1, amount: 18 }]);
assert.ok(next.writes[0].upserts.some(item => item.id === 109), "la nueva distribución también actualiza devoluciones posteriores");

// Ninguna optimización adelanta el cálculo a una lectura parcial, sesión vieja
// o modificación pendiente. Tampoco crea una confirmación financiera aparente.
for (const prepare of [
  h => { h.scope.cargando = true; },
  h => { h.scope.familiasSincronizadas = false; },
  h => { h.scope.confirmedReload.current = 6; },
  h => { h.scope.actionLock.current = true; },
  h => { h.scope.mounted.current = false; },
  h => { h.account.uid = "B"; },
  h => { h.account.session = 2; },
  h => { h.scope.beginFamilyMutation("A", 1); },
]) {
  const h = harness(data, complete);
  prepare(h);
  metrics.movementIds = metrics.personalIds = metrics.ledgers = 0;
  h.run();
  assert.deepEqual(h.writes, []);
  assert.equal(metrics.ledgers, 0);
  assert.equal(metrics.movementIds, 0);
}
assert.deepEqual(plain(data), before, "las fuentes originales no cambian");
console.log(`Familia: 416 movimientos, 403 personales; ${measured.ledgers} repartos, ${measured.movementIds} accesos a ID de movimiento y ${measured.personalIds} a Personal.`);
assert.equal(measured.ledgers, 8, "una sola distribución por Familia, no una por devolución");
assert.ok(measured.personalIds <= complete.length * 4, "un índice recorre Personal un número fijo de veces");
assert.ok(measured.movementIds <= 416 * 8, "la localización por Familia no crece por cada aporte");
console.log("Familia ligera: mismas contrapartes, montos/repartos, ausencia sin escrituras repetidas, fuentes nuevas y guardas de cuenta/confirmación comprobadas; solo datos sintéticos.");

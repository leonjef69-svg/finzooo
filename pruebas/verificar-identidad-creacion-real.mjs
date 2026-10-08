import assert from "node:assert/strict";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_CREATION_ID_BASELINE ?? "" });
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpile(read(file), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }), { exports, ...dependencies });
  return exports;
}
const now = Date.UTC(2026, 9, 8, 12);
class Clock extends Date { static now() { return now; } }
function phone(byte) {
  const math = Object.create(Math); math.random = () => byte / 255;
  return load("utils/id.ts", { Date: Clock, Math: math, require: name => {
    assert.equal(name, "expo-crypto");
    // IO nativo sustituido. UUID independiente de Node, bytes deterministas
    // para demostrar el antiguo máximo compartido y forzar una colisión.
    return { randomUUID, getRandomValues: bytes => { bytes.fill(byte); return bytes; } };
  } });
}
const a = phone(1), b = phone(254);
const maximum = a.idCandidate(now, 4095) + 10_000;
a.reserveIdsAbove(maximum); b.reserveIdsAbove(maximum);
const idA = a.nextId(), idB = b.nextId();
assert.notEqual(idA, idB, "restaurar el mismo máximo no convierte azar distinto en máximo + 1");
assert.ok(Number.isSafeInteger(idA) && idA > maximum);
assert.ok(Number.isSafeInteger(idB) && idB > maximum);
const c = phone(255); c.reserveIdsAbove(maximum);
let last = maximum;
for (let i = 0; i < 100_000; i++) {
  const next = c.nextId();
  assert.ok(Number.isSafeInteger(next) && next > last);
  last = next;
}
const exhausted = phone(1); exhausted.reserveIdsAbove(Number.MAX_SAFE_INTEGER);
assert.throws(() => exhausted.nextId(), /record-id-space-exhausted/, "agotarse detiene el alta, no redondea ni reutiliza IDs");
const failedCrypto = load("utils/id.ts", { Date: Clock, require: () => ({ getRandomValues() { throw new Error("native entropy failed"); }, randomUUID }) });
assert.throws(() => failedCrypto.nextId(), /native entropy failed/, "sin entropía no inventar un ID reutilizable");
const order = load("utils/ordenarMovimientos.ts");
const merge = load("utils/mergeTransactions.ts", { require: name => {
  assert.equal(name, "@/utils/ordenarMovimientos"); return order;
} });
const x = phone(100), y = phone(100); x.reserveIdsAbove(maximum); y.reserveIdsAbove(maximum);
const equalA = x.nextId(), equalB = y.nextId();
assert.equal(equalA, equalB, "forzamos una coincidencia numérica, no solo probamos azar favorable");
const originA = x.issuedCreationId(equalA), originB = y.issuedCreationId(equalB);
assert.notEqual(originA, originB);
const movement = (creationId, amount = 10) => ({ id: equalA, creationId, updatedAt: 10, amount,
  type: "expense", category: "servicios", date: "2026-10-08", method: "cash", description: "Compra", notes: "" });
const first = movement(originA), other = movement(originB, 20);
const goal = creationId => ({ id: equalA, creationId, name: "Meta", target: 100, saved: 0, createdDate: "2026-10-08", completed: false });
const before = JSON.stringify([first, other]);
for (const [left, right] of [[first, other], [other, first]]) {
  assert.throws(() => merge.mergeTransactions([left], [right]), /record-origin-conflict/);
  assert.throws(() => merge.mergeTransactions([left], [{ ...right, creationId: undefined }]), /record-origin-conflict/);
}
assert.equal(JSON.stringify([first, other]), before);
assert.throws(() => merge.mergeGoals([goal(originA)], [goal(originB)]), /record-origin-conflict/);
assert.equal(merge.mergeTransactions([first], [{ ...first, amount: 15, updatedAt: 20 }])[0].amount, 15);
assert.equal(merge.mergeGoals([goal(originA)], [goal(originA)]).length, 1);
const writes = [], messages = [];
const deps = { ...merge, issuedCreationId: x.issuedCreationId, transactionsLive: { current: [first] },
  goalsLive: { current: [goal(originA)] }, deletedTransactionIdsRef: { current: [] }, deletedGoalIds: [],
  isPremium: true, isSafeMoneyAmount: () => true, metaConEstadoActual: value => value,
  showToast: key => messages.push(key), t: key => key, setTransactions: update => writes.push(update), setGoals: update => writes.push(update),
};
const saveMovement = handlerOriginal("contexts/AppDataContext.tsx", "addOrUpdateTransaction", deps, read("contexts/AppDataContext.tsx"));
const saveGoal = handlerOriginal("contexts/AppDataContext.tsx", "addOrUpdateGoal", deps, read("contexts/AppDataContext.tsx"));
assert.equal(saveMovement(other), false);
assert.equal(saveGoal(goal(originB)), false);
assert.deepEqual(writes, [], "colisión en alta/edición no cambia la lista ni se presenta como éxito");
assert.equal(saveMovement({ ...first, amount: 15 }), true);
assert.equal(saveGoal({ ...goal(originA), name: "Editada" }), true);
assert.equal(writes.length, 2);
assert.equal(saveMovement({ ...first, creationId: undefined, amount: 15 }), true,
  "un formulario de edición conserva la identidad guardada, no crea otra");
deps.transactionsLive.current = []; deps.goalsLive.current = [];
const brandNew = a.nextId(), input = { ...movement(undefined), id: brandNew };
const addDeps = { ...deps, issuedCreationId: a.issuedCreationId, setTransactions: update => {
  const rows = update([]); assert.equal(rows[0].creationId, a.issuedCreationId(brandNew));
} };
assert.equal(handlerOriginal("contexts/AppDataContext.tsx", "addOrUpdateTransaction", addDeps, read("contexts/AppDataContext.tsx"))(input), true);
console.log("Originales/IO adaptado: máximo común y reloj fijo no fuerzan mismo ID; colisión numérica forzada conserva copias manuales/metas, edición misma identidad válida, agotamiento falla cerrado. Android pendiente.");

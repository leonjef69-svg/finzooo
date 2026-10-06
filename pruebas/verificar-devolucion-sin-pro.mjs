import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const read = file => process.env.FINO_TEST_BASELINE ? execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
if (process.env.FINO_TEST_BASELINE) {
  const ast = ts.createSourceFile("old-family.tsx", read("screens/Family.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let oldReturn;
  function findOld(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "devolverAPersonal") oldReturn = node.getText(ast);
    ts.forEachChild(node, findOld);
  }
  findOld(ast);
  const previous = { ejecutar: work => work(), auth: { currentUser: { uid: "owner" } }, familia: { id: "f", nombre: "Casa", currency: "PEN" },
    userCurrency: "PEN", devolvibleAPersonal: 40, nextId: () => 100, movimientos: [], allocatePersonalReturn: () => [],
    t: key => key, fechaHoy: () => "2026-10-05", horaDe: () => "12:00", showToast() {},
    guardarMovimientoFamilia: async () => { throw new Error("permission-denied: la ruta SDK anterior exige Pro"); },
    addOrUpdateTransaction() { throw new Error("sin-confirmacion"); }, recargar: async () => {} };
  vm.runInNewContext(ts.transpile(`const ${oldReturn};\nrun = devolverAPersonal;`, { target: ts.ScriptTarget.ES2022 }), previous);
  await assert.doesNotReject(previous.run(), "la devolución de Gratis debe usar el servicio permitido, no la escritura SDK que exige Pro");
  process.exit(0);
}
const currencyScope = { exports: {} };
vm.runInNewContext(ts.transpile(fs.readFileSync("constants/currencies.ts", "utf8"), { module: ts.ModuleKind.CommonJS }), currencyScope);
const store = new Map();
let uid = "owner", session = 1, next = 100, rpc = 0, failSave = false, lost = false, release, started;
const receipts = new Map();
const storage = { STORAGE_KEYS: { personalReturnPending: "pending", transactions: "transactions" }, getAccountStorageSession: () => session,
  loadJSON: async (key, fallback) => store.has(key) ? JSON.parse(JSON.stringify(store.get(key))) : fallback,
  saveJSONNow: async (key, value) => { if (failSave) return false; store.set(key, JSON.parse(JSON.stringify(value))); return true; } };
const auth = { get currentUser() { return { uid, emailVerified: true }; } };
function client() {
  const scope = { module: { exports: {} }, exports: {}, require: name => {
    if (name === "@/utils/firebase") return { auth, functions: {} };
    if (name === "@/utils/id") return { nextId: () => next++ };
    if (name === "@/constants/currencies") return currencyScope.exports;
    if (name === "@/utils/storage") return storage;
    if (name === "firebase/functions") return { httpsCallable: (_functions, name) => async payload => {
      assert.equal(name, "returnPersonalContribution"); rpc++;
      assert.equal(store.get("pending").payload.personalTransactionId, payload.personalTransactionId, "guarda la orden antes de pedir el reembolso");
      const key = payload.personalTransactionId;
      if (!receipts.has(key)) receipts.set(key, { ...payload, uid: "owner", movementId: `return_${key}`, spaceName: "Casa", createdAt: 1000,
        allocations: [{ transactionId: 10, amount: payload.amount }] });
      if (started) { started(); await new Promise(resolve => { release = resolve; }); }
      if (lost) { lost = false; throw new Error("network-error"); }
      return { data: receipts.get(key) };
    } };
    throw new Error(name);
  } };
  scope.exports = scope.module.exports;
  vm.runInNewContext(ts.transpile(read("utils/personalReturn.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), scope);
  return scope.module.exports;
}
const api = client(), input = { kind: "family", spaceId: "home", amount: 0.1 + 0.2, currency: "PEN", fecha: "2026-10-05", description: "Devolver" };
failSave = true;
await assert.rejects(api.devolverAportePersonal(input), /return-local-save-failed/);
assert.equal(rpc, 0, "no mueve el libro compartido si no puede guardar la orden local");
failSave = false; lost = true;
await assert.rejects(api.devolverAportePersonal(input), /network-error/);
assert.ok(store.get("pending"));
const rebooted = client();
const receipt = await rebooted.recoverPersonalReturn("owner");
assert.equal(receipt.amount, 0.3);
assert.equal(receipts.size, 1, "al reiniciar recupera la misma devolución confirmada");
assert.equal(await rebooted.finishPersonalReturn(receipt), false, "no borra la orden antes de comprobar el ingreso en disco");
const tx = { id: receipt.personalTransactionId, type: "income", amount: receipt.amount, internalTransfer: receipt.kind,
  internalTransferSpaceId: receipt.spaceId, internalTransferLink: receipt.movementId };
let rows = rebooted.mergePersonalReturn([], tx);
rows = rebooted.mergePersonalReturn(rows, tx);
assert.equal(rows.length, 1, "repetir la recepción no duplica el ingreso");
const conflict = [{ ...tx, internalTransferSpaceId: "other" }];
assert.equal(rebooted.mergePersonalReturn(conflict, tx), conflict, "no pisa otro movimiento con el mismo número");
store.set("transactions", rows);
assert.equal(await rebooted.finishPersonalReturn(receipt), true);
assert.equal(store.get("pending"), null);
const calls = rpc;
assert.equal(await rebooted.recoverPersonalReturn("owner"), null);
assert.equal(rpc, calls, "sin orden pendiente no hay llamada financiera");

store.set("transactions", []);
let signal;
const requestStarted = new Promise(resolve => { signal = resolve; });
started = () => signal();
const future = rebooted.devolverAportePersonal({ ...input, amount: 40 });
await requestStarted;
uid = "another"; session++;
uid = "owner"; session++;
release();
await assert.rejects(future, /return-account-changed/, "A→B→A no acepta una respuesta de la sesión anterior");
started = null;
assert.ok(store.get("pending"), "no elimina una orden cuyo resultado quedó incierto");
const recovered = await client().recoverPersonalReturn("owner");
assert.equal(recovered.amount, 40);

// Ejecuta el registro real del contexto con sustitutos de React/Android.
const contextAst = ts.createSourceFile("context.tsx", read("contexts/AppDataContext.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let source;
function find(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "recordPersonalReturn") source = node.getText(contextAst); ts.forEachChild(node, find); }
find(contextAst); assert.ok(source, "existe el registro único y comprobado de la devolución");
const scope = { personalReturnIsCurrent: value => value.localSession === session && value.uid === uid,
  deletedTransactionIdsRef: { current: [] },
  currencyForReturn: { current: "PEN" }, tRef: { current: key => key }, returnReceipt: { current: null },
  horaDe: () => "12:00", mergePersonalReturn: rebooted.mergePersonalReturn,
  setTransactions: update => { rows = update(rows); }, showToast() {}, Date };
vm.runInNewContext(ts.transpile(source + "\nrecord = recordPersonalReturn;", { target: ts.ScriptTarget.ES2022 }), scope);
rows = [];
assert.equal(scope.record(recovered), true);
assert.equal(scope.record(recovered), true);
assert.equal(rows.length, 1);
scope.currencyForReturn.current = "USD";
assert.equal(scope.record(recovered), false, "no aplica una devolución a otra moneda");
assert.equal(rows.length, 1);

const serverCurrency = fs.readFileSync("functions/src/personal-return.js", "utf8");
assert.ok(serverCurrency.includes("returnPersonalContribution"));
const sharedMoney = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync("functions/src/money-units.js", "utf8"), sharedMoney);
const backendScope = { module: { exports: {} }, require: name => name === "node:crypto" ? {}
  : name === "./money-units" ? sharedMoney.module.exports : { invalidPersonalReturns() {} } };
vm.runInNewContext(serverCurrency, backendScope);
for (const currency of currencyScope.exports.CURRENCIES) assert.equal(backendScope.module.exports.currencyDecimals(currency.id), currencyScope.exports.currencyDecimals(currency.id), currency.id);
for (const file of ["screens/Family.tsx", "screens/SharedBoxes.tsx"]) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let operation;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "devolverAPersonal") operation = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.match(operation, /devolverAportePersonal/); assert.doesNotMatch(operation, /guardarMovimiento/);
}
console.log("Devolución sin Pro: orden guardada, recuperación tras reinicio, ingreso único, sesión y moneda protegidas.");

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const requireCore = createRequire(new URL("../utils/privateBoxMoneyLocalWrite.ts", import.meta.url));
const moneyGuard = { exports: {} };
vm.runInNewContext(ts.transpile(fs.readFileSync("utils/privateBoxMoneyLocalWrite.ts", "utf8"), { module: ts.ModuleKind.CommonJS }), { exports: moneyGuard.exports, require: requireCore });
const { assertPrivateBoxMoneyLocalIdle } = moneyGuard.exports;

const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && baseline !== "1" && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresión requiere 1 o un hash de Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline === "1" ? "HEAD" : baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const ast = ts.createSourceFile("context.tsx", read("contexts/AppDataContext.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["recordPersonalReturn", "removeTransactions"]), functions = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast); assert.equal(functions.length, 2);
let rows = [], uid = "owner", session = 1, failSave = false, rpcMode = "cancelled";
const storage = new Map();
const pending = { uid, payload: { kind: "family", spaceId: "f", amount: 40, currency: "PEN",
  fecha: "2026-10-05", description: "Devolver", personalTransactionId: 100 } };
const receipt = { ...pending.payload, uid, movementId: "return_100", spaceName: "Casa", createdAt: 1,
  allocations: [{ transactionId: 10, amount: 40 }], localSession: session };
function client() {
  const module = { exports: {} };
  const scope = { module, exports: module.exports, require: name => {
    if (name === "@/utils/firebase") return { functions: {}, auth: { get currentUser() { return { uid, emailVerified: true }; } } };
    if (name === "@/utils/id") return { nextId: () => 200 };
    if (name === "@/constants/currencies") return { currencyDecimals: () => 2 };
    if (name === "@/utils/storage") return { STORAGE_KEYS: { personalReturnPending: "pending", transactions: "rows" },
      getAccountStorageSession: () => session, loadJSON: async (key, fallback) => storage.get(key) ?? fallback,
      saveJSONNow: async (key, value) => { if (failSave) return false; storage.set(key, value); return true; } };
    if (name === "firebase/functions") return { httpsCallable: () => async () => {
      if (rpcMode === "network") throw new Error("network-error");
      if (rpcMode === "changed-account") { uid = "other"; session++; }
      const error = new Error("cancelled"); error.details = { reason: "return-cancelled" }; throw error;
    } };
    throw new Error(name);
  } };
  vm.runInNewContext(ts.transpile(read("utils/personalReturn.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), scope);
  return module.exports;
}
const api = client(), txQueue = [], deletionQueue = [];
const context = { assertPrivateBoxMoneyLocalIdle, deletedTransactionIdsRef: { current: [] }, returnReceipt: { current: null }, currencyForReturn: { current: "PEN" },
  personalReturnIsCurrent: value => value.uid === uid && value.localSession === session, mergePersonalReturn: api.mergePersonalReturn,
  tRef: { current: key => key }, horaDe: () => "12:00", showToast() {},
  pruneDeletedTransactionIds: values => [...new Set(values)], unlinkCreditPaymentsForHomeTransactions() {},
  setDeletedTransactionIds: update => deletionQueue.push(update), setTransactions: update => txQueue.push(update), Date };
// El nombre nativo se sustituye, no su lógica financiera ni los manejadores.
vm.runInNewContext(ts.transpile(functions.join("\n"), { target: ts.ScriptTarget.ES2022 }), context);
const tx = { id: 100, type: "income", amount: 40, internalTransfer: "family", internalTransferSpaceId: "f", internalTransferLink: "return_100" };
rows = [tx];
context.removeTransactions([100]);
assert.equal(context.recordPersonalReturn(receipt), false, "una respuesta atrasada no revive una devolución eliminada aunque React aún no haya procesado el borrado");
for (const update of txQueue.splice(0)) rows = update(rows);
let deleted = [];
for (const update of deletionQueue.splice(0)) deleted = update(deleted);
assert.equal(rows.length, 0); assert.deepEqual(Array.from(deleted), [100]);
context.deletedTransactionIdsRef.current = [];
assert.equal(context.recordPersonalReturn(receipt), true);
context.deletedTransactionIdsRef.current = [100]; // La marca llega antes de aplicar la recepción encolada.
for (const update of txQueue.splice(0)) rows = update(rows);
assert.equal(rows.length, 0, "también comprueba el borrado al aplicar, no solo al encolar");

storage.set("pending", pending);
await assert.rejects(client().recoverPersonalReturn(uid), error => error.details?.reason === "return-cancelled");
assert.equal(storage.get("pending"), null, "una anulación confirmada retira la orden, no registra un ingreso nuevo");
storage.set("pending", pending); failSave = true;
await assert.rejects(client().recoverPersonalReturn(uid), /return-local-save-failed/);
assert.equal(storage.get("pending"), pending, "fallar al retirar la orden no la pierde");
failSave = false; rpcMode = "network";
await assert.rejects(client().recoverPersonalReturn(uid), /network-error/);
assert.equal(storage.get("pending"), pending, "una caída de red no se interpreta como anulación");
rpcMode = "changed-account";
await assert.rejects(client().recoverPersonalReturn(uid), /return-account-changed/);
assert.equal(storage.get("pending"), pending, "otra sesión no retira la orden anterior");
console.log("Devolución anulada: respuesta atrasada bloqueada, orden retirada solo tras confirmación y errores/sesión protegidos.");

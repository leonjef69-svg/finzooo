import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { familyMutationOriginal } from "./helpers/family-mutation-original.mjs";

const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const tick = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
function arrow(file, name, scope) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer; ts.forEachChild(node, visit); }
  visit(tree); assert.ok(found, name);
  vm.runInNewContext(ts.transpile(`globalThis.action = ${found.getText(tree)};`, { target: ts.ScriptTarget.ES2022 }), scope);
  return scope.action;
}
function task(valid) { return { current: valid, wait: async work => {
  if (!valid()) throw Error("account-task-obsolete"); const result = await work();
  if (!valid()) throw Error("account-task-obsolete"); return result;
} }; }
function harness(kind) {
  const state = { uid: "A", session: 1, rows: [], notifications: [] };
  let complete, reject;
  const rpc = new Promise((resolve, fail) => { complete = resolve; reject = fail; });
  const memory = new Map([["A", { familia: { id: "space" }, familias: [{ id: "space" }], movimientos: [{ tipo: "ingreso", monto: 100 }],
    movimientosFamilias: { space: [{ tipo: "ingreso", monto: 100 }] }, saldosFamilias: { space: 100 }, actualizadaEn: Date.now() }]]);
  const scope = { ...familyMutationOriginal(memory), accountUid: "A", uid: "A", accountSession: 1, mounted: { current: true },
    getAccountStorageSession: () => state.session, auth: { get currentUser() { return { uid: state.uid }; } },
    userCurrency: "PEN", devolvibleAPersonal: 100, familia: { id: "space", currency: "PEN" }, caja: { id: "space", currency: "PEN" },
    actionLock: { current: false }, reloadId: { current: 0 }, cierresPendientes: { current: new Set() },
    lock: { current: false }, moneyLock: { current: false }, movementEpoch: { current: 0 }, confirmedSource: { current: null },
    setMovimientosConfirmados() {}, setBusy() {}, setOcupado() {}, setFamiliasSincronizadas() {}, setSubscriptionRevision() {},
    t: key => key, spaceErrorKey: error => error.message, showToast: message => state.notifications.push(message), errorRef: { current: () => {} },
    fechaHoy: () => "2026-10-17", recargar: async () => {}, Date,
    captureAccountTask: (_uid, valid) => task(() => valid() && state.uid === "A" && state.session === 1),
    devolverAportePersonal: () => rpc,
    assertPrivateBoxMoneyLocalIdle() {}, currencyForReturn: { current: "PEN" }, returnReceipt: { current: null },
    deletedTransactionIdsRef: { current: [] }, pendingTransactionDeletes: { current: new Set() }, tRef: { current: key => key }, horaDe: () => "12:00",
    setTransactions: update => { state.rows = update(state.rows); },
  };
  scope.personalReturnIsCurrent = handlerOriginal("utils/personalReturn.ts", "personalReturnIsCurrent", scope);
  scope.mergePersonalReturn = handlerOriginal("utils/personalReturn.ts", "mergePersonalReturn", {});
  scope.recordPersonalReturn = handlerOriginal("contexts/AppDataContext.tsx", "recordPersonalReturn", scope, read("contexts/AppDataContext.tsx"));
  const file = kind === "family" ? "screens/Family.tsx" : "screens/SharedBoxes.tsx";
  scope.ejecutar = handlerOriginal(file, "ejecutar", scope, read(file));
  const run = arrow(file, "devolverAPersonal", scope);
  const receipt = { uid: "A", localSession: 1, kind, spaceId: "space", personalTransactionId: 101, movementId: "return_101", currency: "PEN",
    amount: 100, fecha: "2026-10-17", createdAt: 1, spaceName: "Prueba", allocations: [{ transactionId: 100, amount: 100 }] };
  return { state, scope, run, receipt, complete, reject, memory };
}

// Primera aserción también se ejecuta contra 2d97a63: falla por perder la
// recepción al salir, no porque falte una función nueva.
for (const kind of ["family", "box"]) {
  const h = harness(kind), work = h.run(); await tick();
  h.scope.mounted.current = false; h.complete(h.receipt); await work;
  assert.equal(h.state.rows.length, 1, `${kind}: salir de la pantalla no pierde la recepción confirmada de S/100`);
  assert.equal(h.state.rows[0].amount, 100); assert.equal(h.state.rows[0].internalTransfer, kind);
  assert.equal(h.scope.familyMutationPending("A", 1, kind), false);
  assert.equal(h.scope.recordPersonalReturn(h.receipt), true); assert.equal(h.state.rows.length, 1, "confirmación repetida sin dinero duplicado");
}
for (const kind of ["family", "box"]) for (const reason of ["another-account", "same-account-new-session", "deleted", "currency", "network"]) {
  const h = harness(kind), work = h.run(); await tick(); h.scope.mounted.current = false;
  if (reason === "another-account") { h.state.uid = "B"; h.state.session++; }
  if (reason === "same-account-new-session") h.state.session += 2;
  if (reason === "deleted") h.scope.deletedTransactionIdsRef.current = [101];
  if (reason === "currency") h.scope.currencyForReturn.current = "USD";
  if (reason === "network") h.reject(Error("network-error")); else h.complete(h.receipt);
  await work; assert.equal(h.state.rows.length, 0, `${kind}/${reason}: sin dinero nuevo ni devolución resucitada`);
  assert.equal(h.scope.familyMutationPending("A", 1, kind), false);
}
{
  const h = harness("family"), work = h.run(); await tick();
  assert.equal(h.memory.get("A").actualizadaEn, 0, "una modificación invalida la copia antes de esperar al servidor");
  assert.equal(h.memory.get("A").saldosFamilias.space, undefined, "no ofrecer el S/100 anterior como saldo vigente al volver");
  h.scope.mounted.current = false; h.complete(h.receipt); await work;
  assert.equal(h.memory.get("A").actualizadaEn, 0, "la pantalla anterior tampoco rejuvenece una copia vieja al terminar");
}
{
  const api = familyMutationOriginal(), received = [];
  const stop = api.observeFamilyMutation("A", 1, () => received.push(api.familyMutationPending("A", 1)));
  const finishA = api.beginFamilyMutation("A", 1), finishB = api.beginFamilyMutation("B", 1), finishOtherSession = api.beginFamilyMutation("A", 2);
  assert.equal(received.length, 1); finishB(); finishOtherSession(); assert.equal(received.length, 1);
  finishA(); finishA(); assert.deepEqual(received, [true, false]); stop();
  const finishBox = api.beginFamilyMutation("A", 1, "box");
  assert.equal(api.familyMutationPending("A", 1), false); assert.equal(api.familyMutationPending("A", 1, "box"), true); finishBox();
}
{
  const file = "screens/Family.tsx", tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) { if (ts.isJsxExpression(node) && node.expression?.getText(tree).includes("fmtFamilia(saldo)")) expression = node.expression.getText(tree); ts.forEachChild(node, visit); }
  visit(tree); assert.ok(expression);
  const display = copiaConocida => vm.runInNewContext(ts.transpile(`globalThis.value = (${expression});`, { target: ts.ScriptTarget.ES2022 }),
    { copiaConocida, familia: { id: "space" }, saldo: 0, fmtFamilia: value => `S/ ${value}` });
  assert.equal(display(undefined), "…", "sin copia confirmada no se inventa un saldo cero");
  assert.equal(display({ movimientosFamilias: {} }), "…", "una copia invalidada espera confirmación sin mostrar cero provisional");
  assert.equal(display({ movimientosFamilias: { space: [] } }), "S/ 0", "un cero confirmado sí se muestra");
}
console.log("Devolución original: salida durante confirmación, Familia/Caja, duplicado, cuenta A→B→A, moneda/borrados, red, copia anterior y cero provisional protegidos. No opera con datos reales.");

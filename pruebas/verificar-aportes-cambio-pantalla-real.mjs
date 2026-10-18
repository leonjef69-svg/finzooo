import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { familyMutationOriginal } from "./helpers/family-mutation-original.mjs";
import { withImmediateRemoval } from "./helpers/immediate-removal-original.mjs";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";

const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const tick = async () => { for (let index = 0; index < 60; index++) await Promise.resolve(); };
const pureModule = { exports: {} };
const pureCode = buildSync({ stdin: { contents: 'export * from "./utils/finances.ts"; export * from "./utils/linkedTransfers.ts";', resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": process.cwd() } }).outputFiles[0].text;
new Function("require", "module", "exports", pureCode)(createRequire(import.meta.url), pureModule, pureModule.exports);
const pure = pureModule.exports;
const available = rows => pure.disponiblePersonalEnFecha("2026-10-18", {}, rows, []);
function originalAction(file, name, scope) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer; ts.forEachChild(node, visit); }
  visit(tree); assert.ok(found, name);
  vm.runInNewContext(ts.transpile(`globalThis.action = ${found.getText(tree)};`, { target: ts.ScriptTarget.ES2022 }), scope);
  return scope.action;
}
function harness(kind, mode) {
  let confirm, fail;
  const remote = new Promise((resolve, reject) => { confirm = resolve; fail = reject; });
  const state = { uid: "A", session: 1, writes: [], remoteCalls: 0, cleaned: 0, errors: [], localSave: true };
  const contribution = { id: "contribution", tipo: "ingreso", monto: 100, personalOwnerUid: "A", personalTransactionId: 101, fecha: "2026-10-18" };
  const personal = { id: 101, type: "expense", amount: 100, internalTransfer: kind, internalTransferLink: contribution.id, internalTransferSpaceId: "space", date: contribution.fecha };
  state.rows = [{ id: 1, type: "income", amount: 500, date: "2026-10-18", category: "salario" }, ...(mode === "edit" ? [personal] : [])];
  const scope = { ...familyMutationOriginal(), uid: "A", accountUid: "A", accountSession: 1,
    auth: { get currentUser() { return { uid: state.uid }; } }, getAccountStorageSession: () => state.session,
    mounted: { current: true }, actionLock: { current: false }, lock: { current: false }, moneyLock: { current: false },
    reloadId: { current: 0 }, movementEpoch: { current: 0 }, confirmedSource: { current: null }, cierresPendientes: { current: new Set() },
    pendingDebit: { current: null }, familiaElegida: { current: null }, owner: true, isPremium: true,
    userCurrency: "PEN", moneda: "PEN", userName: "Prueba", familia: { id: "space", nombre: "Casa", currency: "PEN" }, caja: { id: "space", nombre: "Caja", currency: "PEN" },
    tipo: "ingreso", modo: "ingreso", origenDinero: "personal", origenInicial: "personal", nombre: "Casa", monto: mode === "edit" ? "150" : "100", montoInicial: "100",
    descripcion: "Aporte", category: "otros", notes: "", method: "transfer", movementDate: "2026-10-18", editandoAporteId: mode === "edit" ? contribution.id : null,
    movimientos: mode === "edit" ? [contribution] : [], transactions: mode === "edit" ? [personal] : [],
    t: key => key, tRef: { current: key => key }, showToast: text => state.errors.push(text), spaceErrorKey: error => error.message, errorRef: { current: error => state.errors.push(error.message) },
    amountInputError: () => null, parseAmountInput: Number, validSpaceDate: () => true, minimumContributionAmount: () => 0,
    saldoPersonalEn: () => 500, canSpendFromSpace: () => true, nextId: () => 101, horaDe: () => "12:00", fechaHoy: () => "2026-10-18", Date,
    recargar: async () => {}, setOcupado() {}, setBusy() {}, setFamiliasSincronizadas() {}, setMovimientosConfirmados() {}, setSubscriptionRevision() {},
    setMonto() {}, setDescripcion() {}, setNombre() {}, setNotes() {}, setMovementDate() {}, setOrigenDinero() {}, setOrigenInicial() {}, setMontoInicial() {},
    setCargando() {}, setFamilia() {}, setMovimientos() {}, setMiembros() {}, setModo() {}, setVerTodas() {}, setEditandoAporteId() {},
    setTipo: () => { state.cleaned++; }, limpiar: () => { state.cleaned++; },
    crearFamilia: () => { state.remoteCalls++; return remote; }, guardarMovimientoFamilia: () => { state.remoteCalls++; return remote; },
    guardarMovimientoCajaCompartida: () => { state.remoteCalls++; return remote; }, actualizarAportePersonal: () => { state.remoteCalls++; return remote; },
    repairLinkedTransferTransactions: async rows => {
      state.writes.push(...rows);
      if (state.localSave) for (const row of rows) state.rows = [row, ...state.rows.filter(item => item.id !== row.id)];
      return state.localSave;
    },
  };
  scope.captureAccountTask = handlerOriginal("utils/accountTask.ts", "captureAccountTask", scope, read("utils/accountTask.ts"));
  const file = kind === "family" ? "screens/Family.tsx" : "screens/SharedBoxes.tsx";
  scope.ejecutar = handlerOriginal(file, "ejecutar", scope, read(file));
  const action = originalAction(file, mode === "create" ? "crear" : "guardar", scope);
  const receipt = mode === "create" ? { id: "space", nombre: "Casa", currency: "PEN", movimientoInicialId: "contribution" } : mode === "edit" ? undefined : "contribution";
  return { state, scope, action, confirm: () => confirm(receipt), fail };
}

for (const [kind, mode] of [["family", "new"], ["box", "new"], ["family", "create"], ["family", "edit"], ["box", "edit"]]) {
  const h = harness(kind, mode), work = h.action(); await tick();
  await h.action();
  assert.equal(h.state.remoteCalls, 1); assert.equal(h.state.writes.length, 0, "no debitar antes de confirmar el destino");
  h.scope.mounted.current = false; h.confirm(); await work;
  assert.equal(h.state.writes.length, 1, `${kind}/${mode}: la salida de pantalla no omite el débito confirmado de Personal`);
  assert.equal(h.state.writes[0].amount, mode === "edit" ? 150 : 100);
  assert.equal(h.state.writes[0].internalTransferLink, "contribution");
  assert.equal(available(h.state.rows), mode === "edit" ? 350 : 400, "el cálculo original de Personal descuenta exactamente el aporte confirmado");
  assert.equal(h.state.cleaned, 0, "no cerrar formularios de una pantalla abandonada");
  assert.equal(h.scope.familyMutationPending("A", 1, kind), false);
  for (const reason of ["account", "session", "network"]) {
    const h = harness(kind, mode), work = h.action(); await tick();
    if (reason === "account") { h.state.uid = "B"; h.state.session = 2; }
    if (reason === "session") h.state.session = 3;
    if (reason === "network") h.fail(Error("network")); else h.confirm();
    await work;
    assert.equal(h.state.writes.length, 0, `${kind}/${mode}/${reason}: sin débito en otra cuenta/sesión o tras fallo remoto`);
    assert.equal(h.scope.familyMutationPending("A", 1, kind), false);
  }
}
for (const [kind, mode] of [["family", "new"], ["box", "new"], ["family", "create"]]) {
  const h = harness(kind, mode); h.state.localSave = false;
  const work = h.action(); await tick(); h.confirm(); await work;
  assert.equal(available(h.state.rows), 500, "un guardado local fallido no se presenta como confirmado");
  assert.ok(h.scope.pendingDebit.current, "conserva el mismo débito para reintentar sin otro aporte remoto");
  h.state.localSave = true; await h.action();
  assert.equal(h.state.remoteCalls, 1); assert.equal(available(h.state.rows), 400);
  assert.equal(h.scope.pendingDebit.current, null);
}
// Ciclo controlado con los botones, cálculos, registro de devolución y planes
// originales. El almacenamiento/servidor son adaptadores, no dinero real.
for (const kind of ["family", "box"]) {
  const h = harness(kind, "new"), work = h.action(); await tick(); h.confirm(); await work;
  assert.equal(available(h.state.rows), 400);
  const scope = h.scope, file = kind === "family" ? "screens/Family.tsx" : "screens/SharedBoxes.tsx";
  const receipt = { uid: "A", localSession: 1, kind, spaceId: "space", personalTransactionId: 102, movementId: "return_102", currency: "PEN",
    amount: 100, fecha: "2026-10-18", createdAt: 1, spaceName: "Casa", allocations: [{ transactionId: 101, amount: 100 }] };
  Object.assign(scope, { ...pure, devolvibleAPersonal: 100, devolverAportePersonal: async () => receipt,
    assertPrivateBoxMoneyLocalIdle() {}, currencyForReturn: { current: "PEN" }, returnReceipt: { current: null },
    deletedTransactionIdsRef: { current: [] }, pendingTransactionDeletes: { current: new Set() },
    setTransactions: update => { h.state.rows = update(h.state.rows); },
    withImmediateRemoval, setMovimientosOcultos() {}, borradosConfirmados: { current: new Map() },
    setSeleccionados() {}, setSeleccionando() {},
    retirarMovimientoConfirmado() {},
    borrarAportePersonal: async (_kind, _space, id) => { scope.movimientos = scope.movimientos.filter(item => item.id !== id); },
    deleteLinkedTransferTransaction: async id => {
      h.state.rows = h.state.rows.filter(item => item.id !== id);
      scope.deletedTransactionIdsRef.current.push(id); return true;
    },
  });
  scope.personalReturnIsCurrent = handlerOriginal("utils/personalReturn.ts", "personalReturnIsCurrent", scope);
  scope.mergePersonalReturn = handlerOriginal("utils/personalReturn.ts", "mergePersonalReturn", {});
  scope.recordPersonalReturn = handlerOriginal("contexts/AppDataContext.tsx", "recordPersonalReturn", scope);
  const returnMoney = originalAction(file, "devolverAPersonal", scope);
  await returnMoney(); await returnMoney();
  assert.equal(available(h.state.rows), 500, "la devolución confirmada repetida recupera S/100, nunca S/200");
  assert.equal(pure.totalsForMonth(h.state.rows, "2026-10").income, 500, "el retorno no es otro ingreso ordinario");
  scope.movimientos = [
    { id: "contribution", tipo: "ingreso", monto: 100, creadoPor: "A", personalOwnerUid: "A", personalTransactionId: 101, fecha: "2026-10-18" },
    { id: "return_102", tipo: "gasto", monto: 100, creadoPor: "A", personalOwnerUid: "A", personalTransactionId: 102, personalReturnAmount: 100, fecha: "2026-10-18" },
  ];
  assert.equal(pure.balanceOfSpace(scope.movimientos), 0);
  const remove = originalAction(file, kind === "family" ? "borrarSeleccionados" : "borrarGrupo", scope);
  await remove(["contribution", "return_102"]);
  assert.equal(available(h.state.rows), 500, "anular el par completo conserva el dinero inicial");
  assert.equal(scope.movimientos.length, 0);
  assert.equal(h.state.rows.length, 1);
  assert.equal(scope.recordPersonalReturn(receipt), false, "una confirmación atrasada no resucita la devolución anulada");
}
for (const kind of ["family", "box"]) {
  const h = harness(kind, "new"), backend = new Map(), calls = [];
  let generated = 0, personalId = 100, responseLost = true;
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(read("utils/sharedMovements.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
    module, exports: module.exports, require: name => {
      if (name === "@/utils/firebase") return { auth: h.scope.auth, db: {}, functions: {} };
      if (name === "@/utils/accountTask") return { captureAccountTask: h.scope.captureAccountTask };
      if (name === "@/utils/storage") return { getAccountStorageSession: h.scope.getAccountStorageSession };
      if (name === "firebase/firestore") return { collection: () => ({}), doc: () => ({ id: `operation-${++generated}` }) };
      if (name === "firebase/functions") return { httpsCallable: () => async input => {
        calls.push(input.movementId); backend.set(input.movementId, input.movement);
        if (responseLost) throw Error("lost-response");
        return { data: { movementId: input.movementId, createdAt: 1 } };
      } };
      throw Error(name);
    },
  });
  const save = (_space, uid, movement) => module.exports.guardarMovimientoCompartido(kind, "space", uid, movement);
  h.scope.guardarMovimientoFamilia = save; h.scope.guardarMovimientoCajaCompartida = save;
  h.scope.nextId = () => ++personalId;
  await h.action(); assert.equal(h.state.writes.length, 0, "sin confirmación no se supone guardado local");
  responseLost = false; await h.action();
  assert.equal(backend.size, 1, `${kind}: respuesta perdida y reintento no crean dos aportes con diferentes IDs de Personal`);
  assert.equal(calls[0], calls[1]); assert.equal(available(h.state.rows), 400);
}
for (const kind of ["family", "box"]) {
  const h = harness(kind, "new"); let definitive = false;
  const save = async () => { throw definitive ? Object.assign(Error("balance-changed"), { details: { reason: "shared-insufficient-balance" } }) : Error("network"); };
  h.scope.guardarMovimientoFamilia = save; h.scope.guardarMovimientoCajaCompartida = save;
  await h.action(); assert.ok(h.scope.pendingDebit.current);
  definitive = true; await h.action();
  assert.equal(h.scope.pendingDebit.current, null, "un rechazo definitivo también libera el formulario cuando llega durante el reintento");
  assert.equal(available(h.state.rows), 500);
}
{
  const h = harness("family", "new");
  h.scope.guardarMovimientoFamilia = async () => { throw Error("network"); };
  await h.action(); const pending = h.scope.pendingDebit.current;
  const open = handlerOriginal("screens/Family.tsx", "abrirFamilia", h.scope);
  open({ id: "another", nombre: "Otra" });
  assert.equal(h.scope.familia.id, "space", "el aporte pendiente no se traslada silenciosamente a otra familia");
  const create = originalAction("screens/Family.tsx", "crear", h.scope);
  await create(); assert.equal(h.state.remoteCalls, 0, "Crear no confirma un aporte ajeno como si creara otra familia");
  h.scope.familia = { id: "another", nombre: "Otra", currency: "PEN" }; await h.action();
  assert.equal(h.scope.pendingDebit.current, pending); assert.equal(h.state.writes.length, 0);
}
console.log("Aportes/ciclo originales: alta/creación/edición al salir, cuenta/sesión/red, S/500→400→500, reintento sin duplicados y familia pendiente aislada. React/IO adaptados; no acredita Android, reinicio ni segundo dispositivo.");

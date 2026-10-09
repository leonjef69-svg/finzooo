import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Ejecuta los efectos/setters originales. Solo adapta hooks, Auth y red;
// Object.is modela la comparación real de dependencias y de useState.
const read = createSourceReader();
const ast = ts.createSourceFile("provider.tsx", read("contexts/AppDataContext.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let reception, resume;
const setters = [];
function collect(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect"
    && node.arguments[0]?.getText(ast).includes("const sincronizarMovimientos = async")) reception = node.getText(ast);
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "AppState.addEventListener"
    && node.arguments[1]?.getText(ast).includes("void loadCloudData(uid)")) resume = node.arguments[1].getText(ast);
  if (ts.isVariableDeclaration(node) && ["setTransactions", "setGoals", "setDeletedTransactionIds"].includes(node.name.getText(ast))) {
    setters.push(`const ${node.getText(ast)};`);
  }
  ts.forEachChild(node, collect);
}
collect(ast);
assert.ok(reception && resume && setters.length === 3, "localiza ambos caminos y setters propios, sin copiar su lógica");
function ownModule(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(read(file), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
    module, exports: module.exports, require: name => {
      assert.ok(name in dependencies, `dependencia no adaptada ${name}`); return dependencies[name];
    },
  });
  return module.exports;
}
const ordering = ownModule("utils/ordenarMovimientos.ts");
const merge = ownModule("utils/mergeTransactions.ts", { "@/utils/ordenarMovimientos": ordering });
const compiledEffect = ts.transpile(reception, { target: ts.ScriptTarget.ES2022 });
const compiledResume = ts.transpile(`resume = ${resume};`, { target: ts.ScriptTarget.ES2022 });
const record = (id, amount = 10) => ({ id, type: "expense", amount, category: "otros", date: "2026-10-09", description: `m${id}`, method: "cash" });
const goal = id => ({ id, name: `g${id}`, target: 100, saved: 10 });
const copy = data => JSON.parse(JSON.stringify(data));
const emptyCloud = { transactions: [], goals: [], deletedTransactionIds: [], deletedGoalIds: [] };

function fixture(initial = {}, { paused = false, accepted = true } = {}) {
  const state = { transactions: initial.transactions ?? [], goals: initial.goals ?? [],
    deletedTransactionIds: initial.deletedTransactionIds ?? [], deletedGoalIds: initial.deletedGoalIds ?? [] };
  const initialRefs = { ...state }, errors = [];
  const jobs = []; let requests = 0, renders = 0, changes = 0, cleanup, dependencies, dirty = false;
  let response = { ...emptyCloud, ...initial };
  const scope = { ...merge, ready: true, hasOnboarded: true, uid: "A", isPremium: true,
    alive: true, version: 0, localSessionVersion: { current: 0 }, auth: { currentUser: { uid: "A" } },
    transactionsLive: { current: state.transactions }, goalsLive: { current: state.goals },
    deletedTransactionIdsRef: { current: state.deletedTransactionIds }, useCallback: fn => fn,
    assertPrivateBoxMoneyLocalIdle() {}, assertPrivateBoxMoneyLocalMutation() {},
    applyNewerCloudFields: () => accepted, setDatosNegocio() {}, setRespaldoFallo: value => errors.push(value),
    setAutoCapturePermission() {}, notificationReader: { isPermissionGranted: () => false },
    reengancharLector() {}, collect() {},
    loadCloudData: async () => {
      requests++;
      return paused ? new Promise(resolve => jobs.push(resolve)) : copy(response);
    },
    useEffect: (callback, nextDependencies) => {
      if (!dependencies || nextDependencies.some((value, i) => !Object.is(value, dependencies[i]))) {
        cleanup?.(); dependencies = nextDependencies; cleanup = callback();
      }
    },
  };
  function dispatch(key, update) {
    const old = state[key], next = typeof update === "function" ? update(old) : update;
    if (!Object.is(old, next)) { state[key] = next; dirty = true; changes++; }
  }
  scope.setRenderedTransactions = update => dispatch("transactions", update);
  scope.setRenderedGoals = update => dispatch("goals", update);
  scope.setRenderedDeletedTransactionIds = update => dispatch("deletedTransactionIds", update);
  scope.setDeletedGoalIds = update => dispatch("deletedGoalIds", update);
  vm.createContext(scope);
  vm.runInContext(ts.transpile(`${setters.join("\n")}\nObject.assign(globalThis, { setTransactions, setGoals, setDeletedTransactionIds });`,
    { target: ts.ScriptTarget.ES2022 }), scope);
  function render() {
    dirty = false; renders++;
    Object.assign(scope, state);
    vm.runInContext(compiledEffect, scope);
    vm.runInContext(compiledResume, scope);
  }
  async function settle(max = 20) {
    for (let i = 0; i < max; i++) {
      await Promise.resolve(); await Promise.resolve();
      if (dirty) render();
    }
  }
  return { scope, state, initialRefs, jobs, errors, render, settle,
    response: value => { response = { ...emptyCloud, ...value }; },
    dispatch, counts: () => ({ requests, renders, changes }), stop: () => cleanup?.() };
}

for (const initial of [emptyCloud, { ...emptyCloud, transactions: [record(1)], goals: [goal(2)] }]) {
  const f = fixture(initial); f.render(); await f.settle();
  assert.equal(f.counts().requests, 1,
    `una cuenta sin novedades deja de consultar; original recibió ${f.counts().requests} solicitudes en 20 ciclos`);
  for (const key of Object.keys(f.state)) assert.equal(f.state[key], f.initialRefs[key], `${key} conserva referencia si no cambió`);
  assert.equal(f.counts().changes, 0, "recibir exactamente lo mismo no desencadena otra subida/cifrado");
  f.stop();
}

{
  const transactions = Array.from({ length: 10_000 }, (_, i) => record(10_000 - i));
  const f = fixture({ ...emptyCloud, transactions }); f.render(); await f.settle();
  assert.equal(f.counts().requests, 1, "10.000 movimientos iguales no repiten descarga");
  assert.equal(f.state.transactions, transactions, "el historial grande no crea una lista nueva sin cambios");
  assert.equal(f.counts().changes, 0); f.stop();
}

{
  const f = fixture({ transactions: [{ ...record(1), updatedAt: 10 }] });
  f.response({ transactions: [{ ...record(1, 25), updatedAt: 20 }] }); f.render(); await f.settle();
  assert.equal(f.state.transactions[0].amount, 25, "una edición remota auténtica sí cambia el registro");
  assert.equal(f.state.transactions[0].updatedAt, 20); assert.equal(f.counts().requests, 1); f.stop();
}

{
  const f = fixture({ transactions: [record(1)], goals: [goal(2)] });
  f.response({ transactions: [record(1), record(3, 15)], goals: [goal(2), goal(4)], deletedTransactionIds: [1], deletedGoalIds: [2] });
  f.render(); await f.settle();
  assert.equal(f.counts().requests, 2, "un cambio real de borrados admite su consulta siguiente y luego se estabiliza");
  assert.deepEqual(Array.from(f.state.transactions, item => item.id), [3]);
  assert.deepEqual(Array.from(f.state.goals, item => item.id), [4]);
  assert.deepEqual(Array.from(f.state.deletedTransactionIds), [1]);
  assert.deepEqual(Array.from(f.state.deletedGoalIds), [2]);
  f.stop();
}

{
  const f = fixture({ transactions: [record(1)], goals: [goal(2)] }, { paused: true });
  f.render(); f.scope.setTransactions([record(5), record(1)]); f.scope.setGoals([goal(6), goal(2)]);
  f.jobs.shift()({ ...emptyCloud, transactions: [record(3)], goals: [goal(4)] }); await f.settle();
  assert.deepEqual(Array.from(f.state.transactions, item => item.id), [5, 3, 1], "conserva el movimiento local llegado mientras esperaba");
  assert.deepEqual(Array.from(f.state.goals, item => item.id), [6, 4, 2], "conserva la meta local llegada mientras esperaba");
  assert.equal(f.counts().requests, 1); f.stop();
}

{
  const f = fixture({ transactions: [record(1)], goals: [goal(2)] }, { paused: true });
  f.render(); f.dispatch("deletedGoalIds", [2]); f.scope.setGoals([]); f.render();
  f.jobs.shift()({ ...emptyCloud, transactions: [record(99)], goals: [goal(2), goal(99)] }); await f.settle();
  assert.equal(f.state.transactions.length, 1, "limpiar el efecto invalida la respuesta anterior");
  assert.equal(f.state.goals.length, 0);
  f.jobs.shift()({ ...emptyCloud, goals: [goal(2)] }); await f.settle();
  assert.equal(f.state.goals.length, 0, "el borrado local no se resucita con una copia antigua");
  assert.deepEqual(Array.from(f.state.deletedGoalIds), [2]); f.stop();
}

for (const invalidate of [f => { f.scope.auth.currentUser = { uid: "B" }; }, f => { f.scope.localSessionVersion.current++; }, f => f.stop()]) {
  const f = fixture({}, { paused: true }); f.render(); invalidate(f);
  f.jobs.shift()({ ...emptyCloud, transactions: [record(9)], goals: [goal(9)] }); await f.settle();
  assert.equal(f.state.transactions.length, 0); assert.equal(f.state.goals.length, 0);
  assert.equal(f.counts().changes, 0, "una sesión/salida anterior no acepta respuesta tardía"); f.stop();
}

{
  const f = fixture({ transactions: [record(1)] }, { accepted: false }); f.render(); await f.settle();
  assert.equal(f.counts().changes, 0, "una respuesta rechazada por la revisión de importe no altera referencias"); f.stop();
}

{
  const f = fixture({ transactions: [record(1)], goals: [goal(2)] }); f.render(); await f.settle();
  const before = f.counts(); f.scope.resume("background"); await f.settle();
  assert.equal(f.counts().requests, before.requests);
  f.scope.resume("active"); await f.settle();
  assert.equal(f.counts().requests, before.requests + 1, "volver al frente consulta una vez sin un bucle posterior");
  assert.equal(f.counts().changes, 0);
  f.response({ transactions: [record(1), record(3)], goals: [goal(2), goal(4)] });
  f.scope.resume("active"); await f.settle();
  assert.deepEqual(Array.from(f.state.transactions, item => item.id), [3, 1]);
  assert.deepEqual(Array.from(f.state.goals, item => item.id), [4, 2]); f.stop();
}

for (const input of [{ isPremium: false }, { ready: false }, { hasOnboarded: false }, { uid: "" }]) {
  const f = fixture(); Object.assign(f.scope, input); f.render(); await f.settle();
  assert.equal(f.counts().requests, 0, "no consulta cuando el efecto no tiene permiso/contexto preparado"); f.stop();
}
for (const [code, reason] of [["cloud/history-format-unsupported", "actualizacion-necesaria"], ["cloud/record-identity-invalid", "datos-nube-invalidos"]]) {
  const f = fixture({ transactions: [record(1)], goals: [goal(2)] });
  const failure = Object.assign(new Error("formato desconocido"), { code });
  f.scope.loadCloudData = async () => { throw failure; };
  f.render(); await f.settle();
  assert.deepEqual(f.errors, [reason], "abrir no oculta ni confunde formato nuevo/datos inválidos");
  f.errors.length = 0;
  f.scope.resume("active"); await f.settle();
  assert.deepEqual(f.errors, [reason], "volver tampoco anuncia un reintento suficiente");
  for (const key of Object.keys(f.state)) assert.equal(f.state[key], f.initialRefs[key], "sin formato conocido no se modifica una lista");
  f.stop();
}
for (const invalidation of ["uid", "version", "unmount"]) {
  const f = fixture({ transactions: [record(1)] });
  let rejectRead;
  f.scope.loadCloudData = () => new Promise((_resolve, reject) => { rejectRead = reject; });
  f.render();
  if (invalidation === "uid") f.scope.auth.currentUser = { uid: "B" };
  if (invalidation === "version") f.scope.localSessionVersion.current++;
  if (invalidation === "unmount") f.stop();
  rejectRead(Object.assign(new Error("formato desconocido"), { code: "cloud/history-format-unsupported" }));
  await f.settle();
  assert.deepEqual(f.errors, [], "un fallo atrasado no pone un aviso en otra sesión/pantalla");
  assert.equal(f.state.transactions, f.initialRefs.transactions); f.stop();
}
console.log("Consultas estables: efectos/setters/fusiones originales con hooks, Auth/red adaptados; bucle, novedades/borrados/sesión/resume y avisos de formato, sin aceptar fallos atrasados. No mide facturación ni prueba Android/SDK real.");

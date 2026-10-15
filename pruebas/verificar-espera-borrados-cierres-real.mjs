import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere hash de Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = (source, file = "original.tsx") => ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, file);
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
function tree(file) { return ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function select(file, predicate) {
  const source = tree(file); let result;
  function visit(node) { if (!result && predicate(node, source)) result = node; if (!result) ts.forEachChild(node, visit); }
  visit(source); assert.ok(result, file); return { result, source };
}
function declaration(file, name) {
  const { result, source } = select(file, (node, source) => ts.isFunctionDeclaration(node) && node.name?.text === name
    || ts.isVariableDeclaration(node) && node.name.getText(source) === name);
  return ts.isVariableDeclaration(result) ? `const ${result.getText(source)};` : result.getText(source);
}
function effect(file, fragment) {
  const { result, source } = select(file, (node, source) => ts.isCallExpression(node) && node.expression.getText(source) === "useEffect"
    && node.arguments[0]?.getText(source).includes(fragment));
  return result.arguments[0].getText(source);
}
function moduleOriginal(file, dependencies = {}) {
  const module = { exports: {} }; vm.runInNewContext(js(read(file), file), { module, exports: module.exports, Error, require: name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  } }); return module.exports;
}
const transfers = moduleOriginal("utils/linkedTransfers.ts");
function closeHarness(kind, outcome) {
  const file = kind === "family" ? "screens/Family.tsx" : "screens/SharedBoxes.tsx";
  const transfer = { id: 10, type: "expense", amount: 100, internalTransfer: kind, internalTransferSpaceId: "space-a", internalTransferLink: "in" };
  const h = { uid: "a", session: 1, calls: 0, reloads: 0, subscriptions: 0, toasts: [], batches: [], gate: null, backendClosed: false, outcome, rpcError: null };
  const auth = { get currentUser() { return { uid: h.uid }; } };
  const storage = { getAccountStorageSession: () => h.session };
  const account = moduleOriginal("utils/accountTask.ts", { "@/utils/firebase": { auth }, "@/utils/storage": storage });
  const scope = { ...account, ...transfers, auth, uid: "a", accountUid: "a", accountSession: 1, getAccountStorageSession: storage.getAccountStorageSession,
    useCallback: callback => callback,
    mounted: { current: true }, actionLock: { current: false }, lock: { current: false }, reloadId: { current: 0 },
    familiaElegida: { current: "space-a" }, familiaEnMemoria: new Map(),
    movementEpoch: { current: 0 }, confirmedSource: { current: null }, selectedBoxId: { current: "space-a" },
    cierresPendientes: { current: new Set() }, cierresConfirmados: { current: new Set() },
    familia: { id: "space-a", nombre: "F", ownerUid: "a" }, familiaId: "space-a", caja: { id: "space-a", nombre: "C", ownerUid: "a" }, cajaId: "space-a",
    familias: [{ id: "space-a", ownerUid: "a" }], familiasSeleccionadas: ["space-a"], movimientosFamilias: { "space-a": [] },
    owner: true, ocupado: false, transactions: [transfer], movimientos: [],
    t: key => key, tRef: { current: key => key }, showToast: value => h.toasts.push(value), toastRef: { current: value => h.toasts.push(value) },
    spaceErrorKey: () => "family.connectionError", errorRef: { current: error => h.toasts.push(error?.message || "error") },
    setOcupado() {}, setBusy() {}, setFamiliasSincronizadas() {}, setMovimientosConfirmados() {}, setSubscriptionRevision: () => { h.subscriptions++; },
    setFamilia: value => { scope.familia = value; }, setCaja: value => { scope.caja = value; },
    setFamilias: update => { scope.familias = typeof update === "function" ? update(scope.familias) : update; },
    setCajas() {}, setMiembros() {}, setMovimientos() {}, setTipo() {}, setInvitacion() {}, setFilter() {}, setVerTodas() {},
    setFamiliasSeleccionadas() {}, setSeleccionandoFamilias() {},
    recargar: async () => { h.reloads++; },
    repairLinkedTransferTransactions: async rows => {
      h.batches.push(rows); if (h.gate) await h.gate.promise;
      if (h.outcome === "throw") throw new Error("native-write-failed");
      return h.results ? h.results.shift() : h.outcome !== "false";
    },
    cerrarFamilia: async () => { h.calls++; if (h.rpcError) throw h.rpcError; assert.equal(h.backendClosed, false, "no vuelve a enviar el cierre ya confirmado"); h.backendClosed = true; h.closed?.(); },
    cerrarCajaCompartida: async () => { h.calls++; if (h.rpcError) throw h.rpcError; assert.equal(h.backendClosed, false, "no vuelve a enviar el cierre ya confirmado"); h.backendClosed = true; h.closed?.(); },
    observarCierreFamilia: (_id, callback) => { h.closed = callback; return () => {}; },
    observarCierreCaja: (_id, callback) => { h.closed = callback; return () => {}; },
    Alert: { alert: (_title, _message, buttons) => { h.confirm = buttons.find(button => button.onPress).onPress; } }, Error };
  vm.runInNewContext(js(declaration(file, "ejecutar") + "\n" + declaration(file, kind === "family" ? "cerrarFamiliaActiva" : "cerrar")
    + (kind === "family" ? "\n" + declaration(file, "retirarFamiliasConfirmadas") + "\n" + declaration(file, "confirmarBorrarFamilias") + "\nglobalThis.closeSelected = confirmarBorrarFamilias;" : "")
    + `\nglobalThis.closeAction = ${kind === "family" ? "cerrarFamiliaActiva" : "cerrar"}; globalThis.watch = (${effect(file, kind === "family" ? "observarCierreFamilia(" : "observarCierreCaja(")}); globalThis.lifecycle = (${effect(file, "mounted.current = true;")});`), scope);
  const run = scope.ejecutar; scope.ejecutar = (...args) => { h.running = run(...args); return h.running; };
  h.scope = scope; h.stop = scope.watch(); h.unmount = scope.lifecycle();
  h.close = async () => { scope.closeAction(); h.confirm(); await h.running; };
  return h;
}
for (const kind of ["family", "box"]) for (const outcome of ["false", "throw"]) {
  const h = closeHarness(kind, outcome); await h.close();
  assert.ok(kind === "family" ? h.scope.familia : h.scope.caja, "un cierre local fallido no oculta la ficha antes de completar Personal");
  assert.equal(h.toasts.includes("family.closed"), false); assert.equal(h.reloads, 0);
  assert.equal(h.scope.transactions[0].amount, 100, "no devuelve el dinero consumido ni cambia montos");
  await h.close(); assert.equal(h.calls, 1, "reintentar el lote local no repite el cierre financiero remoto conocido");
  h.outcome = "ok"; await h.close();
  assert.equal(h.calls, 1); assert.equal(kind === "family" ? h.scope.familia : h.scope.caja, null, "el reintento local confirmado completa la salida");
}
for (const kind of ["family", "box"]) {
  const h = closeHarness(kind, "ok"); h.gate = deferred();
  const pending = h.close(); await tick();
  assert.ok(kind === "family" ? h.scope.familia : h.scope.caja, "la escucha remota no oculta la ficha mientras espera el ACK local");
  assert.equal(h.toasts.includes("family.closed"), false); h.gate.resolve(); await pending;
  assert.equal(kind === "family" ? h.scope.familia : h.scope.caja, null);
  assert.equal(h.batches[0][0].internalTransferSettled, true);
  assert.equal(h.batches[0][0].amount, 100);
}
for (const kind of ["family", "box"]) {
  const h = closeHarness(kind, "ok"); h.gate = deferred();
  const pending = h.close(); await tick(); h.uid = "b"; h.session++; h.unmount();
  h.gate.resolve(); await pending;
  assert.equal(h.toasts.includes("family.closed"), false, "una respuesta de otra sesión no confirma cierre en pantalla");
  assert.ok(kind === "family" ? h.scope.familia : h.scope.caja);
  assert.equal(h.scope.cierresConfirmados.current.size, 0); assert.equal(h.scope.cierresPendientes.current.size, 0,
    "desmontar retira confirmaciones de la cuenta anterior");
}
for (const kind of ["family", "box"]) for (const failure of ["precondition", "offline"]) {
  const h = closeHarness(kind, "ok");
  h.rpcError = Object.assign(new Error(failure), failure === "precondition" ? { code: "functions/failed-precondition" } : {});
  await h.close();
  assert.equal(h.scope.cierresPendientes.current.size, 0, "un cierre remoto rechazado no deja bloqueada la actualización");
  assert.equal(h.scope.cierresConfirmados.current.size, 0); assert.equal(h.batches.length, 0);
  assert.equal(kind === "family" ? h.reloads : h.subscriptions, 1, "se permite la lectura vigente después del error remoto");
  assert.ok(kind === "family" ? h.scope.familia : h.scope.caja);
  h.closed(); assert.equal(kind === "family" ? h.scope.familia : h.scope.caja, null, "no se ignora después un cierre externo real");
}
{
  const h = closeHarness("family", "ok"), closed = new Set(); h.results = [true, false];
  h.scope.familias.push({ id: "space-b", ownerUid: "a" }); h.scope.familiasSeleccionadas.push("space-b");
  h.scope.cerrarFamilia = async (_uid, id) => { assert.equal(closed.has(id), false, "el lote no repite un cierre confirmado"); closed.add(id); h.calls++; };
  const run = async () => { h.scope.closeSelected(); h.confirm(); await h.running; };
  await run(); assert.equal(h.calls, 2); assert.equal(h.scope.cierresPendientes.current.has("space-b"), true); assert.equal(h.reloads, 0);
  h.results = [true, true]; await run();
  assert.equal(h.calls, 2); assert.equal(h.scope.cierresPendientes.current.size, 0);
}
{
  const h = closeHarness("family", "ok"), closed = new Set(); h.results = [true];
  h.scope.familias.push({ id: "space-b", ownerUid: "a" }); h.scope.familiasSeleccionadas.push("space-b");
  h.scope.cerrarFamilia = async (_uid, id) => { if (id === "space-b") throw new Error("offline"); closed.add(id); h.calls++; };
  h.scope.closeSelected(); h.confirm(); await h.running;
  assert.equal(h.scope.cierresConfirmados.current.has("space-a"), true, "el error del segundo cierre conserva la confirmación genuina del primero");
  assert.equal(h.scope.cierresConfirmados.current.has("space-b"), false);
  assert.equal(h.scope.cierresPendientes.current.size, 0); assert.equal(h.reloads, 1);
}

function routeHarness(file, outcome) {
  const h = { uid: "a", session: 1, calls: 0, navigations: [], toasts: [], cleanups: [], gate: deferred() };
  const auth = { get currentUser() { return { uid: h.uid }; } };
  const storage = { getAccountStorageSession: () => h.session };
  const account = moduleOriginal("utils/accountTask.ts", { "@/utils/firebase": { auth }, "@/utils/storage": storage });
  const remove = async () => { h.calls++; await h.gate.promise; if (outcome === "throw") throw new Error("native-write-failed"); return outcome === "ok"; };
  const app = { goals: [{ id: 20 }], transactions: [{ id: 20 }], isPremium: true, deleteGoal: remove, deleteTransaction: remove,
    t: key => key, showToast: value => h.toasts.push(value) };
  const dependencies = { "expo-router": { router: { replace: path => h.navigations.push(path) }, useLocalSearchParams: () => ({ id: "20" }) },
    "@/screens/Detail": { default: () => null }, "@/screens/SavingsDetail": { default: () => null },
    "@/contexts/AppDataContext": { useAppData: () => app }, "@/utils/firebase": { auth }, "@/utils/accountTask": account,
    "@/utils/nav": { safeBack: () => h.navigations.push("back"), irUnaVez: path => h.navigations.push(path), useRedirectIfOrphaned: () => false },
    react: { useRef: value => ({ current: value }), useEffect: work => { const stop = work(); if (stop) h.cleanups.push(stop); } },
    "react/jsx-runtime": { jsx: (_type, props) => props } };
  h.props = moduleOriginal(file, dependencies).default(); return h;
}
for (const file of ["app/savings/[id].tsx", "app/transaction/[id].tsx"]) for (const outcome of ["false", "throw", "ok", "session"]) {
  const h = routeHarness(file, outcome === "session" ? "ok" : outcome), pending = h.props.onDelete(20);
  assert.equal(h.navigations.length, 0, "no vuelve antes de recibir la confirmación del borrado");
  h.props.onDelete(20); assert.equal(h.calls, 1, "dos toques no inician dos borrados");
  if (outcome === "session") { h.uid = "b"; h.session++; h.cleanups.forEach(stop => stop()); }
  h.gate.resolve(); await pending;
  assert.equal(h.navigations.length, outcome === "ok" ? 1 : 0);
}
console.log("Callbacks originales: borrado y cierre esperan ACK, false/error conserva ficha, reintento no repite cierre remoto, consumo intacto y sesión/doble toque protegidos. IO adaptado, no Android real.");

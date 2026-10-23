import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { familyMutationOriginal } from "./helpers/family-mutation-original.mjs";

const read = createSourceReader();
const transpile = value => ts.transpile(value, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
function original(file, require = () => ({})) {
  const m = { exports: {} };
  vm.runInNewContext(transpile(read(file)), { exports: m.exports, module: m, require });
  return m.exports;
}
// En la base anterior no existe el coordinador. El manejador antiguo no lo
// llama: se comprueba la duplicación original, no que falte una API/import.
let reader;
try { reader = original("utils/spaceRead.ts"); } catch (error) {
  if (!read.revision) throw error;
  reader = { shareSpaceRead: (_scope, work) => work() };
}
const gate = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
let uid = "A", session = 1;
const auth = { get currentUser() { return uid ? { uid } : null; } };
const getAccountStorageSession = () => session;
const { captureAccountTask } = original("utils/accountTask.ts", name => name.endsWith("firebase") ? { auth } : { getAccountStorageSession });
const mutations = familyMutationOriginal();
const file = "screens/Family.tsx", tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const find = predicate => { let found; function visit(node) { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); } visit(tree); assert.ok(found); return found; };
const reload = find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === "recargar").initializer.arguments[0].getText(tree);
function screen(network, cache = new Map(), detail = false) {
  const state = {}, scope = { ...reader, ...mutations, auth, accountUid: uid, accountSession: session, getAccountStorageSession, captureAccountTask,
    mounted: { current: true }, reloadId: { current: 0 }, confirmedReload: { current: 0 }, familiaConfirmada: { current: null }, familiaElegida: { current: null },
    listaFamiliasVisible: { current: !detail }, cierresPendientes: { current: new Set() },
    tRef: { current: key => key }, toastRef: { current() {} }, familiaEnMemoria: cache, VENTANA_CAMBIO_RAPIDO_MS: 2_000,
    listarFamilias: network.list, listarMovimientosFamilia: network.movements, listarMiembrosFamilia: network.members };
  for (const name of ["Cargando", "Actualizando", "ErrorCarga", "VerTodas", "FamiliasSincronizadas", "Familias", "SaldosFamilias", "MovimientosFamilias", "Familia", "Miembros", "Movimientos"]) scope[`set${name}`] = value => { state[name] = value; };
  vm.runInNewContext(transpile(`globalThis.reload = (${reload});`), scope);
  return { scope, state };
}

// Salir y volver ANTES de terminar la descarga no vuelve a iniciarla. La
// respuesta sigue validándose en cada pantalla/cuenta, nunca en la anterior.
{
  const response = gate(); let reads = 0;
  const network = { list: () => { reads++; return response.promise; }, movements: async () => [], members: async () => [] };
  const a = screen(network), first = a.scope.reload(); await tick(); a.scope.mounted.current = false;
  const b = screen(network), second = b.scope.reload(); await tick();
  assert.equal(reads, 1, "dos entradas que esperan lo mismo comparten una sola consulta real");
  response.resolve([]); await Promise.all([first, second]); await tick();
  assert.equal(a.state.Familias, undefined, "la pantalla abandonada no recibe el resultado");
  assert.equal(b.state.FamiliasSincronizadas, true); assert.equal(b.state.Actualizando, false);
}

// La lista necesita saldos, no la nómina de miembros de la familia activa.
// Consultar las demás familias no tiene que esperar la más lenta.
{
  const active = gate(), other = gate(); let members = 0; const started = [];
  const network = { list: async () => [{ id: "f" }, { id: "g" }],
    movements: id => { started.push(id); return id === "f" ? active.promise : other.promise; },
    members: async () => { members++; return [{ uid: "A" }]; } };
  const h = screen(network), load = h.scope.reload(); await tick();
  assert.equal(members, 0, "la lista no descarga miembros que no se muestran");
  assert.deepEqual(started.sort(), ["f", "g"], "ambas familias se consultan en paralelo");
  other.resolve([{ id: "g-1", tipo: "ingreso", monto: 12 }]); await tick();
  assert.notEqual(h.state.FamiliasSincronizadas, true, "una lista parcial no autoriza corregir dinero Personal");
  active.resolve([{ id: "f-1", tipo: "ingreso", monto: 100 }]); await load; await tick();
  assert.equal(h.state.SaldosFamilias.f, 100); assert.equal(h.state.SaldosFamilias.g, 12);
  assert.equal(h.state.FamiliasSincronizadas, true); assert.equal(h.state.Actualizando, false);
  h.scope.listaFamiliasVisible.current = false;
  await h.scope.reload("f", true); await tick(); assert.equal(members, 1, "abrir el detalle sí confirma sus miembros");
}

// La actualización voluntaria es una consulta nueva, no el intento antiguo.
{
  const old = gate(); let reads = 0;
  const network = { list: () => { reads++; return reads === 1 ? old.promise : Promise.resolve([]); }, movements: async () => [], members: async () => [] };
  const a = screen(network), pending = a.scope.reload(); await tick();
  const b = screen(network); await b.scope.reload(undefined, true); await tick();
  assert.equal(reads, 2); assert.equal(b.state.FamiliasSincronizadas, true);
  const c = screen(network); await c.scope.reload(); await tick();
  assert.equal(reads, 3, "tras actualizar, una entrada normal no recupera la petición anterior aún pendiente");
  a.scope.mounted.current = false; old.resolve([]); await pending;
}

// Rechazos se retiran: el siguiente intento puede consultar normalmente.
{
  const failure = gate(); let reads = 0;
  const network = { list: () => { reads++; return reads === 1 ? failure.promise : Promise.resolve([]); }, movements: async () => [], members: async () => [] };
  const a = screen(network), load = a.scope.reload(); await tick(); failure.reject(Error("offline")); await load;
  assert.equal(a.state.ErrorCarga, true); assert.equal(a.state.Actualizando, false);
  const b = screen(network); await b.scope.reload(); await tick(); assert.equal(reads, 2); assert.equal(b.state.FamiliasSincronizadas, true);
}

// No compartir lecturas entre cuentas/sesiones ni a través de una modificación.
for (const changed of ["uid", "session", "money"]) {
  uid = "A"; session++;
  const response = gate(); let reads = 0;
  const network = { list: () => { reads++; return reads === 1 ? response.promise : Promise.resolve([]); }, movements: async () => [], members: async () => [] };
  const a = screen(network), load = a.scope.reload(); await tick();
  if (changed === "uid") uid = "B";
  if (changed === "session") session++;
  if (changed === "money") { const end = a.scope.beginFamilyMutation(uid, session); end(); }
  const b = screen(network); await b.scope.reload(); await tick(); assert.equal(reads, 2, `${changed}: el resultado anterior no se reutiliza`);
  response.resolve([]); await load; assert.equal(a.state.Familias, undefined);
}
// La misma coordinación se ejecuta en el foco ORIGINAL de Cajas, no en una
// reconstrucción del comportamiento del foco.
{
  const boxFile = "screens/Cajas.tsx", boxTree = ts.createSourceFile(boxFile, read(boxFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(boxTree) === "useFocusEffect"
      && node.arguments[0]?.getText(boxTree).includes("listarCajasCompartidas")) effect = node.arguments[0].arguments[0].getText(boxTree);
    ts.forEachChild(node, visit);
  }
  visit(boxTree); assert.ok(effect);
  uid = "A"; session++;
  const response = gate(); let reads = 0;
  function boxScreen(manual = false) {
    const s = { ...reader, ...mutations, accountUid: uid, accountSession: session,
      personalReady: true, hasOnboarded: true, compartidaAbierta: null,
      refreshVersion: manual ? 1 : 0, requestedRefresh: { current: manual ? 1 : 0 }, conversionEnCurso: { current: false },
      cuentaActual: () => s.accountUid === uid && s.accountSession === session,
      captureAccountTask, leerCajasCompartidasEnMemoria: () => null, listaCompartidaCompleta: { current: false },
      listarCajasCompartidas: () => { reads++; return reads === 1 ? response.promise : Promise.resolve([]); },
      setCargandoCompartidas() {}, setErrorCompartidas() {}, setActualizandoListaCompartida() {}, setCompartidasConocidas() {},
      setCompartidas: items => { s.items = items; } };
    s.stop = vm.runInNewContext(transpile(`(${effect})()`), s); return s;
  }
  const a = boxScreen(); await tick(); a.stop();
  const b = boxScreen(); await tick(); assert.equal(reads, 1, "Cajas no duplica la descarga al volver mientras espera");
  const c = boxScreen(true); await tick(); assert.equal(reads, 2, "Actualizar Cajas exige una consulta nueva");
  assert.equal(c.items.length, 0); b.stop(); response.resolve([{ id: "anterior" }]); await tick();
  assert.equal(a.items, undefined); assert.equal(b.items, undefined); assert.equal(c.items.length, 0);
}

// Una consulta colgada no monopoliza la siguiente entrada indefinidamente.
{
  let now = 100, reads = 0;
  const m = { exports: {} };
  vm.runInNewContext(transpile(read("utils/spaceRead.ts")), { module: m, exports: m.exports, Date: { now: () => now } });
  const query = m.exports.shareSpaceRead, scope = { uid: "age", session: 1, revision: 0, key: "list" };
  const old = gate(), fresh = gate(), work = () => { reads++; return reads === 1 ? old.promise : fresh.promise; };
  const a = query(scope, work); await tick(); assert.equal(query(scope, work), a);
  now += 8000; const b = query(scope, work); await tick(); assert.equal(reads, 2);
  old.resolve([]); await a; assert.equal(query(scope, work), b, "el finally antiguo no retira una lectura nueva");
  fresh.resolve([]); await b;
  const forced = gate(), other = gate();
  const before = query(scope, () => other.promise); await tick();
  const after = query(scope, () => forced.promise, true); await tick();
  assert.equal(query(scope, work), after, "el siguiente lector comparte la actualización, no el intento sustituido");
  other.resolve([]); await before; assert.equal(query(scope, work), after);
  forced.resolve([]); await after;
}
console.log("Recargas originales Familia/Cajas: una consulta en vuelo por cuenta/sesión/revisión, actualización manual nueva, lista sin miembros, saldos paralelos, fallos/consulta colgada y confirmaciones protegidos. IO/React adaptados, no dinero real.");

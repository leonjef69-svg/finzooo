import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
const transpile = value => ts.transpile(value, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const tick = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function original(file, dependencies = {}) {
  const entry = { exports: {} };
  vm.runInNewContext(transpile(read(file)), { module: entry, exports: entry.exports,
    require: name => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return entry.exports;
}
function source(file) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes = [];
  function visit(node) { nodes.push(node); ts.forEachChild(node, visit); }
  visit(tree);
  return { tree, nodes };
}
function hooks(scope) {
  let index = 0;
  const slots = [];
  scope.useCallback = (callback, deps) => {
    const slot = index++, old = slots[slot];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[slot] = { deps, value: callback };
    return slots[slot].value;
  };
  scope.useFocusEffect = callback => {
    const slot = index++, old = slots[slot];
    if (!old || old.callback !== callback) { old?.stop?.(); slots[slot] = { callback, stop: callback() }; }
  };
  scope.useEffect = (callback, deps) => {
    const slot = index++, old = slots[slot];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      old?.stop?.(); slots[slot] = { deps, stop: callback() };
    }
  };
  return { reset: () => { index = 0; }, stop: () => slots.forEach(slot => slot.stop?.()) };
}
let activeUid = "A", activeSession = 1;
const auth = { get currentUser() { return activeUid ? { uid: activeUid } : null; } };
const getAccountStorageSession = () => activeSession;
const account = original("utils/accountTask.ts", { "@/utils/firebase": { auth }, "@/utils/storage": { getAccountStorageSession } });
const failures = [], measurements = [];
async function scenario(name, run) { try { await run(); } catch (error) { failures.push(`${name}: ${error.message}`); } }

await scenario("regreso de Caja compartida", async () => {
  const { tree, nodes } = source("screens/Cajas.tsx");
  const effects = nodes.filter(node => ts.isCallExpression(node) && node.expression.getText(tree) === "useFocusEffect"
    && /listarCajasCompartidas|const local = await loadJSON/.test(node.arguments[0]?.getText(tree)));
  assert.equal(effects.length, 2, "ejecutar las dos consultas originales");
  const back = nodes.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "volverDeCompartida");
  const refresh = nodes.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "actualizarListaCajas");
  let localReads = 0, privateCloudReads = 0, sharedListReads = 0;
  const empty = { cajas: [], movimientos: [], cajasBorradas: [], movimientosBorrados: [] };
  const scope = { ...account, ...original("utils/spaceRead.ts"), ...original("utils/familyMutation.ts"),
    accountUid: "A", accountSession: 1, personalReady: true, hasOnboarded: true, isPremium: true, cloudBackupEnabled: true,
    userCurrency: "PEN", compartidaAbierta: { id: "shared" }, refreshVersion: 0, requestedRefresh: { current: 0 },
    mounted: { current: true }, conversionEnCurso: { current: false }, recuperacionConversionEnCurso: { current: false },
    guardandoRef: { current: false }, premiumForSync: { current: true }, nubeConfirmadaPara: { current: null },
    listaCompartidaCompleta: { current: true }, datosActuales: { current: empty }, personalActuales: { current: [] }, borradosActuales: { current: [] },
    CAJAS_VACIAS: empty, STORAGE_KEYS: { cajasDinero: "private" }, cuentaActual: () => activeUid === "A" && activeSession === 1,
    revisionCajasEnMemoria: () => 1, leerCajasEnMemoria: () => empty, leerCajasCompartidasEnMemoria: () => ({}),
    loadJSON: async () => { localReads++; return empty; }, bajarCajas: async () => { privateCloudReads++; return empty; },
    listarCajasCompartidas: async () => { sharedListReads++; return []; }, validarCajas: value => value,
    planPrivateBoxRepair: () => ({ conflicts: [] }), fusionarCajasProtegidas: data => ({ local: data }),
    privateBoxCloudResponseCurrent: () => true, hasUnreadableLocalData: () => false, guardarCajasEnMemoria() {}, saveJSON() {},
    setCargandoCompartidas() {}, setErrorCompartidas() {}, setActualizandoListaCompartida() {}, setCompartidasConocidas() {},
    setCompartidas() {}, setCloudReady() {}, setNameCopies() {}, setReady() {}, setSyncIssue() {},
    setDatos: value => { scope.datosActuales.current = value; }, reportSyncError: error => { throw error; },
    setCompartidaAbierta: value => { scope.compartidaAbierta = value; }, setInvitacionInicialCompartida() {},
    setRefreshVersion: update => { scope.refreshVersion = update(scope.refreshVersion); } };
  const scheduler = hooks(scope);
  const render = () => { scheduler.reset(); scope.requestedRefresh.current = scope.refreshVersion;
    vm.runInNewContext(transpile(effects.map(node => node.getText(tree)).join(";\n")), scope); };
  vm.runInNewContext(transpile(`${back.getText(tree)}\n${refresh.getText(tree)}\nObject.assign(globalThis, { volverDeCompartida, actualizarListaCajas });`), scope);
  render(); await tick();
  const before = { localReads, privateCloudReads, sharedListReads };
  scope.volverDeCompartida(); render(); await tick();
  measurements.push({ case: "backFromShared", localReads: localReads - before.localReads,
    privateCloudReads: privateCloudReads - before.privateCloudReads, sharedListReads: sharedListReads - before.sharedListReads });
  assert.equal(sharedListReads - before.sharedListReads, 1, "volver sí confirma la lista compartida actual");
  assert.equal(localReads, before.localReads, "volver de compartida no relee todas las Cajas privadas");
  assert.equal(privateCloudReads, before.privateCloudReads, "volver de compartida no descarga el libro privado ajeno");
  scope.actualizarListaCajas(); render(); await tick();
  assert.equal(localReads, before.localReads + 1, "Actualizar conserva lectura privada explícita");
  assert.equal(privateCloudReads, before.privateCloudReads + 1, "Actualizar conserva confirmación privada de nube");
  assert.equal(sharedListReads, before.sharedListReads + 2, "Actualizar también renueva la lista compartida");
  scheduler.stop();
});

function sharedFixture({ delayedMembers = false, lostRemovalResponse = false } = {}) {
  const { tree, nodes } = source("screens/SharedBoxes.tsx");
  const effects = nodes.filter(node => ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect"
    && /observeFamilyMutation|escucharMovimientosCaja|listarMiembrosCaja/.test(node.arguments[0]?.getText(tree)));
  const execute = nodes.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ejecutar");
  const memberAction = nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === "quitar").initializer.getText(tree);
  const manual = nodes.find(node => ts.isJsxAttribute(node) && node.name.getText(tree) === "onPress"
    && node.initializer?.getText(tree).includes("setActualizandoCaja(true)")).initializer.expression.getText(tree);
  const openMembers = nodes.find(node => ts.isJsxAttribute(node) && node.name.getText(tree) === "onPress"
    && node.initializer?.getText(tree).includes("setVerMiembros(true)")).initializer.expression.getText(tree);
  let memberReads = 0, subscriptions = 0, stops = 0, confirmations = 0, removed = 0;
  let receive;
  const memberResponses = [];
  const state = { members: [], confirmed: false, movements: [] };
  const mutations = original("utils/familyMutation.ts");
  const scope = { ...account, ...mutations, auth, getAccountStorageSession, uid: "A", accountSession: 1,
    cajaId: "shared", caja: { id: "shared" }, owner: true, busy: false, subscriptionRevision: 0, membersRevision: 0,
    selectedBoxId: { current: "shared" }, mounted: { current: true }, movementEpoch: { current: 0 },
    confirmedSource: { current: null }, loadedBoxId: { current: undefined }, loadedMembersBoxId: { current: undefined }, membersEpoch: { current: 0 },
    moneyLock: { current: false }, lock: { current: false }, borradosConfirmados: { current: new Map() }, cierresPendientes: { current: new Set() },
    errorRef: { current: error => { state.error = error; } },
    setMovimientosConfirmados: value => { state.confirmed = value; }, setMovimientos: value => { state.movements = value; },
    setMiembros: update => { state.members = typeof update === "function" ? update(state.members) : update; },
    setActualizandoCaja() {}, setCargandoCaja() {}, setErrorCargaCaja() {}, setBusy() {}, setVerMiembros() {},
    setSubscriptionRevision: update => { scope.subscriptionRevision = update(scope.subscriptionRevision); },
    setMembersRevision: update => { scope.membersRevision = update(scope.membersRevision); },
    listarMiembrosCaja: async () => {
      memberReads++; const response = deferred(); memberResponses.push(response);
      return delayedMembers ? response.promise : [{ uid: "A", rol: "owner" }, { uid: "B", rol: "member" }].filter(item => !removed || item.uid !== "B");
    },
    escucharMovimientosCaja: (_id, callback) => { subscriptions++; receive = callback; return () => stops++; },
    confirmarCajaAbierta: async () => { confirmations++; return true; }, quitarMiembroCaja: async () => { removed++; if (lostRemovalResponse) throw Error("lost-response"); },
    t: key => key, Alert: { alert: (_title, _text, buttons) => buttons.at(-1).onPress() } };
  const scheduler = hooks(scope);
  vm.runInNewContext(transpile(`${execute.getText(tree)}\nglobalThis.execute = ejecutar; globalThis.removeMember = ${memberAction}; globalThis.manual = ${manual}; globalThis.openMembers = ${openMembers};`), scope);
  const render = () => { scheduler.reset(); vm.runInNewContext(transpile(effects.map(node => node.getText(tree)).join(";\n")), scope); };
  return { scope, state, render, stop: scheduler.stop, memberResponses, receive: (...args) => receive(...args),
    counts: () => ({ memberReads, subscriptions, stops, confirmations, removed }) };
}

await scenario("miembros independientes del dinero", async () => {
  const f = sharedFixture(); f.render(); await tick();
  assert.equal(f.counts().memberReads, 1); assert.equal(f.state.members.length, 2);
  f.receive([{ id: "first", tipo: "ingreso", monto: 10 }], true); await tick();
  assert.equal(f.state.confirmed, true, "la lista financiera sigue confirmándose con el servidor");
  await f.scope.execute(async wait => { await wait(async () => {}); }); f.render(); await tick();
  measurements.push({ case: "financialSave", memberReads: f.counts().memberReads, financialSubscriptions: f.counts().subscriptions });
  assert.equal(f.counts().memberReads, 1, "guardar o devolver dinero no vuelve a descargar miembros");
  assert.equal(f.counts().subscriptions, 2, "la confirmación financiera sí reinicia su escucha tras guardar");
  f.receive([{ id: "saved", tipo: "gasto", monto: 1 }], false); await tick();
  assert.equal(f.state.confirmed, false, "una caché nunca se acepta como confirmación financiera");
  f.receive([{ id: "saved", tipo: "gasto", monto: 1 }], true); await tick();
  assert.equal(f.state.confirmed, true); assert.equal(f.counts().confirmations, 2);
  f.scope.openMembers(); f.render(); await tick();
  assert.equal(f.counts().memberReads, 2, "abrir Miembros obtiene una lista actual");
  f.scope.removeMember({ uid: "B", nombre: "B", rol: "member" }); await tick(); f.render(); await tick();
  assert.equal(f.counts().removed, 1); assert.deepEqual(Array.from(f.state.members, item => item.uid), ["A"], "quitar confirma y actualiza solo miembros");
  assert.equal(f.counts().memberReads, 3, "quitar vuelve a confirmar su lista afectada");
  f.scope.manual(); f.render(); await tick();
  assert.equal(f.counts().memberReads, 4, "Actualizar mantiene la consulta explícita de miembros");
  const subscriptions = f.counts().subscriptions;
  f.stop(); assert.equal(f.counts().stops, subscriptions, "desmontar cierra todas las escuchas financieras");
});

await scenario("quitar invalida miembros antes de cleanup", async () => {
  const f = sharedFixture({ delayedMembers: true }); f.render(); await tick();
  f.memberResponses[0].resolve([{ uid: "A", rol: "owner" }, { uid: "B", rol: "member" }]); await tick();
  f.scope.openMembers(); f.render(); await tick();
  const oldResponse = f.memberResponses[1];
  f.scope.removeMember({ uid: "B", nombre: "B", rol: "member" }); await tick();
  assert.deepEqual(Array.from(f.state.members, item => item.uid), ["A"]);
  // A propósito sin render/cleanup: la respuesta previa llega tras confirmar
  // el borrado, en la ventana que el simple cambio de dependencias no cubre.
  oldResponse.resolve([{ uid: "A", rol: "owner" }, { uid: "B", rol: "member" }]); await tick();
  assert.deepEqual(Array.from(f.state.members, item => item.uid), ["A"], "una respuesta antigua no repone al integrante quitado");
  f.stop();
});

await scenario("quitar con respuesta perdida confirma miembros", async () => {
  const f = sharedFixture({ lostRemovalResponse: true }); f.render(); await tick();
  f.scope.removeMember({ uid: "B", nombre: "B", rol: "member" }); await tick(); f.render(); await tick();
  assert.equal(f.counts().memberReads, 2, "un error de respuesta también renueva la lista afectada");
  assert.deepEqual(Array.from(f.state.members, item => item.uid), ["A"], "si el servidor quitó al integrante, la confirmación lo refleja");
  assert.match(f.state.error.message, /lost-response/, "el error no se oculta");
  f.stop();
});

for (const change of ["box", "account", "session", "unmount"]) await scenario(`miembros atrasados: ${change}`, async () => {
  activeUid = "A"; activeSession = 1;
  const f = sharedFixture({ delayedMembers: true }); f.render(); await tick();
  if (change === "box") f.scope.selectedBoxId.current = "other";
  if (change === "account") activeUid = "B";
  if (change === "session") activeSession = 2;
  if (change === "unmount") f.stop();
  f.memberResponses[0].resolve([{ uid: "old", rol: "member" }]); await tick();
  assert.equal(f.state.members.length, 0, "una consulta vieja no cambia los miembros actuales");
  f.stop(); activeUid = "A"; activeSession = 1;
});
console.log(JSON.stringify({ originalHandlersAndEffects: true, ioAndReactAdapted: true, noRealData: true, measurements }));
assert.deepEqual(failures, [], failures.join("\n"));

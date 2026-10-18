import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { buildSync } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { withImmediateRemoval } from "./helpers/immediate-removal-original.mjs";
import { familyMutationOriginal } from "./helpers/family-mutation-original.mjs";
import { spaceReadOriginal } from "./helpers/space-read-original.mjs";

const baseline = process.env.FINO_TEST_FAMILY_WAIT_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = code => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 70; i++) await Promise.resolve(); };
function find(file, predicate) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) { if (!result && predicate(node, tree)) result = node; if (!result) ts.forEachChild(node, visit); }
  visit(tree); return { node: result, tree };
}
function original(file, name) {
  const { node, tree } = find(file, (node, tree) => ts.isFunctionDeclaration(node) && node.name?.text === name
    || ts.isVariableDeclaration(node) && node.name.getText(tree) === name);
  if (!node) return ""; // El código anterior no llama a los auxiliares nuevos.
  return ts.isVariableDeclaration(node) ? `const ${node.getText(tree)};` : node.getText(tree);
}
const file = "screens/Family.tsx";
function harness() {
  const a = { id: "a", nombre: "Anterior" }, b = { id: "b", nombre: "Elegida" };
  const ma = [{ id: "mov-a", tipo: "ingreso", monto: 40 }], mb = [{ id: "mov-b", tipo: "ingreso", monto: 80 }];
  const memory = new Map([["A", { familia: a, familias: [a, b], miembros: [{ uid: "old-member" }], movimientos: ma,
    movimientosFamilias: { a: ma, b: mb }, saldosFamilias: { a: 40, b: 80 }, actualizadaEn: 0 }]]);
  const s = { ...spaceReadOriginal(), ...familyMutationOriginal(memory), accountUid: "A", accountSession: 1, auth: { currentUser: { uid: "A" } }, getAccountStorageSession: () => 1,
    listaFamiliasVisible: { current: true },
    withImmediateRemoval, setMovimientosOcultos() {},
    useCallback: callback => callback,
    mounted: { current: true }, reloadId: { current: 0 }, familiaElegida: { current: "a" }, confirmedReload: { current: 0 },
    actionLock: { current: false }, pendingDebit: { current: null }, cierresPendientes: { current: new Set() }, familiaEnMemoria: memory, VENTANA_CAMBIO_RAPIDO_MS: 2000,
    familia: a, familias: [a, b], miembros: [{ uid: "old-member" }], movimientos: ma, verTodas: true,
    seleccionandoFamilias: false, seleccionarFamilia() {}, invitacion: "old-invite", filter: "ingreso",
    tRef: { current: key => key }, toastRef: { current: () => {} },
    listarFamilias: async () => [a, b], cargarFamiliaActiva: async () => a,
    listarMovimientosFamilia: async id => id === "a" ? ma : mb, listarMiembrosFamilia: async id => [{ uid: `member-${id}` }],
    captureAccountTask: (_uid, valid) => ({ current: valid, wait: async work => {
      if (!valid()) throw Error("stale"); const result = await work(); if (!valid()) throw Error("stale"); return result;
    } }),
  };
  s.captureAccountTask = handlerOriginal("utils/accountTask.ts", "captureAccountTask", { auth: s.auth, getAccountStorageSession: s.getAccountStorageSession });
  for (const name of ["Familia", "Familias", "Miembros", "Movimientos", "VerTodas", "FamiliasSincronizadas", "SaldosFamilias", "MovimientosFamilias",
    "Cargando", "Actualizando", "ErrorCarga", "Tipo", "Invitacion", "Filter", "Seleccionados", "Seleccionando"]) {
    const key = name[0].toLowerCase() + name.slice(1);
    s[`set${name}`] = value => { s[key] = typeof value === "function" ? value(s[key]) : value; };
  }
  const { node, tree } = find(file, (node, tree) => ts.isVariableDeclaration(node) && node.name.getText(tree) === "recargar");
  vm.runInNewContext(js(`globalThis.recargar = (${node.initializer.arguments[0].getText(tree)});
    ${["abrirFamilia", "retirarFamiliasConfirmadas", "retirarMovimientoConfirmado"].map(name => original(file, name)).join("\n")}`), s);
  return { s, a, b, ma, mb, memory };
}

// Ejecutar el botón original anterior/nuevo: el fallo rojo no es un auxiliar ausente.
{
  const { s, b, mb } = harness(), network = deferred(); s.listarFamilias = () => network.promise;
  const { node, tree } = find(file, (node, tree) => ts.isJsxAttribute(node) && node.name.getText(tree) === "onPress"
    && node.initializer?.getText(tree).includes("seleccionandoFamilias ? seleccionarFamilia(item)"));
  s.item = b;
  vm.runInNewContext(js(`globalThis.press = (${node.initializer.expression.getText(tree)});`), s);
  s.press();
  assert.equal(s.familia.id, "b");
  assert.deepEqual(plain(s.movimientos), mb, "abrir B no conserva los movimientos de A mientras espera la red");
  assert.deepEqual(plain(s.miembros), [], "tampoco conserva integrantes de A");
  assert.equal(s.invitacion, ""); assert.equal(s.filter, null);
  s.reloadId.current++; network.resolve([]); await tick();
}

// La familia elegida no espera el historial de otra; la conciliación sí espera todas.
{
  const { s, b, mb, ma, memory } = harness(), slow = deferred();
  s.familiaElegida.current = b.id;
  s.listarMovimientosFamilia = id => id === "a" ? slow.promise : Promise.resolve(mb);
  let finished = false;
  const work = s.recargar("b", true).then(() => { finished = true; }); await tick();
  assert.equal(finished, true, "no espera el historial de A para abrir B");
  assert.deepEqual(plain(s.movimientos), mb); assert.equal(s.familia.id, "b");
  assert.equal(s.familiasSincronizadas, false, "no concilia contra una foto parcial");
  slow.resolve(ma); await work; await tick();
  assert.equal(s.familiasSincronizadas, true); assert.equal(memory.get("A").familia.id, "b");
}

// Una respuesta tardía no vuelve a abrir la familia anterior ni reemplaza su caché.
{
  const { s, a, b, ma, mb, memory } = harness(), slow = deferred();
  s.listarMovimientosFamilia = id => id === "a" ? slow.promise : Promise.resolve(mb);
  const old = s.recargar(a.id, true); await tick();
  s.familiaElegida.current = b.id;
  await s.recargar(b.id, true); slow.resolve(ma); await old; await tick();
  assert.equal(s.familia.id, b.id); assert.deepEqual(plain(s.movimientos), mb);
  assert.equal(memory.get("A").familia.id, b.id);
}

// El libro no se modifica antes del ACK; la máscara visual inmediata se prueba aparte.
{
  const { s, ma } = harness(), remote = deferred(), reload = deferred();
  Object.assign(s, { seleccionados: ["mov-a"], owner: true, movimientos: ma,
    planSpaceMovementDeletion: () => ({ ok: true, items: ma }), borrarMovimientoFamilia: () => remote.promise,
    ejecutar: action => { const wait = fn => fn(); wait.reload = () => reload.promise; return action(wait); },
    deleteLinkedTransferTransaction: async () => true });
  vm.runInNewContext(js(`${original(file, "borrarSeleccionados")}\nglobalThis.remove = borrarSeleccionados;`), s);
  const deleting = s.remove(); await tick(); assert.equal(s.movimientos.length, 1);
  remote.resolve(); await tick(); assert.equal(s.movimientos.length, 0, "retira el borrado confirmado antes de consultar las demás familias");
  reload.resolve(); await deleting;
}

// Alta confirmada: pasa a una carga explícita de la familia nueva, no a la pantalla vacía.
{
  const { s } = harness(), remote = deferred(), reload = deferred();
  Object.assign(s, { pendingDebit: { current: null }, isPremium: true, nombre: "Nueva", montoInicial: "100", origenInicial: "externo",
    userName: "A", userCurrency: "PEN", amountInputError: () => null, parseAmountInput: Number,
    saldoPersonalEn: () => 1000, fechaHoy: () => "2026-10-15", crearFamilia: () => remote.promise,
    ejecutar: action => { const wait = fn => fn(); wait.reload = id => { assert.equal(id, "new"); return reload.promise; }; return action(wait); },
    t: key => key, showToast() {}, setModo() {}, setNombre() {}, setMontoInicial() {}, setOrigenInicial() {},
  });
  vm.runInNewContext(js(`${original(file, "crear")}\nglobalThis.create = crear;`), s);
  const work = s.create(); await tick(); remote.resolve({ id: "new", nombre: "Nueva" }); await tick();
  assert.equal(s.cargando, true, "hay carga explícita en vez de presentar la familia nueva como inexistente");
  assert.equal(s.familia.id, "new"); assert.deepEqual(plain(s.movimientos), []);
  reload.resolve(); await work;
}

// Caja compartida: el borrado confirmado se ve antes de reiniciar la escucha.
{
  const remote = deferred(), boxFile = "screens/SharedBoxes.tsx";
  const item = { id: "remove", tipo: "ingreso", monto: 10, creadoPor: "A" };
  const s = { caja: { id: "box" }, uid: "A", auth: { currentUser: { uid: "A" } }, owner: true, movimientos: [item], borradosConfirmados: { current: new Map() },
    withImmediateRemoval, mounted: { current: true }, getAccountStorageSession: () => 1, accountSession: 1, setMovimientosOcultos() {},
    balanceOfSpace: () => 100, ejecutar: action => action(fn => fn()), borrarMovimientoCajaCompartida: () => remote.promise,
    setMovimientos: update => { s.movimientos = update(s.movimientos); },
  };
  vm.runInNewContext(js(`${original(boxFile, "borrar")}\nglobalThis.remove = borrar;`), s);
  const work = s.remove(item); await tick(); assert.equal(s.movimientos.length, 1);
  remote.resolve(); await work; assert.equal(s.movimientos.length, 0);
  assert.ok(s.borradosConfirmados.current.get("box").has(item.id));
}

// Cerrar la familia anterior justo después del toque no cierra la nueva.
{
  const { s } = harness(); let receive, removed = 0;
  Object.assign(s, { familiaId: "a", retirarFamiliasConfirmadas: () => { removed++; },
    observarCierreFamilia: (_id, callback) => { receive = callback; return () => {}; } });
  const { node, tree } = find(file, (node, tree) => ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect"
    && node.arguments[0]?.getText(tree).includes("observarCierreFamilia("));
  vm.runInNewContext(js(`globalThis.watch = (${node.arguments[0].getText(tree)});`), s);
  s.watch(); s.familiaElegida.current = "b"; receive(); assert.equal(removed, 0);
}

// Cajas ya no usa una segunda ruta/lista: el detalle recibe la elegida de la
// lista única. La regresión visual de la ruta antigua se ejecuta también en
// verificar-recuperacion-invitacion-caja-real.
{
  const code = read("screens/SharedBoxes.tsx");
  assert.doesNotMatch(code, /useLocalSearchParams|routeBoxOpened|setModo\("unir"\)/, "no conservar un segundo recorrido antiguo que cambie la Caja abierta");
  assert.match(code, /useState<CajaCompartida \| null>\(initialBox\)/);
}

// Tres casos equivalentes a hj: se conservan y no bloquean una caja independiente.
{
  const box = { id: "caja-sana", nombre: "Actual" };
  const conflicts = [1, 2, 3].map(id => ({ boxId: "caja-hj", movementId: `mov-${id}`, personalId: id, reason: "deleted" }));
  let remote = 0, review = 0; const notices = [];
  const s = { caja: box, repairBlocked: false, repairPlan: { conflicts }, auth: { currentUser: { uid: "A" } },
    avisarRevisionNecesaria: () => { review++; }, compartiendo: false, conversionEnCurso: { current: false }, recuperacionConversionEnCurso: { current: false }, guardandoRef: { current: false },
    isPremium: true, movimientos: [], transactions: [], privateBoxLinksMatch: () => true,
    captureAccountTask: () => ({ current: () => true, wait: work => work() }), accountUid: "A", cuentaActual: () => true, ready: true,
    hasUnreadableLocalData: () => false, setCompartiendo() {}, setRefreshVersion() {}, assertSharedContentAccepted: async () => {},
    invitacionPrivadaSolicitada: { current: false }, setInvitacionPrivadaVisible() {},
    datosActuales: { current: { cajas: [box], movimientos: [] } }, nuevoIntentoCaja: () => "attempt", userName: "A", userCurrency: "PEN",
    guardarCambioCaja: async next => { s.datosActuales.current = next; return true; },
    compartirCajaExistente: async (...args) => { remote++; assert.deepEqual(plain(args[6]), ["caja-hj", "caja-hj", "caja-hj"]); throw Error("test-stop"); },
    t: key => key, reportSyncError() {}, spaceErrorKey: () => "error", showToast: key => notices.push(key),
  };
  const before = plain(conflicts);
  const share = handlerOriginal("screens/Cajas.tsx", "compartirCaja", s, read("screens/Cajas.tsx"));
  await share(); assert.equal(remote, 1, "los tres casos de hj no bloquean compartir una caja independiente");
  assert.equal(review, 0); assert.deepEqual(conflicts, before);
  const noticeCount = notices.length;
  s.caja.id = "caja-hj"; await share(); assert.equal(remote, 1); assert.equal(review, 0, "invitar no abre los detalles financieros");
  assert.equal(notices.length, noticeCount, "hj queda desactivada sin repetir avisos, reparar dinero ni generar código falso");
}
{
  const output = buildSync({ entryPoints: ["utils/privateBoxRepair.ts"], bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": process.cwd() } });
  const module = { exports: {} }; vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports });
  const repair = module.exports;
  // Reproduce la estructura mostrada por el dueño, no presume sus IDs reales.
  const data = { cajas: [{ id: "caja-hj", nombre: "hj", creadaEn: 1 }], cajasBorradas: [], movimientosBorrados: [],
    movimientos: [1, 2, 3].map(id => ({ id: `mov-${id}`, cajaId: "caja-hj", personalTransactionId: id,
      tipo: "ingreso", monto: 10, fecha: "2026-10-02", creadoEn: id, descripcion: "Aporte antiguo" })) };
  const before = plain(data), deleted = [1, 2, 3];
  const plan = repair.planPrivateBoxRepair(data, [], deleted, "A");
  assert.equal(plan.conflicts.length, 3); assert.ok(plan.conflicts.every(issue => issue.reason === "deleted"));
  assert.equal(plan.upserts.length, 0, "las marcas de borrado no se convierten en movimientos nuevos");
  for (const movement of data.movimientos) for (const from of ["personal", "box"]) {
    assert.throws(() => repair.resolvePrivateBoxConflict(data, [], deleted, "A", { movementId: movement.id, from }), /conflict/);
  }
  assert.deepEqual(data, before); assert.deepEqual(deleted, [1, 2, 3]);
}
console.log("Familias/Cajas originales: selección sin mezcla, apertura priorizada, respuesta tardía descartada, borrado confirmado inmediato y casos antiguos conservados sin bloqueo ajeno.");

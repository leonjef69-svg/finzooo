import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const baseline = process.env.FINO_TEST_UNIFIED_BOXES_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const main = "screens/Cajas.tsx", shared = "screens/SharedBoxes.tsx";
const source = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(file, predicate) {
  const tree = source(file); let node;
  function visit(current) { if (!node && predicate(current, tree)) node = current; if (!node) ts.forEachChild(current, visit); }
  visit(tree); assert.ok(node, `Expresión original de ${file}`); return { node, tree };
}
const run = (text, scope) => vm.runInNewContext(ts.transpile(text, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }), scope);
const original = (file, name) => {
  const { node, tree } = find(file, (node, tree) => ts.isFunctionDeclaration(node) && node.name?.text === name
    || ts.isVariableDeclaration(node) && node.name.getText(tree) === name);
  return ts.isVariableDeclaration(node) ? `const ${node.getText(tree)};` : node.getText(tree);
};
const tick = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
function gate() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const attr = (node, name) => node.attributes.properties.find(prop => prop.name?.text === name)?.initializer?.expression;
function button(file, label) {
  return find(file, (node, tree) => ts.isJsxOpeningElement(node) && node.tagName.getText(tree) === "TouchableOpacity"
    && attr(node, "accessibilityLabel")?.getText(tree) === `t("${label}")`);
}

// La versión anterior confundía una conversión EN CURSO con un fallo.
{
  const { node, tree } = find(main, node => ts.isJsxExpression(node) && node.expression && ts.isConditionalExpression(node.expression)
    && node.expression.whenTrue.getText().includes('t("boxes.sharingPending")'));
  const condition = node.expression.condition.getText(tree);
  const s = { caja: { sharingPending: true }, compartiendo: true };
  assert.equal(run(condition, s), false, "no mostrar 'quedó pendiente' mientras se está compartiendo");
  s.compartiendo = false; assert.equal(run(condition, s), true, "un resultado realmente incierto conserva recuperación/cancelación");
}
{
  const { node, tree } = find(main, node => ts.isConditionalExpression(node) && node.condition.getText().startsWith("!ready"));
  assert.equal(run(node.condition.getText(tree), { ready: true, compartiendo: true, caja: undefined }), true,
    "tras retirar la privada y mientras llega el código no se muestra fugazmente otra lista");
  assert.equal(run(node.condition.getText(tree), { ready: true, compartiendo: false, caja: undefined }), false);
}
const box = { id: "shared-a", nombre: "Elegida", ownerUid: "A", currency: "PEN", creadaEn: 3 };
const rows = [{ id: "real", tipo: "ingreso", monto: 100 }, { id: "spent", tipo: "gasto", monto: 25 }];
// Invitar usa el bloqueo original, pero no invalida la foto financiera.
{
  const network = gate(), errors = [], origin = { boxId: box.id, epoch: 4 };
  const s = { uid: "A", caja: box, owner: true, isPremium: true, lock: { current: false }, moneyLock: { current: false }, mounted: { current: true },
    getAccountStorageSession: () => 1, accountSession: 1, movementEpoch: { current: 4 }, confirmedSource: { current: origin },
    cierresPendientes: { current: new Set() }, errorRef: { current: error => errors.push(error) }, rows,
    subscription: 0, busy: false, confirmed: true, code: "", calls: 0, modo: null, modoSuspendido: { current: null }, editandoNombreCaja: false, seleccionando: false,
    captureAccountTask: (_uid, valid) => ({ current: valid, wait: async work => { if (!valid()) throw Error("stale"); const value = await work(); if (!valid()) throw Error("stale"); return value; } }),
    setBusy: value => { s.busy = value; }, setMovimientosConfirmados: value => { s.confirmed = value; },
    setSubscriptionRevision: update => { s.subscription = update(s.subscription); },
    limpiar() {}, setModo: value => { s.modo = value; }, setEditandoAporteId() {}, setEditandoNombreCaja: value => { s.editandoNombreCaja = value; }, setNombreCajaEditado() {}, setSeleccionando: value => { s.seleccionando = value; },
    crearInvitacionCaja: (uid, id) => { assert.equal(uid, "A"); assert.equal(id, box.id); s.calls++; return network.promise; },
    setInvitacion: value => { s.code = value; }, irUnaVez() { throw Error("no abrir otra ruta"); },
    setInvitacionVisible: value => { s.invitationVisible = value; }, setPreparandoInvitacion: value => { s.preparing = value; },
  };
  run(`${original(shared, "ejecutar")}\n${original(shared, "invitar")}\nglobalThis.invite=invitar; globalThis.work=ejecutar;`, s);
  const pending = s.invite(); await s.invite(); assert.equal(s.calls, 1, "dos toques generan un solo código");
  assert.equal(s.invitationVisible, true); assert.equal(s.preparing, true);
  assert.equal(s.confirmedSource.current, origin); assert.equal(s.movementEpoch.current, 4); assert.equal(s.confirmed, true);
  network.resolve("ABCD2345"); await pending;
  assert.equal(s.code, "ABCD2345"); assert.equal(s.rows, rows); assert.equal(s.caja, box);
  assert.equal(s.subscription, 0, "Invitar no reinicia la escucha ni vacía movimientos");
  const close = find(shared, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText() === "SpaceInvitationSheet");
  run(`(${attr(close.node, "onClose").getText(close.tree)})()`, s);
  assert.equal(s.code, ""); assert.equal(s.caja, box); assert.equal(s.rows, rows); assert.equal(s.subscription, 0);
  s.modo = "gasto"; s.editandoNombreCaja = true; s.seleccionando = true;
  s.crearInvitacionCaja = async () => { throw Error("offline"); }; await s.invite();
  assert.equal(errors.length, 1); assert.equal(s.busy, false); assert.equal(s.confirmedSource.current, origin);
  assert.equal(s.modo, null, "si falla Invitar no vuelve a abrir Ingreso/Gasto de fondo");
  assert.equal(s.modoSuspendido.current, "gasto", "el borrador se conserva para que el usuario elija recuperarlo");
  assert.equal(s.editandoNombreCaja, false); assert.equal(s.seleccionando, false, "el fallo deja limpia la vista normal de la Caja");
  await s.work(wait => wait(async () => {}));
  assert.equal(s.movementEpoch.current, 5); assert.equal(s.confirmedSource.current, null);
  assert.equal(s.subscription, 1, "las operaciones de dinero SÍ conservan su invalidación/recarga");
}
// El alta se despliega junto a Crear, antes de cualquier Caja existente.
{
  const form = find(main, node => ts.isConditionalExpression(node) && node.condition.getText() === "creando"
    && node.whenTrue.getText().includes('value={nuevoNombre}')).node;
  const list = find(main, node => ts.isCallExpression(node) && node.expression.getText() === "cajasEnLista.map").node;
  assert.ok(form.pos < list.pos, "Crear no debe enviar el formulario debajo de la lista de Cajas");
}
// La selección es local, exacta y accesible al invitado sin Pro; no migra dinero.
{
  const s = { cuentaActual: () => true, isPremium: false, boxes: [box], selected: null, code: "", cajaId: "private", lista: false,
    setCompartidas: update => { s.boxes = update(s.boxes); }, setCompartidaAbierta: value => { s.selected = value; },
    setInvitacionInicialCompartida: value => { s.code = value; }, setCajaId: value => { s.cajaId = value; },
    setLista: value => { s.lista = value; }, setVerMiembros() {}, rows,
  };
  run(`${original(main, "abrirCompartida")}\nglobalThis.open=abrirCompartida;`, s);
  s.open(box, "ABCD2345"); assert.equal(s.selected, box); assert.equal(s.code, "ABCD2345");
  assert.equal(s.boxes.length, 1); assert.equal(s.cajaId, null); assert.equal(s.lista, true); assert.equal(s.rows, rows);
  const another = { ...box, id: "antes" }; s.boxes = [another, box]; s.open(box);
  assert.equal(s.boxes[0], another, "abrir una caja existente no cambia el orden al regresar");
  s.cuentaActual = () => false; s.open({ ...box, id: "otra" }); assert.equal(s.selected, box);
  assert.doesNotMatch(read(main), /irUnaVez\([^\n]*shared-boxes|t\("boxes\.shared"\)/, "sin acceso/lista/ruta extra en el recorrido normal");
}
{
  const s = { lock: { current: false }, calls: 0, onAllBoxes: () => { s.calls++; }, safeBack() { throw Error("no salir a otra lista"); } };
  run(`${original(shared, "volverACajas")}\nglobalThis.back=volverACajas;`, s);
  s.back(); assert.equal(s.calls, 1); s.lock.current = true; s.back(); assert.equal(s.calls, 1);
}
{
  const other = { ...box, id: "other" };
  const s = { cuentaActual: () => true, boxes: [box, other], selected: box, code: "code", revision: 1,
    setCompartidas: update => { s.boxes = update(s.boxes); }, setCompartidaAbierta: value => { s.selected = value; },
    setInvitacionInicialCompartida: value => { s.code = value; }, setRefreshVersion: update => { s.revision = update(s.revision); } };
  run(`${original(main, "volverDeCompartida")}\nglobalThis.back=volverDeCompartida;`, s);
  s.back(); assert.equal(s.boxes.length, 2, "volver sin cerrar no borra la caja");
  s.back(box.id); assert.equal(s.boxes.length, 1); assert.equal(s.boxes[0], other, "una caja cerrada/salida confirmada no reaparece esperando la recarga");
  assert.equal(s.selected, null); assert.equal(s.code, "");
}
// Lectura de la lista: no Pro, consulta tardía cancelada y saldos del historial real.
{
  const { node, tree } = find(main, node => ts.isCallExpression(node) && node.expression.getText() === "useFocusEffect"
    && node.arguments[0]?.getText().includes("listarCajasCompartidas"));
  const network = gate(); let cleanup, sets = 0;
  const s = { personalReady: true, hasOnboarded: true, accountUid: "A", compartidaAbierta: null, cuentaActual: () => true, refreshVersion: 1, requestedRefresh: { current: 1 }, conversionEnCurso: { current: false },
    useCallback: callback => callback, captureAccountTask: (_uid, valid) => ({ current: valid, wait: work => work() }),
    setCargandoCompartidas() {}, setErrorCompartidas() {}, listarCajasCompartidas: () => network.promise,
    leerCajasCompartidasEnMemoria: () => null, setActualizandoListaCompartida() {},
    listaCompartidaCompleta: { current: false }, setCompartidasConocidas() {},
    setCompartidas: () => { sets++; }, isPremium: false,
  };
  const expr = node.arguments[0].arguments[0].getText(tree);
  cleanup = run(`(${expr})()`, s); cleanup(); network.resolve([box]); await tick();
  assert.equal(sets, 0, "una consulta que llegó después de salir no cambia la lista");
  s.listarCajasCompartidas = async () => [box]; run(`(${expr})()`, s); await tick(); assert.equal(sets, 1);
  const watch = find(main, node => ts.isCallExpression(node) && node.expression.getText() === "useEffect"
    && node.arguments[0]?.getText().includes("compartidas.map"));
  const receive = []; let balances = {}, stopped = 0;
  Object.assign(s, { lista: true, verArchivadas: false, compartidas: [box],
    escucharMovimientosCaja: (_id, callback) => { receive.push(callback); return () => stopped++; },
    setSaldosCompartidas: update => { balances = update(balances); } });
  const stop = run(`(${watch.node.arguments[0].getText(watch.tree)})()`, s);
  receive[0](rows); assert.equal(balances[box.id], 75); stop(); receive[0]([]);
  assert.equal(balances[box.id], 75); assert.equal(stopped, 1);
}
// Miembros e Invitar comparten la fila superior; el detalle no está siempre abierto.
for (const file of [main, shared]) {
  const text = read(file);
  const all = text.indexOf('t("boxes.all")'), members = text.indexOf('t("family.members")', all), invite = text.indexOf('t("boxes.inviteAccessibility")', all);
  assert.ok(all >= 0 && members > all && invite > members);
  assert.match(text, /<SpaceMembersSheet/);
  assert.doesNotMatch(text, /t\("spaces.processing"\)/, "sin No repitas la acción durante una invitación");
  assert.equal((text.match(/accessibilityLabel=\{t\("boxes\.inviteAccessibility"\)\}/g) || []).length, 1);
  if (file === shared) assert.doesNotMatch(text, /miembros\.map/, "sin segunda lista de miembros incrustada en movimientos");
}
{
  const { node, tree } = find(shared, node => ts.isVariableDeclaration(node) && node.name.getText() === "cajaLista");
  for (const [cargandoCaja, errorCargaCaja] of [[true, false], [false, true], [false, false]]) {
    assert.equal(run(node.initializer.getText(tree), { caja: box, cargandoCaja, errorCargaCaja }), !cargandoCaja && !errorCargaCaja);
  }
  const loading = find(shared, node => ts.isConditionalExpression(node) && node.condition.getText() === "cargandoCaja");
  assert.ok(!loading.node.whenTrue.getText().includes('onPress={cerrar}'), "Cerrar no aparece durante la carga");
  const error = find(shared, node => ts.isConditionalExpression(node) && node.condition.getText() === "errorCargaCaja");
  assert.ok(!error.node.whenTrue.getText().includes('onPress={cerrar}'), "Cerrar no aparece con historial fallido");
  const invite = button(shared, "boxes.inviteAccessibility");
  assert.equal(run(attr(invite.node, "disabled").getText(invite.tree), { busy: true }), true);
}
console.log("Cajas originales: lista única, lectura cancelable y saldos reales; miembros/Invitar arriba; código sin invalidar dinero, cierre sin cambiar caja, doble toque y fallos protegidos. Android se comprueba aparte.");

import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_BOX_LIST_WARM_BASELINE });
const file = "screens/Cajas.tsx", text = read(file);
const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) {
  let found;
  function visit(node) { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); }
  visit(tree); return found;
}
const declaration = name => find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === name);
const run = (code, scope) => vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }), scope);
const plain = value => JSON.parse(JSON.stringify(value));
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function gate() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
let uid = "A", session = 1;
const auth = { get currentUser() { return uid ? { uid } : null; } };
const memoryModule = { exports: {} };
vm.runInNewContext(ts.transpile(read("utils/cajasMemoria.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
  exports: memoryModule.exports, module: memoryModule,
  require: name => name.endsWith("firebase") ? { auth } : name.endsWith("storage") ? { getAccountStorageSession: () => session }
    : { assertPrivateBoxMoneyLocalMutation() {} },
});
const memory = memoryModule.exports;
const boxes = [{ id: "j", nombre: "Compartida", ownerUid: "A", creadaEn: 1, currency: "PEN" }];
const focus = find(node => ts.isCallExpression(node) && node.expression.getText(tree) === "useFocusEffect"
  && node.arguments[0]?.getText(tree).includes("listarCajasCompartidas"));
const focusCode = `(${focus.arguments[0].arguments[0].getText(tree)})()`;
function screen() {
  const s = { accountUid: uid, accountSession: session, personalReady: true, hasOnboarded: true, compartidaAbierta: null,
    lista: true, verArchivadas: false, refreshVersion: 0, requestedRefresh: { current: 0 }, known: false, listaCompartidaCompleta: { current: false },
    compartidasActuales: { current: [] }, saldosCompartidasActuales: { current: {} }, useCallback: fn => fn,
    cuentaActual: () => s.accountUid === uid && s.accountSession === session,
    captureAccountTask: (_uid, valid) => ({ current: valid, wait: work => work() }),
    ...memory, // Las versiones anteriores carecen de copia compartida: se verifica su conducta, no una API faltante.
    setRenderedCompartidas: value => { s.boxes = value; }, setRenderedSaldosCompartidas: value => { s.balances = value; },
    setCompartidasConocidas: value => { s.known = value; },
    setCargandoCompartidas: value => { s.loading = value; }, setErrorCompartidas: value => { s.error = value; },
    setActualizandoListaCompartida: value => { s.manual = value; },
    setCompartidaAbierta: value => { s.compartidaAbierta = value; }, setInvitacionInicialCompartida() {},
    setRefreshVersion: update => { s.refreshVersion = update(s.refreshVersion); s.requestedRefresh.current = s.refreshVersion; },
  };
  for (const name of ["setCompartidas", "setSaldosCompartidas"]) {
    const node = declaration(name);
    s[name] = node ? run(node.initializer.getText(tree), s) : update => {
      const key = name === "setCompartidas" ? "boxes" : "balances";
      s[key] = typeof update === "function" ? update(s[key]) : update;
    };
  }
  return s;
}
function initial() {
  const s = { ...memory, useRef: current => ({ current }), useState: current => [typeof current === "function" ? current() : current, () => {}] };
  const names = ["copiaCompartidaInicial", "[compartidas, setCompartidas]", "[compartidas, setRenderedCompartidas]",
    "[saldosCompartidas, setSaldosCompartidas]", "[saldosCompartidas, setRenderedSaldosCompartidas]", "[cargandoCompartidas, setCargandoCompartidas]"];
  const code = names.map(name => declaration(name)).filter(Boolean).sort((a, b) => a.pos - b.pos)
    .map(node => `const ${node.getText(tree)};`).join("\n");
  return plain(run(`${code}\n({ compartidas, saldosCompartidas, cargandoCompartidas })`, s));
}
// Primera consulta real y saldo recibidos; salir desmonta React, no debe olvidar la lista.
const s = screen(), request = gate(); s.listarCajasCompartidas = () => request.promise;
// Conocer solo la recién creada/unida no equivale a haber consultado todas.
s.setCompartidas(boxes);
if (memory.leerCajasCompartidasEnMemoria) assert.equal(memory.leerCajasCompartidasEnMemoria(), null);
const stop = run(focusCode, s); request.resolve(boxes); await tick();
s.setSaldosCompartidas(() => ({ j: 3 })); stop();
assert.deepEqual(initial(), { compartidas: boxes, saldosCompartidas: { j: 3 }, cargandoCompartidas: false },
  "Al volver a Cajas la primera imagen debe incluir la compartida y S/3, sin esperar ni mostrar solo la privada");

// Actualización automática con red lenta/fallida conserva la lista y no activa el indicador.
const slow = gate(); s.listarCajasCompartidas = () => slow.promise;
run(focusCode, s); assert.equal(s.loading, false); assert.deepEqual(plain(s.boxes), boxes);
slow.reject(Error("offline")); await tick();
assert.equal(s.error, true); assert.deepEqual(initial().saldosCompartidas, { j: 3 });

// El indicador se reserva para Actualizar voluntario, no para cada entrada automática.
const manual = find(node => ts.isFunctionDeclaration(node) && node.name?.text === "actualizarListaCajas");
run(`${manual.getText(tree)}\nactualizarListaCajas();`, s);
assert.equal(s.manual, true); assert.equal(s.refreshVersion, 1);
s.listarCajasCompartidas = async () => boxes; run(focusCode, s); await tick(); assert.equal(s.manual, false);
const indicator = find(node => ts.isConditionalExpression(node) && ts.isJsxSelfClosingElement(node.whenTrue)
  && node.whenTrue.tagName.getText(tree) === "ActivityIndicator");
assert.ok(indicator);
const idle = { guardando: false, compartiendo: false, cargandoUnion: false, actualizandoListaCompartida: false, invitacionPrivadaVisible: false };
assert.equal(run(indicator.condition.getText(tree), { ...idle, cargandoCompartidas: true, lista: true }), false,
  "consultar novedades al entrar no hace girar Actualizar");
assert.equal(run(indicator.condition.getText(tree), { ...idle, actualizandoListaCompartida: true }), true,
  "Actualizar voluntario sí confirma que está trabajando");

// Una respuesta que pertenece a la pantalla anterior no altera ni la copia para la siguiente.
const stale = gate(); s.listarCajasCompartidas = () => stale.promise;
const cleanup = run(focusCode, s); cleanup(); stale.resolve([]); await tick();
assert.deepEqual(initial().compartidas, boxes);

// El cierre/salida confirmado retira también la tarjeta recordada, antes de volver a consultar.
const back = find(node => ts.isFunctionDeclaration(node) && node.name?.text === "volverDeCompartida");
run(`${back.getText(tree)}\nvolverDeCompartida("j");`, s);
assert.deepEqual(initial(), { compartidas: [], saldosCompartidas: {}, cargandoCompartidas: false });

// Consulta posterior auténtica elimina ausentes; lista vacía conocida no vuelve a Cargando.
s.setCompartidas(boxes); s.setSaldosCompartidas(() => ({ j: 8 }));
s.listarCajasCompartidas = async () => []; run(focusCode, s); await tick();
assert.deepEqual(initial().compartidas, []); assert.deepEqual(initial().saldosCompartidas, {});

// Aislamiento de cuenta/sesión, bloqueo de escritura tardía y limpieza existente al salir.
s.setCompartidas(boxes); s.setSaldosCompartidas(() => ({ j: 3 }));
uid = "B"; assert.equal(memory.leerCajasCompartidasEnMemoria(), null);
uid = "A"; session = 2; assert.equal(memory.leerCajasCompartidasEnMemoria(), null);
memory.guardarCajasCompartidasEnMemoria(boxes, { j: 999 }, "A", 1);
assert.equal(memory.leerCajasCompartidasEnMemoria(), null);
memory.guardarCajasCompartidasEnMemoria(boxes, { j: 3 }, "A", 2);
memory.limpiarCajasEnMemoria(); assert.equal(memory.leerCajasCompartidasEnMemoria(), null);

// Sin copia todavía no se presenta una lista privada como si fuera la lista completa.
const waiting = find(node => ts.isConditionalExpression(node) && node.condition.getText(tree).includes("!compartidasConocidas"));
assert.ok(waiting);
assert.equal(run(waiting.condition.getText(tree), { accountUid: "A", verArchivadas: false, compartidasConocidas: false, cargandoCompartidas: true }), true);
assert.equal(run(waiting.condition.getText(tree), { accountUid: "A", verArchivadas: false, compartidasConocidas: true, cargandoCompartidas: true }), false);
console.log("Lista original al volver: compartidas y saldos desde la primera imagen, red lenta/fallida sin vaciado, cierre y cuentas/sesiones aisladas. Sin IO ni dinero reales.");

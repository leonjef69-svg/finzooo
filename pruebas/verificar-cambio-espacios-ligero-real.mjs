import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Código de producción original. Solo React y la plataforma se adaptan;
// los agrupadores y cálculos siguen siendo los de la app.
const read = createSourceReader();
const transpile = text => ts.transpile(text, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
function module(file, require = () => ({})) {
  const m = { exports: {} };
  vm.runInNewContext(transpile(read(file)), { module: m, exports: m.exports, require });
  return m.exports;
}
const linked = module("utils/linkedTransfers.ts");
const dates = module("utils/movementDates.ts", name => name.endsWith("linkedTransfers") ? linked : {});
function source(file) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node)) declarations.set(node.name.getText(tree), node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { tree, declarations };
}
const plain = value => JSON.parse(JSON.stringify(value));
const measurements = [];

// Una actualización de carga, una selección o abrir el código no deben
// reagrupar diez mil movimientos si no cambió la lista ni su filtro.
for (const file of ["screens/Family.tsx", "screens/Cajas.tsx", "screens/SharedBoxes.tsx"]) {
  const { declarations } = source(file);
  const names = ["visibles", "filasVisibles", "filasArchivadas"];
  const text = names.filter(name => declarations.has(name))
    .map(name => `globalThis.${name} = ${declarations.get(name).initializer.getText()};`).join("\n");
  let index = 0, builds = 0;
  const slots = [];
  const rows = Array.from({ length: 10_000 }, (_, id) => ({ id: String(id), tipo: id % 2 ? "ingreso" : "gasto",
    monto: 1, fecha: `2026-10-${String(1 + id % 28).padStart(2, "0")}`, creadoEn: id }));
  const original = JSON.stringify(rows);
  const scope = { ...linked, filter: null, movimientos: rows, movimientosOcultos: new Set(),
    movementRowsByDay: (...args) => { builds++; return dates.movementRowsByDay(...args); },
    useMemo: (build, deps) => {
      const slot = index++, previous = slots[slot];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) slots[slot] = { deps, value: build() };
      return slots[slot].value;
    } };
  const render = () => { index = 0; vm.runInNewContext(transpile(text), scope); };
  render();
  const first = scope.filasVisibles, once = builds;
  for (let i = 0; i < 20; i++) render();
  assert.equal(builds, once, `${file}: una actualización visual no repite el agrupado completo de 10.000 movimientos`);
  assert.equal(scope.filasVisibles, first, "conservar la misma lista permite reutilizar sus filas");
  scope.filter = "ingreso"; render();
  assert.equal(scope.visibles.length, 5_000); assert.ok(scope.filasVisibles.every(row => row.item.tipo === "ingreso"));
  scope.movimientosOcultos = new Set(["1"]); render();
  assert.equal(scope.filasVisibles.length, 4_999, "la ocultación pendiente sí se aplica inmediatamente");
  scope.movimientos = [...rows, { ...rows[1], id: "new" }]; render();
  assert.equal(scope.filasVisibles.length, 5_000, "una llegada real vuelve a calcular la presentación");
  assert.equal(JSON.stringify(rows), original, "presentación no modifica el historial financiero");
  measurements.push({ file, rendersWithoutChanges: 21, groupingBuilds: once, rows: rows.length });
}

// La consulta automática suele devolver objetos nuevos, aunque las cajas
// sean idénticas. No cambiar la referencia evita parar y abrir otra vez
// TODOS los oyentes de movimientos y volver a pintar las mismas tarjetas.
const { declarations, tree: boxesTree } = source("screens/Cajas.tsx");
let uid = "A", session = 1, writes = 0, renderedLists = 0, renderedBalances = 0;
const box = { id: "box", nombre: "Casa", currency: "PEN", ownerUid: "A", creadaEn: 10 };
const scope = { accountUid: "A", accountSession: 1, cuentaActual: () => uid === "A" && session === 1,
  compartidasActuales: { current: [box] }, saldosCompartidasActuales: { current: { box: 100 } },
  listaCompartidaCompleta: { current: true }, useCallback: callback => callback,
  leerCajasCompartidasEnMemoria: () => ({}),
  guardarCajasCompartidasEnMemoria: () => writes++, setRenderedCompartidas: () => renderedLists++, setRenderedSaldosCompartidas: () => renderedBalances++ };
for (const name of ["setCompartidas", "setSaldosCompartidas"]) {
  vm.runInNewContext(transpile(`globalThis.${name} = ${declarations.get(name).initializer.getText()};`), scope);
}
const originalList = scope.compartidasActuales.current;
let subscriptions = 0, stops = 0, subscriptionEffect;
function findSubscription(node) {
  if (ts.isCallExpression(node) && node.expression.getText(boxesTree) === "useEffect"
    && node.arguments[0]?.getText(boxesTree).includes("const stops = compartidas.map")) subscriptionEffect = node.arguments[0].getText(boxesTree);
  ts.forEachChild(node, findSubscription);
}
findSubscription(boxesTree); assert.ok(subscriptionEffect, "ejecuta la suscripción original de la lista");
Object.assign(scope, { lista: true, compartidaAbierta: null, verArchivadas: false, compartidas: originalList,
  escucharMovimientosCaja: () => { subscriptions++; return () => stops++; }, setErrorCompartidas() {} });
let cleanup = vm.runInNewContext(transpile(`(${subscriptionEffect})()`), scope);
for (let request = 0; request < 20; request++) {
  scope.setCompartidas([{ ...box }]);
  if (scope.compartidas !== scope.compartidasActuales.current) {
    cleanup(); scope.compartidas = scope.compartidasActuales.current;
    cleanup = vm.runInNewContext(transpile(`(${subscriptionEffect})()`), scope);
  }
}
assert.equal(subscriptions, 1, "veinte respuestas iguales no vuelven a descargar los movimientos de cada caja");
assert.equal(stops, 0, "no cortar una escucha que sigue siendo válida");
cleanup(); assert.equal(stops, 1, "salir sí cierra la escucha original");
scope.setCompartidas([{ ...box }]);
assert.equal(renderedLists, 0, "una lista idéntica no vuelve a suscribir sus movimientos");
assert.equal(scope.compartidasActuales.current, originalList);
scope.setSaldosCompartidas(previous => ({ ...previous, box: 100 }));
assert.equal(renderedBalances, 0, "una instantánea con el mismo saldo no redibuja las tarjetas");
assert.equal(writes, 0, "no volver a clonar la copia visual sin novedades");
for (const [key, value] of [["nombre", "Viaje"], ["currency", "USD"], ["ownerUid", "B"], ["creadaEn", 20]]) {
  scope.setCompartidas([{ ...box, [key]: value }]);
  assert.equal(scope.compartidasActuales.current[0][key], value, `${key} remoto sí se actualiza`);
}
scope.setCompartidas(previous => [...previous, { ...box, id: "other" }]);
assert.equal(scope.compartidasActuales.current.length, 2, "una caja nueva aparece");
scope.setCompartidas(previous => [...previous].reverse());
assert.equal(scope.compartidasActuales.current[0].id, "other", "se conserva el orden recibido");
scope.setSaldosCompartidas(() => ({ other: 0 }));
assert.deepEqual(plain(scope.saldosCompartidasActuales.current), { other: 0 }, "cero y saldo ausente no se confunden");
scope.setCompartidas([]); assert.equal(scope.compartidasActuales.current.length, 0, "un cierre real retira la tarjeta");
scope.leerCajasCompartidasEnMemoria = () => null;
const emptyWrites = writes;
scope.setCompartidas([]);
assert.equal(writes, emptyWrites + 1, "la primera lista vacía confirmada se recuerda para no mostrar Cargando al volver");
const before = [renderedLists, renderedBalances, writes];
for (const next of [() => { uid = "B"; }, () => { uid = "A"; session++; }]) {
  next(); scope.setCompartidas([box]); scope.setSaldosCompartidas(() => ({ box: 999 }));
  assert.deepEqual([renderedLists, renderedBalances, writes], before, "una cuenta/sesión vieja no cambia la copia visual");
}

// Ejecutar la fila original de Inicio, sin un temporizador de entrada por
// movimiento: al regresar no deben quedar filas transparentes hasta 630 ms.
const home = source("screens/Home.tsx");
const row = home.declarations.get("FilaMovimiento");
const elements = [];
const jsx = (type, props, ...children) => { const node = { type, props: props ?? {}, children }; elements.push(node); return node; };
const view = "View";
const rowScope = { memo: fn => fn, React: { Fragment: "Fragment" }, View: view, Animated: { View: "Animated.View" },
  FadeInDown: { delay: () => ({ duration: () => "delayed" }) },
  catInfo: () => ({ label: "category", icon: "icon", color: "green" }),
  PressableScale: "PressableScale", IconBadge: "IconBadge", Text: "Text", EtiquetaMetodo: "EtiquetaMetodo",
  ArrowRightLeft: "ArrowRightLeft", softShadow: {}, esFoto: () => false };
vm.runInNewContext(ts.transpile(`globalThis.row = ${row.initializer.getText()};`, {
  target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "jsx",
}), { ...rowScope, jsx, globalThis: rowScope });
rowScope.row({ tx: { id: 1, amount: 10, type: "income", description: "Ingreso", category: "otros" }, index: 7,
  selectMode: false, marcada: false, oscuro: false, fmt: String, t: key => key, onPress() {} });
assert.equal(elements.some(node => node.props.entering), false, "Inicio muestra las filas sin reiniciar ocho animaciones escalonadas");
console.log(JSON.stringify({ presentationOnly: true, measurements,
  unchangedListResponses: 20, movementSubscriptions: subscriptions,
  equalSharedListRenders: 0, equalSharedBalanceRenders: 0, noFinancialWrites: true,
  platformAndReactAdapted: true, notAnAndroidFPSBenchmark: true }));

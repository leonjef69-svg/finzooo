import assert from "node:assert/strict";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// JSX/algoritmos originales con React y callbacks adaptados; sin escribir datos.
const read = createSourceReader({ revision: process.env.FINO_DAY_ROWS_BASELINE ?? "" });
const current = createSourceReader({ revision: "", report: false });
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const t = key => key, fmt = value => `S/${value}`;
const animation = { delay() { return this; }, duration() { return this; } };
function compile(expression, env) {
  const code = ts.transpileModule(`return (${expression});`, { compilerOptions: {
    module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
  } }).outputText;
  return new Function("React", ...Object.keys(env), code)(React, ...Object.values(env));
}
function variable(file, name, env) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found; function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found ??= node; ts.forEachChild(node, visit); }
  visit(source); assert.ok(found?.initializer, file + ": " + name);
  return compile(found.initializer.getText(source), env);
}
function expand(node) {
  if (Array.isArray(node)) return node.flatMap(expand);
  if (!node || typeof node !== "object") return [];
  if (typeof node.type === "function") return expand(node.type({ ...node.props, children: node.children }));
  return [node, ...node.children.flatMap(expand)];
}
function texts(node) {
  if (Array.isArray(node)) return node.map(texts).join("|");
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  if (typeof node.type === "function") return texts(node.type({ ...node.props, children: node.children }));
  return texts(node.children);
}
const ui = { React, memo: fn => fn, View: "View", Text: "Text", PressableScale: "PressableScale",
  TouchableOpacity: "TouchableOpacity", IconBadge: "IconBadge", EtiquetaMetodo: "Method",
  CheckCircle2: "Check", Circle: "Circle", ArrowRightLeft: "Transfer", ArrowUp: "Up", ArrowDown: "Down",
  ContentReportButton: "Report", Pencil: "Pencil", Trash2: "Trash", SpaceTransferAmounts: "TransferAmounts",
  Animated: { View: "View" }, FadeInDown: animation, softShadow: {}, CARD_SHADOW: {},
  catInfo: () => ({ label: "category", icon: "Icon", color: "green" }), iconoDe: () => "Icon", esFoto: () => false,
  fmtDate: () => "14 oct.", monthNames: months, t, fmt, fmtFamilia: fmt, oscuro: false,
  useCallback: fn => fn, useMemo: fn => fn(),
};
const tx = { id: 1, type: "expense", amount: 10, category: "comida", date: "2026-10-14", time: "5:53 a.m.", method: "cash", description: "Prueba", notes: "" };
const HomeCard = handlerOriginal("screens/Home.tsx", "FilaMovimiento", ui, read("screens/Home.tsx"));
const card = HomeCard({ tx, index: 0, marcada: false, selectMode: false, oscuro: false, fmt, t, monthNames: months, onPress() {} });
assert.ok(!texts(card).includes("14 oct."), "la fecha ya no se repite dentro de la tarjeta original de Inicio");
assert.ok(texts(card).includes(tx.time));

function moduleOf(file, dependency) {
  const module = { exports: {} };
  const code = ts.transpileModule(current(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  new Function("React", "require", "module", "exports", code)(React, dependency, module, module.exports);
  return module.exports;
}
const linked = moduleOf("utils/linkedTransfers.ts", () => { throw Error("unexpected dependency"); });
const horaDe = handlerOriginal("utils/format.ts", "horaDe", {}, current("utils/format.ts"));
const minutes = handlerOriginal("utils/ordenarMovimientos.ts", "minutosDeHora", {}, current("utils/ordenarMovimientos.ts"));
const dates = moduleOf("utils/movementDates.ts", name => name.endsWith("linkedTransfers") ? linked : name.endsWith("format") ? { horaDe } : { minutosDeHora: minutes });
const Header = moduleOf("components/MovementDateHeader.tsx", name => name === "react-native" ? { Text: "Text" } : dates).default;
Object.assign(ui, linked, dates, { MovementDateHeader: Header, horaDe });
const rows = dates.movementRowsByDay([tx, { ...tx, id: 2 }, { ...tx, id: 3, date: "2026-10-13" }], item => item.date, items => linked.compactPersonalTransferRows(items));
const renderHome = variable("screens/Home.tsx", "dibujarFila", { ...ui, visibleRecentRows: rows, marcadas: new Set(), selectMode: false, colorScheme: "light", FilaMovimiento: HomeCard, alTocarFila() {} });
const rendered = rows.map((item, index) => renderHome({ item, index }));
assert.equal(expand(rendered).filter(node => node.props.accessibilityRole === "header").length, 2);
assert.equal(texts(rendered).split("14 octubre 2026").length - 1, 1);
assert.ok(texts(rendered).includes("13 octubre 2026"));

const transfer = (id, date, type, amount) => ({ ...tx, id, date, type, amount, internalTransfer: "box", internalTransferSpaceId: "box-a", time: id === 5 ? "5:00 a.m." : "6:00 a.m." });
const personal = [transfer(4, "2026-10-13", "expense", 20), transfer(5, "2026-10-14", "expense", 30), transfer(6, "2026-10-14", "income", 10)];
const dailyPersonal = dates.movementRowsByDay(personal, item => item.date, linked.compactPersonalTransferRows);
assert.equal(dailyPersonal.length, 2, "no mezcla transferencias de otros días");
assert.deepEqual(dailyPersonal.map(row => [row.item.date, row.transferGroup.sent, row.transferGroup.returned]), [["2026-10-14", 30, 10], ["2026-10-13", 20, 0]]);
assert.equal(dates.personalMovementRowTime(dailyPersonal[0]), "5:00 a.m. — 6:00 a.m.");
assert.equal(new Set(dailyPersonal.map(row => row.key)).size, 2);
const space = [
  { id: "old", fecha: "2026-10-13", creadoEn: 1000, tipo: "ingreso", monto: 20, personalTransactionId: 4 },
  { id: "new", fecha: "2026-10-14", creadoEn: 3000, tipo: "ingreso", monto: 30, personalTransactionId: 5 },
  { id: "return", fecha: "2026-10-14", creadoEn: 4000, tipo: "gasto", monto: 10, personalReturnAmount: 10 },
  { id: "cash", fecha: "2026-10-14", creadoEn: 2000, tipo: "ingreso", monto: 5, descripcion: "Dinero", method: "cash" },
];
const before = structuredClone(space);
const grouped = dates.movementRowsByDay(space, item => item.fecha, linked.compactLinkedTransferRows);
assert.deepEqual(linked.movementIdsForCompactRow(grouped[0], space), ["new", "return"], "seleccionar solo incluye enlaces de ese día");
assert.equal(linked.countSelectedCompactRows(grouped, space, ["new", "return"]), 1);
assert.equal(linked.countSelectedCompactRows(grouped, space, ["new", "return", "old"]), 2);
assert.deepEqual(space, before, "sin cambios en importes, fechas o instantes");

for (const file of ["screens/Family.tsx", "screens/Cajas.tsx", "screens/SharedBoxes.tsx"]) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let map; function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(source) === "filasVisibles.slice(0, movementLimit).map") map ??= node; ts.forEachChild(node, visit); }
  visit(source); assert.ok(map);
  let selected = [];
  const env = { ...ui, filasVisibles: grouped, movementLimit: 60, visibles: space,
    seleccionando: true, seleccionados: selected, familia: { id: "family", nombre: "Familia" }, caja: { id: "box", nombre: "Caja" },
    transferLedger: { allocationsByContributionId: new Map() }, uid: "user", owner: false, busy: false, puedeEditarAporte: false, puedeBorrar: false,
    setSeleccionados: fn => { selected = fn(selected); }, methodLabel: () => "Efectivo" };
  const node = compile(map.getText(source), env);
  assert.equal(expand(node).filter(item => item.props.accessibilityRole === "header").length, 2, file + ": encabezados diarios reales");
  assert.ok(!texts(node).includes("2026-10-14"), file + ": sin ISO dentro de tarjeta");
  if (!file.endsWith("SharedBoxes.tsx")) {
    const button = expand(node).find(item => item.type === "TouchableOpacity" && item.props.disabled === false);
    button.props.onPress(); assert.deepEqual(selected, ["new", "return"], file + ": selección real del grupo");
  }
}
const HistoryCard = handlerOriginal("screens/History.tsx", "Fila", ui, read("screens/History.tsx"));
assert.ok(!texts(HistoryCard({ tx, t, fmt, oscuro: false, monthNames: months, onOpenDetail() {}, onOpenTransferGroup() {} })).includes("14 oct."));
const historyEnv = { ...ui, allMonthTx: [...personal, tx], transactions: [...personal, tx], filter: "all", search: "", categoryFilter: "", minAmount: "", maxAmount: "", parsedMinAmount: 0, parsedMaxAmount: 0,
  compararMovimientos: (a, b) => b.date.localeCompare(a.date), methodLabel: () => "Efectivo" };
const historyRows = variable("screens/History.tsx", "renglones", historyEnv);
assert.equal(historyRows.filter(row => row.tipo === "fecha").length, 2);
assert.equal(new Set(historyRows.map(row => row.clave)).size, historyRows.length);
assert.equal(variable("screens/History.tsx", "renglones", { ...historyEnv, filter: "expense" }).filter(row => row.tipo === "fila").length, 1, "filtros de gasto no incluyen transferencias");
assert.equal(variable("screens/History.tsx", "renglones", { ...historyEnv, search: "Prueba" }).filter(row => row.tipo === "fila").length, 3, "buscar conserva las filas y sus días");
function mapExpression(file, expression, env) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found; function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(source) === expression) found ??= node; ts.forEachChild(node, visit); }
  visit(source); assert.ok(found, file + ": lista"); return compile(found.getText(source), env);
}
const archivedRows = dates.movementRowsByDay(space, item => item.fecha, items => items.map(item => ({ key: item.id, item })));
const archived = mapExpression("screens/Cajas.tsx", "filasArchivadas.slice(0, movementLimit).map", { ...ui, filasArchivadas: archivedRows, movementLimit: 60 });
assert.equal(expand(archived).filter(node => node.props.accessibilityRole === "header").length, 2, "archivo solo lectura también agrupado");
const businessItems = [{ id: "new", fecha: "2026-10-14", hora: "06:30", clase: "ingreso", monto: 5, metodo: "cash" }, { id: "old", fecha: "2026-10-13", hora: "03:20", clase: "gasto", monto: 2, metodo: "cash" }];
const business = mapExpression("screens/PanelNegocio.tsx", "historial.map", { ...ui, historial: businessItems, negocio: { nombre: "Prueba" }, borrando: null, soloLectura: true, dinero: fmt, horaVisible: time => time,
  Store: "Store", TrendingUp: "Up", TrendingDown: "Down", ShoppingBag: "Bag" });
assert.equal(expand(business).filter(node => node.props.accessibilityRole === "header").length, 2, "negocio mantiene el mismo patrón");
assert.ok(texts(business).includes("06:30") && !texts(business).includes("14 oct."));
assert.equal(dates.movementDayLabel("2026-02-31", months), "2026-02-31");
assert.equal(dates.movementDayLabel("2024-02-29", months), "29 febrero 2024");
assert.deepEqual(dates.movementRowsByDay([], item => item.date, linked.compactPersonalTransferRows), []);
const many = Array.from({ length: 10000 }, (_, index) => ({ ...tx, id: index + 1, date: index < 60 ? "2026-10-14" : "2026-10-13" }));
const manyRows = dates.movementRowsByDay(many, item => item.date, linked.compactPersonalTransferRows);
assert.equal(manyRows.length, 10000);
assert.equal(dates.startsMovementDay(manyRows, 60, row => row.item.date), true, "límite de carga conserva el encabezado del siguiente día");
assert.equal(dates.startsMovementDay(manyRows, 61, row => row.item.date), false);
console.log("Listas originales: encabezados diarios, horas guardadas, filtros/búsqueda, transferencias sin mezclar días, selección por día y 10.000 filas preservadas. React/Android adaptados; no escribe en nube ni cuenta real.");

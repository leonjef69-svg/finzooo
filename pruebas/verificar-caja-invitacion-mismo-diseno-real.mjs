import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const revision = process.env.FINO_TEST_BOX_CONTINUITY_BASELINE;
if (revision && !/^[a-f0-9]{7,40}$/.test(revision)) throw Error("Hash inválido");
const file = "screens/SharedBoxes.tsx";
const text = revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "SharedBoxesForAccount");
const renderCode = component.body.statements.findLast(ts.isReturnStatement).expression.getText(tree);
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const ui = Object.fromEntries(["View", "Text", "ScrollView", "TouchableOpacity", "TextInput", "BackButton", "SpaceSwitcher", "ActivityIndicator", "LegalAcceptancePanel", "MovementAllButton", "SpaceOverviewTotals", "SpaceInvitationSheet", "SpaceMembersSheet", "SpacePaymentMethod", "ArrowLeftRight", "UsersRound", "UserPlus", "Pencil", "Plus", "X", "Check", "RefreshCw", "ListChecks", "ArrowUp", "ArrowDown", "Trash2", "LogOut", "ArrowRightLeft", "ContentReportButton", "SpaceTransferAmounts", "MovementDateHeader"].map(name => [name, name]));
const source = ts.transpileModule(`globalThis.render=()=>(${renderCode});`, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React,
} }).outputText;
function flatten(value) {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value == null || typeof value !== "object") return [];
  return [value, ...value.children.flatMap(flatten)];
}
function labels(value) {
  if (Array.isArray(value)) return value.flatMap(labels);
  if (value == null || typeof value === "boolean") return [];
  return typeof value === "object" ? value.children.flatMap(labels) : [String(value)];
}
const changes = [], original = { id: "shared", nombre: "Caja de prueba aislada", currency: "PEN", ownerUid: "A" };
const ledger = { exports: {} };
vm.runInNewContext(ts.transpile(fs.readFileSync("utils/linkedTransfers.ts", "utf8"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), { module: ledger, exports: ledger.exports });
const movements = [
  { id: "aporte", tipo: "ingreso", monto: 100, personalTransactionId: 1, personalOwnerUid: "A", creadoPor: "A", descripcion: "Aporte", fecha: "2026-10-15" },
  { id: "gasto", tipo: "gasto", monto: 25, creadoPor: "A", descripcion: "Comida", fecha: "2026-10-15" },
];
const s = { ...ui, React, insets: { top: 0, bottom: 0 }, busy: false, t: key => key, caja: original, uid: "A", owner: true,
  cajas: [original], cajasOcultas: new Set(), onAllBoxes() {}, cargandoCaja: false, errorCargaCaja: false,
  editandoNombreCaja: false, saldo: ledger.exports.balanceOfSpace(movements), devolvibleAPersonal: ledger.exports.returnableToPersonal(movements, "A"), ingresos: 0, gastos: 25, filter: null,
  recentMovementTypes: { income: false, expense: true }, seleccionando: false, modo: null,
  filasVisibles: ledger.exports.compactLinkedTransferRows(movements),
  isLinkedSpaceTransfer: ledger.exports.isLinkedSpaceTransfer, isLinkedSpaceReturn: ledger.exports.isLinkedSpaceReturn,
  startsMovementDay: () => true, monthNames: [], linkedMovementRowTime: () => "10:03 p.m.", methodLabel: () => "Efectivo",
  borrar: item => changes.push(["delete", item.id]),
  cajaLista: true, movementLimit: 60, miembros: [{ uid: "A", nombre: "Dueño", rol: "owner" }], verMiembros: false,
  invitacion: "", fmt: value => `S/ ${value}`, volverACajas() {}, setSubscriptionRevision() {},
  setVerMiembros() {}, invitar() {}, setNombreCajaEditado() {}, setEditandoNombreCaja() {},
  devolverAPersonal: () => changes.push("return"), cerrar: () => changes.push("close"),
  limpiar: () => changes.push("clean"), setModo: value => { s.modo = value; }, setEditandoAporteId: value => changes.push(["edit", value]),
  setFilter() {}, setSeleccionando: update => { s.seleccionando = update(s.seleccionando); }, setInvitacion: value => { s.invitacion = value; },
  quitar() {}, salir() {}, setMovementLimit() {},
};
s.boton = (label, action) => React.createElement("TouchableOpacity", { onPress: action }, label);
vm.runInNewContext(source, s);
const first = s.render(), nodes = flatten(first);
const add = nodes.find(node => node.type === "TouchableOpacity" && labels(node).includes("boxes.addMoney"));
assert.ok(add, "al compartir debe conservar Agregar dinero; no regresar al sistema antiguo Ingreso/Gasto");
const close = nodes.find(node => node.type === "TouchableOpacity" && node.props.accessibilityLabel === "boxes.close");
assert.ok(close); assert.deepEqual(JSON.parse(JSON.stringify(close.props.style)), { width: "48%", height: 40 });
assert.ok(!labels(first).includes("boxes.income") && !labels(first).includes("boxes.expense"), "los dos botones antiguos no se dibujan de fondo");
const returned = nodes.find(node => node.type === "TouchableOpacity" && labels(node).includes("boxes.returnAmount"));
assert.ok(nodes.indexOf(returned) < nodes.indexOf(add));
const totals = nodes.find(node => node.type === "SpaceOverviewTotals");
assert.ok(nodes.indexOf(add) < nodes.indexOf(totals), "devuelve → agrega/cierra → totales, igual que antes de Invitar");
assert.ok(nodes.some(node => node.type === "MovementAllButton"));
assert.ok(nodes.some(node => node.props.accessibilityLabel === "boxes.selectMovements"));
const before = labels(first);
assert.ok(!nodes.some(node => node.type === "ContentReportButton" && node.props.target?.targetType === "movement"), "las acciones no ensucian la tarjeta normal");
assert.ok(nodes.some(node => node.type === "Text" && node.props.className?.includes("text-rose-600") && labels(node).join("").includes("25")), "el gasto no aparece verde");
s.invitacion = "ABCD2345"; const invitation = s.render();
assert.deepEqual(labels(invitation), before, "abrir el código no cambia el contenido de fondo");
const sheet = flatten(invitation).find(node => node.type === "SpaceInvitationSheet");
assert.equal(sheet.props.visible, true); assert.equal(sheet.props.code, "ABCD2345");
sheet.props.onClose(); assert.equal(s.invitacion, ""); assert.equal(s.caja, original);
assert.deepEqual(labels(s.render()), before); assert.deepEqual(changes, [], "ver/cerrar el código no ejecuta dinero/cierre");
const select = nodes.find(node => node.props.accessibilityLabel === "boxes.selectMovements");
select.props.onPress(); assert.equal(s.seleccionando, true);
assert.ok(flatten(s.render()).some(node => node.props.accessibilityLabel === "common.delete"), "Seleccionar conserva acceso al borrado permitido");
assert.ok(flatten(s.render()).some(node => node.type === "ContentReportButton"), "Seleccionar conserva denuncias y moderación");
add.props.onPress(); assert.equal(s.modo, "ingreso"); assert.deepEqual(changes, ["clean", ["edit", null]]);
s.modo = null; close.props.onPress(); assert.equal(changes.at(-1), "close");
s.owner = false;
assert.ok(!flatten(s.render()).some(node => node.props.accessibilityLabel === "boxes.close"), "no dar permisos de cierre a un invitado");
console.log("JSX original compartido: conserva Agregar/Cerrar, devolución/totales/filas modernas, abre/cierra solo el código y mantiene permisos/acciones. No mueve dinero real.");

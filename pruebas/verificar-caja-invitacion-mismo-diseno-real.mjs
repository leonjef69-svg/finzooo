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
const ui = Object.fromEntries(["View", "Text", "ScrollView", "TouchableOpacity", "TextInput", "BackButton", "SpaceSwitcher", "ActivityIndicator", "LegalAcceptancePanel", "MovementAllButton", "SpaceOverviewTotals", "SpaceMovementSheet", "SpaceInvitationSheet", "SpaceMembersSheet", "SpacePaymentMethod", "ArrowLeftRight", "UsersRound", "UserPlus", "Pencil", "Plus", "X", "Check", "RefreshCw", "ListChecks", "ArrowUp", "ArrowDown", "Trash2", "LogOut", "ArrowRightLeft", "ContentReportButton", "SpaceTransferAmounts", "MovementDateHeader"].map(name => [name, name]));
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
  cajas: [original], cajasOcultas: new Set(), onAllBoxes() {}, cargandoCaja: false, errorCargaCaja: false, nombreCajaEditado: original.nombre,
  editandoNombreCaja: false, saldo: ledger.exports.balanceOfSpace(movements), devolvibleAPersonal: ledger.exports.returnableToPersonal(movements, "A"), ingresos: 0, gastos: 25, filter: null,
  recentMovementTypes: { income: false, expense: true }, seleccionando: false, modo: null,
  modoSuspendido: { current: null },
  invitacionVisible: false, preparandoInvitacion: false, nombre: "", monto: "", method: "cash", moneda: "PEN", userCurrency: "PEN",
  category: "salario", movementDate: "2026-10-16", notes: "", origenDinero: "externo", saldoPersonalEn: () => 100,
  currencySymbolFor: () => "S/", formatAmount: amount => `S/ ${amount}`,
  setNombre() {}, setMonto() {}, setMethod() {}, setCategory: value => { s.category = value; }, setMovementDate() {}, setNotes() {}, setOrigenDinero() {}, guardar() {},
  setInvitacionVisible: value => { s.invitacionVisible = value; }, setPreparandoInvitacion: value => { s.preparandoInvitacion = value; },
  filasVisibles: ledger.exports.compactLinkedTransferRows(movements),
  isLinkedSpaceTransfer: ledger.exports.isLinkedSpaceTransfer, isLinkedSpaceReturn: ledger.exports.isLinkedSpaceReturn,
  startsMovementDay: () => true, monthNames: [], linkedMovementRowTime: () => "10:03 p.m.", methodLabel: () => "Efectivo",
  borrar: item => changes.push(["delete", item.id]),
  cajaLista: true, movementLimit: 60, miembros: [{ uid: "A", nombre: "Dueño", rol: "owner" }], verMiembros: false, editandoNombreCaja: false,
  invitacion: "", fmt: value => `S/ ${value}`, volverACajas() {}, setSubscriptionRevision() {},
  setVerMiembros() {}, invitar() {}, guardarNombreCaja() {}, setNombreCajaEditado: value => { s.nombreCajaEditado = value; }, setEditandoNombreCaja: value => { s.editandoNombreCaja = value; },
  devolverAPersonal: () => changes.push("return"), cerrar: () => changes.push("close"),
  limpiar: () => { s.modoSuspendido.current = null; changes.push("clean"); s.modo = null; s.nombre = ""; s.monto = ""; s.codigo = ""; }, setModo: value => { s.modo = value; }, setEditandoAporteId: value => { s.editandoAporteId = value; },
  setFilter() {}, setSeleccionando: update => { s.seleccionando = typeof update === "function" ? update(s.seleccionando) : update; }, setInvitacion: value => { s.invitacion = value; },
  quitar() {}, salir() {}, setMovementLimit() {},
};
s.boton = (label, action) => React.createElement("TouchableOpacity", { onPress: action }, label);
vm.runInNewContext(source, s);
const inviteDeclaration = component.body.statements.find(node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === "invitar"));
const inviteInitializer = inviteDeclaration.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === "invitar").initializer.getText(tree);
vm.runInNewContext(ts.transpileModule(`globalThis.invokeInvite = ${inviteInitializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, s);
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
assert.ok(nodes.some(node => node.props.accessibilityLabel === "boxes.editName"), "el lápiz sigue disponible en el detalle normal");
s.isPremium = true; s.uid = "A"; s.caja = original; s.owner = true;
s.ejecutar = action => { s.busy = true; return action(async work => work()).finally(() => { s.busy = false; }); };
s.modo = "ingreso"; s.nombre = "borrador"; s.monto = "15"; s.editandoNombreCaja = true; s.nombreCajaEditado = "Nombre pendiente"; s.seleccionando = true;
let finishInvite;
s.crearInvitacionCaja = () => new Promise(resolve => { finishInvite = resolve; });
const pendingInvite = s.invokeInvite();
const waitingSheet = flatten(s.render()).find(node => node.type === "SpaceInvitationSheet");
assert.equal(waitingSheet.props.visible, true, "Invitar abre su hoja desde el toque, sin esperar ni cambiar de pantalla");
assert.equal(waitingSheet.props.loading, true); assert.equal(waitingSheet.props.code, "");
assert.equal(s.modo, null, "al terminar la invitación se oculta el formulario que quedó abierto");
assert.equal(s.modoSuspendido.current, "ingreso"); assert.equal(s.nombre, "borrador"); assert.equal(s.monto, "15", "el borrador no se pierde");
assert.equal(s.editandoNombreCaja, false); assert.equal(s.seleccionando, false);
assert.equal(s.nombreCajaEditado, "Nombre pendiente", "el nombre escrito no se descarta al invitar");
assert.ok(!labels(s.render()).includes("boxes.income") && !flatten(s.render()).some(node => node.props.accessibilityLabel === "boxes.editName"), "también se oculta mientras espera la red");
finishInvite("ABCD2345"); await pendingInvite;
assert.equal(s.invitacion, "ABCD2345");
changes.length = 0;
const invitation = s.render();
assert.deepEqual(labels(invitation), before.filter(label => label !== "boxes.editName"), "el código no deja formulario ni lápiz abiertos de fondo");
const sheet = flatten(invitation).find(node => node.type === "SpaceInvitationSheet");
assert.equal(sheet.props.visible, true); assert.equal(sheet.props.code, "ABCD2345");
sheet.props.onClose(); assert.equal(s.invitacion, ""); assert.equal(s.caja, original);
assert.deepEqual(labels(s.render()), before.filter(label => label !== "boxes.income" && label !== "boxes.expense"));
assert.deepEqual(changes, [], "ver/cerrar el código no ejecuta dinero/cierre");
const rename = flatten(s.render()).find(node => node.props.accessibilityLabel === "boxes.editName");
rename.props.onPress(); assert.equal(s.nombreCajaEditado, "Nombre pendiente", "Editar nombre recupera el borrador oculto");
const select = nodes.find(node => node.props.accessibilityLabel === "boxes.selectMovements");
select.props.onPress(); assert.equal(s.seleccionando, true);
assert.ok(flatten(s.render()).some(node => node.props.accessibilityLabel === "common.delete"), "Seleccionar conserva acceso al borrado permitido");
assert.ok(flatten(s.render()).some(node => node.type === "ContentReportButton"), "Seleccionar conserva denuncias y moderación");
add.props.onPress(); assert.equal(s.modo, "ingreso"); assert.equal(s.nombre, "borrador"); assert.equal(s.monto, "15", "Agregar dinero recupera el borrador suspendido");
const modernForm = flatten(s.render()).find(node => node.type === "SpaceMovementSheet");
assert.ok(modernForm?.props.visible, "Agregar dinero compartida debe abrir la misma hoja actual de Familia/Caja privada");
assert.equal(modernForm.props.amount, "15"); assert.equal(modernForm.props.description, "borrador");
assert.equal(modernForm.props.date, "2026-10-16"); assert.equal(modernForm.props.category, "salario");
assert.equal(modernForm.props.origin, "externo");
assert.ok(!flatten(s.render()).some(node => node.type === "TextInput" && node.props.placeholder === "boxes.description"), "no queda el formulario antiguo intercalado en el historial");
modernForm.props.onType("gasto"); assert.equal(s.modo, "gasto"); assert.equal(s.category, "otros");
s.modo = null; close.props.onPress(); assert.equal(changes.at(-1), "close");
s.owner = true; s.modo = "gasto"; s.nombre = "borrador pendiente"; s.monto = "20";
s.crearInvitacionCaja = async () => { throw Error("offline"); };
await assert.rejects(s.invokeInvite(), /offline/);
assert.equal(s.modo, null, "si falla el código no reaparece el formulario antiguo");
assert.equal(s.invitacionVisible, false); assert.equal(s.preparandoInvitacion, false);
assert.equal(s.modoSuspendido.current, "gasto"); assert.equal(s.nombre, "borrador pendiente"); assert.equal(s.monto, "20");
s.modoSuspendido.current = null;
s.owner = false;
assert.ok(!flatten(s.render()).some(node => node.props.accessibilityLabel === "boxes.close"), "no dar permisos de cierre a un invitado");
console.log("JSX original compartido: conserva Agregar/Cerrar, devolución/totales/filas modernas, abre/cierra solo el código y mantiene permisos/acciones. No mueve dinero real.");

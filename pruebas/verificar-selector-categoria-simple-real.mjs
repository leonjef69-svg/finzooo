import assert from "node:assert/strict";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Ejecuta el selector original; React/Android/fotos/datos adaptados, sin cambios reales.
const read = createSourceReader({ revision: process.env.FINO_CATEGORY_SIMPLE_BASELINE ?? "" });
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
let state = [], cursor = 0;
const selected = [], created = [];
let closed = 0, dismissed = 0;
const deps = {
  React, View: "View", Text: "Text", TouchableOpacity: "TouchableOpacity", ScrollView: "ScrollView",
  TextInput: "TextInput", Image: "Image", Camera: "Camera", Check: "Check", ImagePlus: "ImagePlus",
  Pencil: "Pencil", Plus: "Plus", X: "X", CategoryAvatar: "Avatar", ImageCropper: "Cropper",
  useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
  useMemo: fn => fn(), useEffect() {}, useSafeAreaInsets: () => ({ bottom: 0 }),
  useAppData: () => ({ t: key => key, categoriasPropias: [], crearCategoria: data => { created.push(data); return "new-id"; }, showToast() {} }),
  sanitizeName: value => value.trim(), nombreRepetido: () => false,
  Keyboard: { dismiss: () => { dismissed++; }, isVisible: () => false },
  BackHandler: { addEventListener: () => ({ remove() {} }) }, ImagePicker: {},
};
const renderOriginal = handlerOriginal("components/TransactionCategorySheet.tsx", "TransactionCategorySheet", deps, read("components/TransactionCategorySheet.tsx"));
function render(type = "expense") {
  cursor = 0;
  return renderOriginal({ type, categories: [{ id: "comida", label: "food" }, { id: "otros", label: "other" }], selectedId: "comida",
    onClose: () => { closed++; }, onSelect: id => selected.push(id), onManage: () => { throw Error("acceso retirado"); } });
}
function nodes(node) { return Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...node.children.flatMap(nodes)] : []; }
function text(node) { return Array.isArray(node) ? node.map(text).join("|") : node && typeof node === "object" ? text(node.children) : node == null || typeof node === "boolean" ? "" : String(node); }
const selector = render();
assert.ok(!text(selector).includes("catCustom.rowLabel"), "el botón Personalizar categorías ya no aparece, incluso si llega el callback antiguo");
const newButton = nodes(selector).find(node => node.type === "TouchableOpacity" && text(node).includes("nuevaCat.title"));
assert.ok(newButton, "Nueva categoría se conserva");
assert.ok(newButton.props.className.includes("flex-1"), "el único botón aprovecha el ancho");
nodes(selector).find(node => node.type === "TouchableOpacity" && text(node).includes("food")).props.onPress();
assert.deepEqual(selected, ["comida"], "elegir una categoría mantiene su identificador");
nodes(selector).find(node => node.props.accessibilityLabel === "common.close").props.onPress();
assert.equal(closed, 1);
newButton.props.onPress();
let form = render();
assert.ok(text(form).includes("nuevaCat.title"), "abre el formulario dentro de la misma hoja");
nodes(form).find(node => node.type === "TextInput").props.onChangeText("Nueva de prueba");
form = render();
const save = nodes(form).find(node => node.type === "TouchableOpacity" && text(node).includes("common.save"));
assert.equal(save.props.disabled, false); save.props.onPress();
assert.equal(created[0].nombre, "Nueva de prueba");
assert.equal(created[0].tipo, "expense");
assert.deepEqual(selected, ["comida", "new-id"]);
assert.ok(dismissed > 0);
state = []; assert.ok(!text(render("income")).includes("catCustom.rowLabel"), "ingresos tampoco recupera el acceso retirado");

// Comprueba el JSX original del formulario que se abre desde Inicio.
const source = ts.createSourceFile("screens/AddSheet.tsx", read("screens/AddSheet.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let sheet; function visit(node) { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "TransactionCategorySheet") sheet = node; ts.forEachChild(node, visit); }
visit(source); assert.ok(sheet);
assert.ok(!sheet.attributes.properties.some(prop => prop.name?.getText(source) === "onManage"), "Inicio no envía el acceso retirado");
assert.ok(sheet.attributes.properties.some(prop => prop.name?.getText(source) === "onSelect"), "Inicio conserva selección");
console.log("Selector original: sin Personalizar, Nueva categoría a todo el ancho, elección/cierre/creación dentro de la hoja conservados para gasto/ingreso. React/Android adaptados, sin categorías reales creadas.");

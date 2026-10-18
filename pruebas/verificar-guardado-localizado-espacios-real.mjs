import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
const jsx = (type, props) => ({ type, props: props ?? {} });
const ui = new Proxy({}, { get: (_target, key) => key === "useWindowDimensions" ? () => ({ height: 800 }) : key });
function component(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(read(file), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }), {
    module, exports: module.exports, require: name => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return { useState: () => [false, () => {}] };
      if (name === "react-native") return { ...ui, ...Object.fromEntries(["View", "Text", "TouchableOpacity", "TextInput", "Pressable", "ScrollView", "KeyboardAvoidingView", "ActivityIndicator"].map(key => [key, key])), Platform: { OS: "android" }, useWindowDimensions: () => ({ height: 800 }) };
      if (name === "lucide-react-native") return ui;
      if (name.endsWith("AppDataContext")) return { useAppData: () => ({ t: key => key, userCountry: "PE" }) };
      if (name.endsWith("countries")) return { COUNTRIES: [] };
      if (name.endsWith("currencies")) return { currencySymbolFor: () => "S/" };
      if (name.endsWith("categories")) return { ingresosDisponibles: () => [], gastosDisponibles: () => [], catInfo: () => ({ label: "cat" }) };
      return { default: name.split("/").at(-1) };
    },
  });
  return module.exports.default;
}
function flatten(node) { return !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)]; }
const Sheet = component("components/SpaceMovementSheet.tsx"), Fields = component("components/SpaceMovementFields.tsx");
for (const saving of [true, false]) {
  let closed = 0;
  const tree = Sheet({ visible: true, type: "ingreso", saving, disabled: saving, currency: "PEN", onClose: () => closed++ });
  const nodes = flatten(tree), save = nodes.find(node => node.type === "TouchableOpacity" && ["common.save", "common.saving"].includes(node.props.accessibilityLabel));
  assert.equal(flatten(save).some(node => node.type === "ActivityIndicator"), saving, "indicador real dentro de Guardar");
  assert.equal(save.props.accessibilityState?.busy, saving, "Guardar identifica su propio trabajo, sin esperar un indicador de otra pantalla");
  assert.equal(save.props.disabled, saving);
  assert.equal(nodes.find(node => node.type === "Pressable").props.disabled, saving);
  tree.props.onRequestClose(); assert.equal(closed, saving ? 0 : 1, "Atrás no cierra una confirmación pendiente");
  const fields = nodes.find(node => node.type === "SpaceMovementFields"); assert.equal(fields.props.disabled, saving);
  const renderedFields = flatten(Fields({ ...fields.props, category: "otros" }));
  assert.equal(renderedFields.find(node => node.type === "TouchableOpacity").props.disabled, saving);
  assert.ok(renderedFields.filter(node => node.type === "TextInput").every(node => node.props.editable === !saving));
}
// Un bloqueo por fuente todavía no confirmada NO se anuncia como un guardado.
const unavailable = flatten(Sheet({ visible: true, type: "ingreso", disabled: true, currency: "PEN" }));
assert.equal(unavailable.find(node => node.props.accessibilityLabel === "common.save").props.accessibilityState.busy, false);
for (const [file, flag] of [["screens/Family.tsx", "ocupado"], ["screens/Cajas.tsx", "guardando"], ["screens/SharedBoxes.tsx", "busy"]]) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let sheet;
  function visit(node) { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "SpaceMovementSheet") sheet = node; ts.forEachChild(node, visit); }
  visit(tree); assert.ok(sheet);
  const expression = sheet.attributes.properties.find(prop => prop.name?.text === "saving")?.initializer?.expression;
  assert.equal(expression?.getText(tree), flag, `${file}: usa el bloqueo real de la operación`);
}
{
  const file = "screens/Cajas.tsx", tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let indicator;
  function visit(node) {
    if (!indicator && ts.isConditionalExpression(node) && ts.isJsxSelfClosingElement(node.whenTrue)
      && node.whenTrue.tagName.getText(tree) === "ActivityIndicator") indicator = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(indicator);
  const run = scope => vm.runInNewContext(indicator.condition.getText(tree), scope);
  const s = { guardando: true, anotando: "ingreso", compartiendo: false, cargandoUnion: false, actualizandoListaCompartida: false, invitacionPrivadaVisible: false };
  assert.equal(run(s), false, "guardar en la hoja no simula una actualización general de Cajas");
  assert.equal(run({ ...s, anotando: null }), true, "operaciones fuera de la hoja conservan su indicador");
  assert.equal(run({ ...s, guardando: false, actualizandoListaCompartida: true }), true, "Actualizar voluntario sigue mostrando trabajo real");
}
console.log("Formulario original: indicador en Guardar, bloqueo de doble toque/cierre/campos durante confirmación y conexión a Familia/Cajas; React/Android adaptados, sin operaciones reales.");

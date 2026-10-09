import assert from "node:assert/strict";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
const compiled = ts.transpile(read("constants/i18n.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const i18n = { exports: {} };
new Function("exports", compiled)(i18n.exports);
const { translations } = i18n.exports;
const fileNames = [
  "components/ImageCropper.tsx", "components/PdfPreview.tsx", "components/RecortarBoleta.tsx",
  "screens/AppLockSettings.tsx", "screens/CalendarioPagos.tsx", "screens/CategoryCustomize.tsx",
  "screens/DuplicateReview.tsx", "screens/ExportPdfSheet.tsx", "screens/GoalFormSheet.tsx",
  "screens/GoalPickerSheet.tsx", "screens/History.tsx", "screens/Home.tsx", "screens/ImportSheet.tsx",
  "screens/MoveMoneySheet.tsx", "screens/Negocios.tsx", "screens/NuevaCategoria.tsx", "screens/NuevaVenta.tsx",
  "screens/NuevoPagoProgramado.tsx", "screens/PanelNegocio.tsx", "screens/Premium.tsx", "screens/Productos.tsx",
  "screens/SavingsDetail.tsx", "screens/SavingsList.tsx", "screens/ScanReceipt.tsx", "screens/ScheduledExportSettings.tsx",
  "screens/Settings.tsx", "screens/VoiceEntry.tsx", "screens/AddChooser.tsx", "screens/AddSheet.tsx",
];
const cache = new Map();
function ast(file) {
  if (!cache.has(file)) cache.set(file, ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  return cache.get(file);
}
for (const file of fileNames) {
  const source = ast(file);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute).map(attr => attr.name.getText(source));
      assert.equal(new Set(attrs).size, attrs.length, file + ": sin atributos duplicados");
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t"
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith("accessibility.")) {
      for (const lang of ["es", "en", "pt"]) assert.ok(translations[lang][node.arguments[0].text], lang + ": " + node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
function originalButton(file, press, dependencies, icon = null) {
  const source = ast(file), found = [];
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === "TouchableOpacity") {
      const action = node.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === "onPress");
      const iconMatches = !icon || ts.isJsxElement(node.parent) && node.parent.children.some(child =>
        ts.isJsxSelfClosingElement(child) && child.tagName.getText(source) === icon);
      if (iconMatches && action?.initializer && action.initializer.getText(source).includes(press)) found.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(found.length, 1, file + ": selector único para " + press);
  const props = {};
  for (const attr of found[0].attributes.properties.filter(ts.isJsxAttribute)) {
    const name = attr.name.getText(source);
    if (!["accessibilityLabel", "accessibilityRole", "accessibilityState", "onPress"].includes(name)) continue;
    const expression = ts.isJsxExpression(attr.initializer) ? attr.initializer.expression?.getText(source) : attr.initializer?.getText(source);
    if (!expression) continue;
    const code = ts.transpile("result = (" + expression + ");", { target: ts.ScriptTarget.ES2022 });
    props[name] = new Function(...Object.keys(dependencies), "let result; " + code + "; return result;")(...Object.values(dependencies));
  }
  assert.ok(props.accessibilityLabel, file + ": acción identificada");
  assert.ok(props.accessibilityRole, file + ": rol identificado");
  return props;
}
for (const lang of ["es", "en", "pt"]) {
  const t = (key, params = {}) => {
    assert.ok(translations[lang][key], lang + ": falta traducción " + key);
    return translations[lang][key].replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
  };
  let action = null;
  const save = originalButton("screens/Home.tsx", "saveBudgetInline", { t, saveBudgetInline: () => { action = "saved"; } });
  assert.equal(save.accessibilityLabel, t("common.save")); save.onPress(); assert.equal(action, "saved");
  for (const [file, needle, deps, expected, operation] of [
    ["screens/Productos.tsx", "abrirEdicion(p)", { p: { id: "p" }, abrirEdicion: value => { action = "edit:" + value.id; } }, "common.edit", "edit:p"],
    ["screens/Productos.tsx", "setBorrando(p.id)", { p: { id: "p" }, setBorrando: value => { action = "delete:" + value; } }, "common.delete", "delete:p"],
    ["screens/Negocios.tsx", "setBorrando(n.id)", { n: { id: "n" }, setBorrando: value => { action = "delete:" + value; } }, "common.delete", "delete:n"],
    ["screens/ExportPdfSheet.tsx", "editarContacto(c)", { c: { id: "c", name: "Ana" }, editarContacto: value => { action = "edit:" + value.id; } }, "accessibility.editContact", "edit:c"],
    ["screens/ExportPdfSheet.tsx", "borrarContacto(c.id)", { c: { id: "c", name: "Ana" }, borrarContacto: value => { action = "delete:" + value; } }, "accessibility.deleteContact", "delete:c"],
  ]) {
    const button = originalButton(file, needle, { t, ...deps });
    assert.equal(button.accessibilityLabel, t(expected, { name: "Ana" })); button.onPress(); assert.equal(action, operation);
  }
  for (const checked of [false, true]) {
    const favorite = originalButton("screens/NuevaCategoria.tsx", "alternarFavorito", { t, esFav: checked, alternarFavorito: () => { action = "favorite"; } });
    assert.equal(favorite.accessibilityRole, "togglebutton"); assert.equal(favorite.accessibilityState.checked, checked);
    assert.equal(favorite.accessibilityLabel, t(checked ? "accessibility.removeFavorite" : "accessibility.addFavorite"));
    favorite.onPress(); assert.equal(action, "favorite");
  }
  for (const delta of [-1, 1]) {
    const button = originalButton("screens/NuevaVenta.tsx", "sumar(p.id, " + delta + ")", { t, p: { id: "p", nombre: "Pan" }, sumar: (id, amount) => { action = id + ":" + amount; } }, delta < 0 ? "Minus" : "Plus");
    assert.equal(button.accessibilityLabel, t(delta < 0 ? "accessibility.decreaseProduct" : "accessibility.increaseProduct", { name: "Pan" }));
    button.onPress(); assert.equal(action, "p:" + delta);
  }
  for (const x of ["dibujo", "foto", "color"]) {
    const tab = originalButton("screens/NuevoPagoProgramado.tsx", "setPestana(x)", { t, x, pestana: x, setPestana: value => { action = value; } });
    assert.equal(tab.accessibilityRole, "tab"); assert.equal(tab.accessibilityState.selected, true);
    assert.equal(tab.accessibilityLabel, t("calendario.nuevo.pestana." + x)); tab.onPress(); assert.equal(action, x);
  }
  for (const key of Object.keys(translations[lang]).filter(key => key.startsWith("accessibility.color."))) assert.ok(!translations[lang][key].includes("accessibility."));
}
const React = { createElement: (type, props, ...children) => ({ type, props, children }) };
const photo = handlerOriginal("utils/iconosFavoritos.ts", "esFoto", {}, read("utils/iconosFavoritos.ts"));
const iconModule = { exports: {} };
new Function("module", "exports", "require", ts.transpile(read("utils/iconAccessibility.ts"), {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}))(iconModule, iconModule.exports, name => {
  assert.equal(name, "@/utils/iconosFavoritos"); return { esFoto: photo };
});
const iconAst = ts.createSourceFile("icons.tsx", read("constants/iconos.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const catalogs = {};
function catalog(node) {
  if (ts.isVariableDeclaration(node) && ["GENERICOS", "GRUPOS_MARCAS"].includes(node.name.getText(iconAst))) {
    catalogs[node.name.getText(iconAst)] = new Function("return (" + node.initializer.getText(iconAst) + ");")();
  }
  ts.forEachChild(node, catalog);
}
catalog(iconAst);
assert.deepEqual(Object.keys(iconModule.exports.ICON_ACCESSIBILITY_NAMES).sort(), Object.keys(catalogs.GENERICOS).sort());
for (const lang of ["es", "en", "pt"]) {
  for (const id of [...Object.keys(catalogs.GENERICOS), ...catalogs.GRUPOS_MARCAS.flatMap(group => group.iconos)]) {
    const name = iconModule.exports.iconLabelFor(id, lang);
    assert.ok(name && !/Unavailable|indisponível|no disponible/.test(name), lang + ": dibujo conocido " + id);
  }
  const privatePhoto = "data:image/jpeg;base64,CONFIDENTIAL_IMAGE";
  assert.ok(!iconModule.exports.iconLabelFor(privatePhoto, lang).includes(privatePhoto));
  assert.ok(!iconModule.exports.iconLabelFor("https://private.invalid/SECRET", lang).includes("SECRET"));
  let selected = null;
  const icon = handlerOriginal("screens/NuevoPagoProgramado.tsx", "Casilla",
    { React, TouchableOpacity: "TouchableOpacity", View: "View", iconoDe: () => "Icon" },
    read("screens/NuevoPagoProgramado.tsx"));
  const label = iconModule.exports.iconLabelFor("Coffee", lang);
  const tree = icon({ id: "Coffee", label, puesto: true, tinta: "#000", onPress: id => { selected = id; } });
  assert.equal(tree.props.accessibilityLabel, label); assert.equal(tree.props.accessibilityRole, "radio");
  assert.equal(tree.props.accessibilityState.checked, true); tree.props.onPress(); assert.equal(selected, "Coffee");
  const color = handlerOriginal("screens/NuevaCategoria.tsx", "CasillaColor",
    { React, TouchableOpacity: "TouchableOpacity", Check: "Check", COLOR_HEX_600: { red: "#dc2626" } },
    read("screens/NuevaCategoria.tsx"));
  const colored = color({ color: "red", label: translations[lang]["accessibility.color.red"], puesto: false, onElegir: id => { selected = id; } });
  assert.equal(colored.props.accessibilityState.checked, false); colored.props.onPress(); assert.equal(selected, "red");
}
const sourceFiles = execFileSync("git", ["ls-files", "app", "screens", "components"], { encoding: "utf8" })
  .split(/\r?\n/).filter(file => file.endsWith(".tsx") && !/credit|tarjeta/i.test(file)
    && !["components/FAB.tsx", "components/BudgetRing.tsx", "components/SpaceActionBar.tsx"].includes(file));
for (const file of sourceFiles) {
  const source = ast(file);
  function inspect(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (["TouchableOpacity", "Pressable"].includes(opening.tagName.getText(source))) {
        const attrs = opening.attributes.properties.filter(ts.isJsxAttribute);
        const press = attrs.some(attr => attr.name.getText(source) === "onPress");
        const label = attrs.some(attr => attr.name.getText(source) === "accessibilityLabel");
        const hidden = attrs.some(attr => attr.name.getText(source) === "accessible" && attr.initializer?.getText(source) === "{false}");
        let hasText = false;
        function content(child) { if (ts.isJsxElement(child) && child.openingElement.tagName.getText(source) === "Text") hasText = true; ts.forEachChild(child, content); }
        content(node);
        assert.ok(!press || label || hidden || hasText, file + ":" + (source.getLineAndCharacterOfPosition(opening.getStart(source)).line + 1) + ": icono pulsable sin rótulo");
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}
for (const file of ["screens/CategoryCustomize.tsx", "screens/NuevaCategoria.tsx", "components/TransactionCategorySheet.tsx"]) {
  assert.ok(read(file).includes('zoomOut: t("accessibility.zoomOut")'));
  assert.ok(read(file).includes('zoomIn: t("accessibility.zoomIn")'));
}
console.log("Props/acciones/JSX originales: botones, contactos, productos, guardar, favoritos, pestañas y catálogo completo nombrados; tres idiomas. Inventario estático sin iconos pulsables anónimos fuera de tarjetas. Foco/TalkBack/Android pendientes.");

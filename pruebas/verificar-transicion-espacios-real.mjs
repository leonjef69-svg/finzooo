import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_SPACE_TRANSITION_BASELINE });
const root = read("app/_layout.tsx");
const tree = ts.createSourceFile("layout.tsx", root, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let background, animation; const options = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "screenBg") background = node.initializer.getText(tree);
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "spaceAnimation") animation = node.initializer.getText(tree);
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "Stack.Screen") {
    const props = node.attributes.properties, name = props.find(item => item.name?.text === "name")?.initializer?.text;
    const expr = props.find(item => item.name?.text === "options")?.initializer?.expression;
    if (expr) options.set(name, expr.getText(tree));
  }
  ts.forEachChild(node, visit);
}
visit(tree);
const run = (code, scope) => vm.runInNewContext(ts.transpile(`(${code})`, { target: ts.ScriptTarget.ES2022 }), scope);
function module(file, require = () => ({})) {
  const m = { exports: {} };
  vm.runInNewContext(ts.transpile(read(file), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), { module: m, exports: m.exports, require });
  return m.exports;
}
const style = module("constants/style.ts");
const theme = module("constants/visualTheme.ts", () => style);
const scope = { ...theme, NOCHE: style.NOCHE, entry: false, colorScheme: "light", visualStyle: "peachOlive", ENTRY_COLORS: { background: "entry" } };
const white = theme.nativewindThemeVariables("peachOlive", false)["--fino-white"].split(" ").map(Number);
const expected = `#${white.map(value => value.toString(16).padStart(2, "0")).join("")}`;
assert.equal(run(background, scope), expected, "el fondo intermedio debe ser el mismo crema de las pantallas, no un blanco distinto");
scope.colorScheme = "dark"; assert.equal(run(background, scope), style.NOCHE.fondo);
scope.colorScheme = "light"; scope.visualStyle = "classic"; assert.equal(run(background, scope), "#ffffff");
for (const reducedMotion of [false, true]) {
  scope.spaceAnimation = run(animation, { reducedMotion });
  for (const name of ["(tabs)", "family", "boxes"]) {
    const actual = run(options.get(name), { ...scope, screenBg: expected });
    assert.equal(actual.animation, reducedMotion ? "none" : "slide_from_right");
    assert.equal(actual.animationTypeForReplace, "push", "la pantalla anterior queda bajo la entrante durante el reemplazo");
    assert.equal(actual.contentStyle.backgroundColor, expected);
  }
}
const tabs = read("app/(tabs)/_layout.tsx");
assert.match(tabs, /sceneStyle: \{ backgroundColor: screenBackgroundForVisualStyle\(visualStyle, isDark\) \}/);
assert.match(root, /<AppDataProvider><RootNavigator \/><\/AppDataProvider>/, "la navegación recibe el estilo vigente, no el valor por defecto fuera del proveedor");
console.log("Opciones originales: fondos coincidentes, tres rutas con reemplazo lateral uniforme y movimiento reducido respetado. Vídeo Android se verifica aparte.");

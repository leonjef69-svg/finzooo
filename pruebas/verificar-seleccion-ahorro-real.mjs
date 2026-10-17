import assert from "node:assert/strict";
import ts from "typescript";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
function variable(file, name, env) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found ??= node; ts.forEachChild(node, visit); }
  visit(ast); assert.ok(found?.initializer, `${file}: ${name}`);
  const code = ts.transpileModule(`return (${found.initializer.getText(ast)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(env), code)(...Object.values(env));
}
const bundle = await build({ stdin: { contents: 'export * from "./utils/movementDates.ts"; export * from "./utils/linkedTransfers.ts";', resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": process.cwd() } });
const module = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const api = module.exports;
const movement = (id, extra = {}) => ({ id, type: "expense", amount: 10, date: "2026-10-17", category: "otros", method: "cash", description: "Registro", notes: "", ...extra });
const entries = [movement(1, { internalTransfer: "goal" }), movement(2, { internalTransfer: "goal" }), movement(3),
  movement(4, { type: "income" }), movement(5, { internalTransfer: "family", internalTransferSpaceId: "same", internalTransferLink: "f-a" }),
  movement(6, { internalTransfer: "family", internalTransferSpaceId: "same", internalTransferLink: "f-b", type: "income" }),
  movement(7, { internalTransfer: "box", internalTransferSpaceId: "same", internalTransferLink: "b-a" }),
  movement(8, { internalTransfer: "family", internalTransferSpaceId: "other", internalTransferLink: "f-c" }),
  movement(9, { internalTransfer: "family", internalTransferSpaceId: "same", internalTransferLink: "f-d", date: "2026-10-16" })];
const source = JSON.stringify(entries);
const visibleRecentRows = api.movementRowsByDay(entries, item => item.date, api.compactPersonalTransferRows);
let selected = [], notices = 0;
const historyRemovable = new Set(entries.map(item => item.id));
const toggle = variable("screens/Home.tsx", "toggleSelected", { useCallback: fn => fn, visibleRecentRows, historyRemovable,
  historyNotice: { current: () => { notices++; } }, setSelected: update => { selected = update(selected); } });
toggle(1); assert.deepEqual(selected, [1], "tocar un ahorro selecciona SOLO ese recibo, no todos los movimientos del día");
toggle(2); assert.deepEqual(selected, [1, 2]); toggle(1); assert.deepEqual(selected, [2]); toggle(2); assert.deepEqual(selected, []);
toggle(3); assert.deepEqual(selected, [3], "un gasto ordinario tampoco selecciona su día completo"); toggle(3);
toggle(5); assert.deepEqual(selected, [5, 6], "un resumen solo selecciona su propia Familia, no Caja, otra Familia ni otro día"); toggle(5);
assert.deepEqual(selected, []);
historyRemovable.delete(6); toggle(5); assert.deepEqual(selected, []); assert.equal(notices, 1, "un grupo no quitables no se selecciona parcialmente");
toggle(1); assert.deepEqual(selected, [1], "una transferencia bloqueada del mismo día no bloquea seleccionar el ahorro");
assert.equal(JSON.stringify(entries), source, "seleccionar no modifica dinero ni movimientos");

const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
let hooks = [], cursor = 0;
const t = key => key;
const ui = { React, View: "View", Text: "Text", TouchableOpacity: "Button", ScrollView: "Scroll", LinearGradient: "Gradient",
  PiggyBank: "Icon", Plus: "Icon", MoreHorizontal: "Icon", CheckCircle2: "Icon", CircleHelp: "Icon", ArrowUpRight: "Icon", BackButton: "Back",
  AvisoSoloLectura: "Readonly", ConfirmDialog: "Confirm", GoalFormSheet: "Form", MoveMoneySheet: "Move", UseSavingsSheet: "Use", SavingsMovementRow: "Receipt",
  useState: initial => { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }]; },
  useRef: value => { const index = cursor++; return hooks[index] ??= { current: value }; }, useEffect() {},
  useAppData: () => ({ t, fmt: n => `S/${n}`, transactions: [], commitSavingsAction: async () => false }), useColorScheme: () => ({ colorScheme: "light" }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }), compararMovimientos: () => 0, visiblePersonalMovement: () => true };
const screen = handlerOriginal("screens/SavingsList.tsx", "SavingsList", ui, read("screens/SavingsList.tsx"));
const goal = { id: 1, name: "Viaje", target: 20, saved: 10, createdDate: "2026-10-17", completed: false };
const render = () => { cursor = 0; return screen({ goals: [goal], onBack() {}, apartado: 10, libre: 90, disponible: 100, monthLabel: "Octubre", descuadre: false }); };
function flatten(node) { if (Array.isArray(node)) return node.flatMap(flatten); if (!node || typeof node !== "object") return []; return [node, ...node.children.flatMap(flatten)]; }
let tree = render();
assert.equal(flatten(tree).filter(node => node.type === "Text" && node.children.includes("goalForm.editTitle")).length, 0, "no queda el Editar meta duplicado debajo de los botones");
flatten(tree).find(node => node.props.accessibilityLabel === "savings.options").props.onPress(); tree = render();
const editText = flatten(tree).filter(node => node.type === "Text" && node.children.includes("common.edit")); assert.equal(editText.length, 1);
const editButton = flatten(tree).find(node => node.type === "Button" && flatten(node).includes(editText[0])); editButton.props.onPress(); tree = render();
assert.equal(flatten(tree).filter(node => node.type === "Form").length, 1, "el único Editar sigue abriendo el formulario");
console.log("Selección original: ahorros/gastos individuales, resúmenes solo del mismo espacio/día, bloqueo conservado y un único Editar funcional. Sin guardar dinero; React adaptado.");

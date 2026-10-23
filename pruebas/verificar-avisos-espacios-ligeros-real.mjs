import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// Proyección/JSX del proveedor y manejadores originales; React, temporizadores
// y transporte adaptados. No monta Android ni atribuye una cifra de FPS.
const read = createSourceReader();
const file = "contexts/AppDataContext.tsx", text = read(file);
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let provider, value, subscribeError;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "AppDataProvider") provider = node;
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "valor"
    && node.initializer?.getText(source).startsWith("useValorEstable(")) value = node.initializer;
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect"
    && node.arguments[0]?.getText(source).includes("return subscribeStorageWriteErrors(")) subscribeError = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(provider && value && subscribeError, "se ejecutan las piezas originales del proveedor");
const returned = provider.body.statements.find(ts.isReturnStatement).expression;
const compile = code => ts.transpileModule(code, { fileName: file, compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React,
} }).outputText;
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const React = { createElement: element, Fragment: "Fragment" };
let cursor = 0;
const refs = [];
const stable = { exports: {} };
vm.runInNewContext(ts.transpileModule(read("utils/valorEstable.ts"), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, { module: stable, exports: stable.exports, require: name => {
  assert.equal(name, "react");
  return { useRef: initial => refs[cursor++] ??= { current: initial } };
} });
const timers = new Map(), cancelledTimers = [];
let nextTimer = 0, writeErrorListener;
const transactions = [{ id: 1, type: "income", amount: 50, date: "2026-10-01" }];
const scopeValues = {
  React, View: "View", Modal: "Modal", Text: "Text",
  AppDataContext: { Provider: "DataProvider" }, AppToastContext: { Provider: "ToastProvider" },
  useValorEstable: stable.exports.useValorEstable,
  toast: "", toastTimer: { current: null },
  setToast: message => { scopeValues.toast = message; },
  setTimeout: (work, delay) => { const id = ++nextTimer; timers.set(id, { work, delay }); return id; },
  clearTimeout: id => { cancelledTimers.push(id); timers.delete(id); },
  tRef: { current: key => key }, t: key => key,
  subscribeStorageWriteErrors: listener => { writeErrorListener = listener; return () => { writeErrorListener = null; }; },
  visualStyleVariables: {}, children: element("AppScreens", {}),
  testerPremium: { active: false, pendingVerification: false, grantedAt: null },
  notificationReader: { isSupported: false },
  datosNegocio: { negocios: [], productos: [], ventas: [], movimientos: [] },
  transactions, goals: [], budgets: { "2026-10": 100 }, month: { y: 2026, m: 9 },
  maximoAApartar: () => 0, pruebaHorasRestantes: () => 0,
};
const scope = new Proxy(scopeValues, {
  has: () => true,
  get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : null,
});
scopeValues.showToast = handlerOriginal(file, "showToast", scopeValues, text);
const project = new Function("scope", compile(`with (scope) { const valor = ${value.getText(source)}; return ${returned.getText(source)}; }`));
const startWriteErrors = new Function("scope", compile(`with (scope) { return (${subscribeError.getText(source)})(); }`));
const flatten = node => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
let dataNotifications = 0, toastNotifications = 0, previousData, previousToast;
function render() {
  cursor = 0;
  const tree = project(scope);
  const data = flatten(tree).find(node => node.type === "DataProvider").props.value;
  const toast = flatten(tree).find(node => node.type === "ToastProvider")?.props.value ?? data.toast;
  // React propaga un contexto al cambiar su identidad mediante Object.is.
  if (previousData !== undefined && !Object.is(previousData, data)) dataNotifications++;
  if (previousToast !== undefined && !Object.is(previousToast, toast)) toastNotifications++;
  previousData = data; previousToast = toast;
  return { data, toast };
}
function runTimer(expectedDelay) {
  assert.equal(timers.size, 1, "solo el último mensaje conserva su temporizador");
  const [id, { work, delay }] = [...timers][0];
  assert.equal(delay, expectedDelay); timers.delete(id); work();
}
const initial = render(), beforeMoney = JSON.stringify({ transactions, budgets: scopeValues.budgets, goals: scopeValues.goals });
const showToast = initial.data.showToast;
showToast("Movimiento guardado");
let current = render();
assert.equal(current.toast, "Movimiento guardado");
assert.equal(current.data, initial.data, "mostrar un aviso no debe notificar a todas las pantallas financieras");
assert.equal(current.data.showToast, showToast);
runTimer(2200); current = render();
assert.equal(current.toast, "");
assert.equal(current.data, initial.data, "cerrar el aviso tampoco cambia los datos financieros");
assert.equal(dataNotifications, 0); assert.equal(toastNotifications, 2);
showToast("Primero"); render();
const previousTimer = scopeValues.toastTimer.current;
showToast("Segundo"); current = render();
assert.ok(cancelledTimers.includes(previousTimer)); assert.equal(current.toast, "Segundo");
runTimer(2200); render();
const stopWriteErrors = startWriteErrors(scope);
writeErrorListener(); current = render();
assert.equal(current.toast, "toast.localSaveFailed", "se conserva el aviso real de fallo de guardado");
runTimer(4500); current = render();
assert.equal(current.toast, ""); assert.equal(dataNotifications, 0);
stopWriteErrors(); assert.equal(writeErrorListener, null);
assert.equal(JSON.stringify({ transactions, budgets: scopeValues.budgets, goals: scopeValues.goals }), beforeMoney);
scopeValues.transactions = [...transactions, { id: 2, type: "expense", amount: 10, date: "2026-10-02" }];
current = render();
assert.equal(dataNotifications, 1, "una modificación financiera auténtica sigue notificándose");
assert.equal(current.data.transactions, scopeValues.transactions);
assert.equal(current.data.showToast, showToast, "el emisor conserva su identidad entre cambios financieros");

let toastContextAvailable = true;
const useAppToast = handlerOriginal(file, "useAppToast", {
  AppToastContext: scopeValues.AppToastContext,
  useContext: context => {
    assert.equal(context, scopeValues.AppToastContext);
    return toastContextAvailable ? current.toast : null;
  },
}, text);
assert.equal(useAppToast(), "", "un mensaje vacío es válido dentro del proveedor");
toastContextAvailable = false;
assert.throws(useAppToast, /dentro de AppDataProvider/);
toastContextAvailable = true;
// La capa real consume el mensaje separado y lo sigue pasando a Toast.
const overlays = handlerOriginal("app/_layout.tsx", "GlobalOverlays", {
  React, useAppData: () => current.data, useAppToast,
  CelebrationOverlay: "CelebrationOverlay", Toast: "Toast",
}, read("app/_layout.tsx"));
showToast("Dinero devuelto"); current = render();
assert.equal(flatten(overlays()).find(node => node.type === "Toast").props.text, "Dinero devuelto");

// Un aviso/cambio ajeno no invalida el handler que reciben las filas memoizadas.
const routes = [], homeModule = { exports: {} };
let homeContext = { ...current.data, userName: "Ana" };
vm.runInNewContext(ts.transpileModule(read("app/(tabs)/index.tsx"), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText, { module: homeModule, exports: homeModule.exports, require: name => {
  if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  if (name === "react-native") return { View: "View" };
  if (name === "@/utils/nav") return { irUnaVez: route => routes.push(route) };
  if (name === "@/screens/Home") return { __esModule: true, default: "Home" };
  if (name === "@/contexts/AppDataContext") return { useAppData: () => homeContext };
  assert.fail(name);
} });
const firstHome = flatten(homeModule.exports.default()).find(node => node.type === "Home").props;
homeContext = { ...homeContext, respaldoFallo: "pendiente" };
const nextHome = flatten(homeModule.exports.default()).find(node => node.type === "Home").props;
assert.equal(firstHome.onOpenDetail, nextHome.onOpenDetail, "un aviso de respaldo no obliga a redibujar cada fila de Personal");
firstHome.onOpenDetail(17); nextHome.onOpenDetail(29);
assert.deepEqual(routes, ["/transaction/17", "/transaction/29"], "cada toque sigue abriendo el movimiento elegido");
console.log("Avisos y filas: texto/errores conservados, cero cambios de contexto financiero por aparecer/cerrar, detalle estable.");

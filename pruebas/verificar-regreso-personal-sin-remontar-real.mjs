import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import * as esbuild from "esbuild";
import { createRequire } from "node:module";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const read = createSourceReader();
const require = createRequire(import.meta.url);
// El navegador es el StackRouter instalado, no una copia de su algoritmo.
const built = esbuild.buildSync({ stdin: { contents: 'export { StackRouter, StackActions } from "@react-navigation/routers";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, write: false, platform: "node", format: "cjs", logLevel: "silent" });
const loaded = { exports: {} };
new Function("module", "exports", "require", built.outputFiles[0].text)(loaded, loaded.exports, require);
const { StackRouter, StackActions } = loaded.exports;
const core = StackRouter({ initialRouteName: "(tabs)" });
const options = { routeNames: ["(tabs)", "family", "boxes", "detail", "login"], routeParamList: {}, routeGetIdList: {} };
let state = core.getInitialState(options), now = 10_000, fail = false;
const actions = [];
const routeName = path => path === "/(tabs)" ? "(tabs)" : path.slice(1);
function dispatch(kind, path) {
  if (fail) throw Error("navegador no disponible");
  const name = routeName(path);
  const action = kind === "push" ? StackActions.push(name) : kind === "replace" ? StackActions.replace(name) : StackActions.popTo(name);
  const next = core.getStateForAction(state, action, options);
  assert.ok(next, "el navegador real acepta la ruta"); state = next; actions.push(kind);
}
const module = { exports: {} };
vm.runInNewContext(ts.transpile(read("utils/nav.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
  module, exports: module.exports, Date: { now: () => now }, setTimeout, clearTimeout,
  require: name => name === "expo-router" ? { router: {
    push: path => dispatch("push", path), replace: path => dispatch("replace", path), dismissTo: path => dispatch("dismissTo", path),
    canGoBack: () => state.index > 0, back: () => { state = core.getStateForAction(state, StackActions.pop(1), options); },
  } } : name === "@react-navigation/native" ? { StackActions } : {},
});
const nav = module.exports;
const navigation = { getState: () => state, dispatch: resolve => {
  if (fail) throw Error("navegador no disponible");
  const action = resolve(state);
  assert.equal(action.target, state.key, "la acción va al navegador de espacios, no a las pestañas hijas");
  const next = core.getStateForAction(state, action, options);
  assert.ok(next); state = next; actions.push(action.type);
} };
const open = from => handlerOriginal("components/SpaceSwitcher.tsx", "open", { active: from, navigation, ...nav }, read("components/SpaceSwitcher.tsx"));
const homeKey = state.routes[0].key;
open("personal")("family");
assert.ok(state.routes.some(route => route.key === homeKey), "salir a Familia conserva Personal: reemplazarlo obliga a montar Inicio y toda su barra otra vez");
assert.deepEqual(state.routes.map(route => route.name), ["(tabs)", "family"]);
now += 100; open("family")("boxes"); now += 100; open("boxes")("family");
assert.deepEqual(state.routes.map(route => route.name), ["(tabs)", "family"], "solo una pantalla compartida delante, no tres pantallas pesadas acumuladas");
const beforeDouble = actions.length; open("personal")("family");
assert.equal(actions.length, beforeDouble, "toques repetidos del destino todavía en salida no apilan otra copia");
now += 100; open("family")("personal");
assert.equal(state.routes.length, 1); assert.equal(state.routes[0].key, homeKey, "el regreso reutiliza exactamente el mismo Inicio");
for (let i = 0; i < 30; i++) {
  now += 100; open("personal")(i % 2 ? "family" : "boxes");
  assert.equal(state.routes.length, 2);
  now += 100; open(i % 2 ? "family" : "boxes")("personal");
  assert.equal(state.routes.length, 1); assert.equal(state.routes[0].key, homeKey);
}
const beforeSame = actions.length; open("personal")("personal"); assert.equal(actions.length, beforeSame);
now += 2_000; open("personal")("family"); now += 100;
open("personal")("boxes");
assert.deepEqual(state.routes.map(route => route.name), ["(tabs)", "boxes"], "un toque de Personal todavía saliendo no debe apilar Familia y Cajas");
now += 100; open("boxes")("personal"); assert.equal(state.routes[0].key, homeKey);
now += 2_000; fail = true;
assert.throws(() => open("personal")("family"), /no disponible/);
fail = false; open("personal")("family"); assert.equal(state.routes.at(-1).name, "family", "fallar no bloquea el reintento");
nav.safeBack(); assert.equal(state.routes[0].key, homeKey); assert.equal(state.routes.length, 1, "Atrás de Android conserva Personal");

// Entrada directa sin Inicio previo: POP_TO de la biblioteca hace el reemplazo seguro.
state = core.getInitialState({ ...options, routeNames: options.routeNames });
state = core.getStateForAction(state, StackActions.replace("family"), options);
now += 2_000; open("family")("personal");
assert.deepEqual(state.routes.map(route => route.name), ["(tabs)"]);

// No afecta a las aperturas generales ni su protección frente al doble toque.
now += 2_000; const beforeDetail = actions.length;
nav.irUnaVez("/detail"); nav.irUnaVez("/detail"); assert.equal(actions.length, beforeDetail + 1);
assert.deepEqual(state.routes.map(route => route.name), ["(tabs)", "detail"]);
state = core.getInitialState(options);
const savedDispatch = navigation.dispatch, pending = [];
navigation.dispatch = resolve => pending.push(resolve);
now += 2_000; open("personal")("family"); now += 100; open("personal")("boxes");
navigation.dispatch = savedDispatch;
for (const resolve of pending) navigation.dispatch(resolve);
assert.deepEqual(state.routes.map(route => route.name), ["(tabs)", "boxes"], "incluso dos órdenes preparadas antes de actualizar el navegador se resuelven contra el árbol vigente");
state = core.getStateForAction(state, StackActions.replace("login"), options);
const beforeProtected = state, actionCount = actions.length;
now += 2_000; open("personal")("family");
assert.equal(state, beforeProtected); assert.equal(actions.length, actionCount, "un toque antiguo no sale de una pantalla de acceso");
state = core.getInitialState(options);
navigation.dispatch = resolve => pending.push(resolve); pending.length = 0;
now += 2_000; open("personal")("boxes");
state = core.getStateForAction(state, StackActions.replace("login"), options);
navigation.dispatch = savedDispatch;
for (const resolve of pending) navigation.dispatch(resolve);
assert.deepEqual(state.routes.map(route => route.name), ["login"], "la sesión también se protege si la pantalla cambió mientras esperaba una orden");
const savedGetState = navigation.getState, beforeUninitialized = actions.length;
navigation.getState = () => undefined; now += 2_000; open("personal")("family");
assert.equal(actions.length, beforeUninitialized); navigation.getState = savedGetState;

state = core.getInitialState(options);
const outer = { key: "expo-root", index: 0, routeNames: ["__root"], routes: [{ name: "__root", state }] };
navigation.getState = () => outer;
navigation.dispatch = resolve => {
  const action = resolve(outer);
  assert.equal(action.target, state.key, "atraviesa el envoltorio Expo y apunta al Stack real de espacios");
  state = core.getStateForAction(state, action, options); outer.routes[0].state = state;
};
now += 2_000; const nestedHome = state.routes[0].key;
open("personal")("family"); now += 100; open("family")("personal");
assert.equal(state.routes.length, 1); assert.equal(state.routes[0].key, nestedHome);
console.log("Selector original + StackRouter real: Personal conserva su clave tras 30 ciclos, solo un espacio delante, regreso rápido, doble toque, fallo/reintento, Atrás y entrada directa correctos.");

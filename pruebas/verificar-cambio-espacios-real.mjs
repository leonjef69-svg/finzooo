import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_SPACE_NAV_BASELINE || "" });
let now = 10_000, rejectReplace = false;
const replaces = [], pushes = [], dismissals = [], destinations = [];
const module = { exports: {} };
function record(route, collection) {
  if (rejectReplace) throw Error("navegador no disponible");
  collection.push(route); destinations.push(route);
}
const router = { replace: route => record(route, replaces), push: route => record(route, pushes),
  dismissTo: route => record(route, dismissals), canGoBack: () => false };
let current = "(tabs)";
const stackAction = type => name => ({ type, payload: { name } });
const StackActions = { push: stackAction("PUSH"), replace: stackAction("REPLACE"), popTo: stackAction("POP_TO") };
const navigation = { getState: () => ({ key: "root", index: 0, routeNames: ["(tabs)", "family", "boxes"], routes: [{ name: current }] }),
  dispatch: resolve => { const action = resolve(navigation.getState()); const name = action.payload.name;
    record(name === "(tabs)" ? "/(tabs)" : "/" + name, action.type === "PUSH" ? pushes : action.type === "REPLACE" ? replaces : dismissals); current = name; } };
const code = ts.transpileModule(read("utils/nav.ts"), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText;
vm.runInNewContext(code, { module, exports: module.exports, Date: { now: () => now },
  setTimeout, clearTimeout, require: name => name === "expo-router" ? { router } : name === "@react-navigation/native" ? { StackActions } : {} });
const nav = module.exports;
const open = active => handlerOriginal("components/SpaceSwitcher.tsx", "open", {
  active, navigation, ...nav,
}, read("components/SpaceSwitcher.tsx"));

// Síntoma: regresar rápidamente al mismo espacio no es un doble toque.
open("personal")("family"); now += 100;
open("family")("boxes"); now += 100;
open("boxes")("family");
assert.deepEqual(destinations, ["/family", "/boxes", "/family"], "Familia → Cajas → Familia debe atender los tres cambios");
open("boxes")("family");
assert.equal(destinations.length, 3, "doble toque en el mismo destino no duplica viajes");
now += 100; open("family")("personal");
now += 100; open("personal")("boxes");
now += 100; open("boxes")("personal");
assert.deepEqual(destinations.slice(3), ["/(tabs)", "/boxes", "/(tabs)"], "el regreso a Personal tampoco queda bloqueado");
open("personal")("personal");
assert.equal(destinations.length, 6, "la pestaña ya seleccionada no navega");
now += 1_500; open("boxes")("personal");
assert.equal(destinations.length, 7, "se puede reintentar el mismo destino pasado el bloqueo");

rejectReplace = true; now += 2_000;
assert.throws(() => open("personal")("family"), /no disponible/);
rejectReplace = false;
open("personal")("family");
assert.equal(destinations.at(-1), "/family", "una orden fallida no consume el reintento inmediato");
nav.reemplazarUnaVez({ pathname: "/family", params: { code: "prueba" } });
assert.equal(replaces.at(-1).params.code, "prueba", "otra ruta con parámetros no se confunde con el toque anterior");
// Se conserva la protección original para pantallas que sí se apilan.
const pushesBefore = pushes.length;
nav.irUnaVez("/transaction/choose"); nav.irUnaVez("/transaction/choose");
assert.equal(pushes.length, pushesBefore + 1);
now += 1_500; nav.irUnaVez("/transaction/choose");
assert.equal(pushes.length, pushesBefore + 2);
console.log("Selector y navegación originales: regresos rápidos atendidos, doble toque descartado, fallo/reintento y protección de apertura conservados. Android comprobado aparte.");

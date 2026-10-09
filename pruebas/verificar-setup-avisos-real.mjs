import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_SETUP_NOTIFICATIONS_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const legacyFile = "screens/SetupBudget.tsx";
const read = file => baseline
  ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" })
  : fs.readFileSync(file, "utf8");
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function drain() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

function environment() {
  const user = { uid: "A" }, auth = { currentUser: user }, changes = [], events = [], writes = [];
  const callbacks = new Set(), store = new Map();
  let getChoice = async key => store.get(key) ?? null;
  let getPermission = async () => ({ granted: false });
  let setChoice = async (key, value) => { store.set(key, value); };
  let setChannel = async () => {};
  let openSettings = async () => {};
  const deps = {
    auth, Platform: { OS: "android" },
    AsyncStorage: {
      getItem: key => { events.push(["get", key]); return getChoice(key); },
      setItem: async (key, value) => { writes.push([key, value]); await setChoice(key, value); },
    },
    Notifications: {
      AndroidImportance: { DEFAULT: 3 },
      getPermissionsAsync: () => { events.push(["permissions"]); return getPermission(); },
      setNotificationChannelAsync: (...args) => { events.push(["channel", ...args]); return setChannel(...args); },
      requestPermissionsAsync: () => { throw Error("La configuración no debe pedir permiso automáticamente"); },
    },
    Linking: { openSettings: () => { events.push(["settings"]); return openSettings(); } },
    AppState: { addEventListener: (_name, callback) => {
      callbacks.add(callback);
      return { remove() { callbacks.delete(callback); events.push(["unsubscribe"]); } };
    } },
  };
  const hook = { values: [], refs: [], previousDeps: [], queued: [], cleanups: [], index: 0, refIndex: 0, effectIndex: 0 };
  const react = {
    useState(initial) {
      const index = hook.index++;
      if (!(index in hook.values)) hook.values[index] = initial;
      return [hook.values[index], value => { hook.values[index] = typeof value === "function" ? value(hook.values[index]) : value; }];
    },
    useRef(initial) {
      const index = hook.refIndex++;
      return hook.refs[index] ??= { current: initial };
    },
    useEffect(callback, dependencies) {
      const index = hook.effectIndex++, previous = hook.previousDeps[index];
      if (!previous || dependencies.some((value, i) => value !== previous[i])) {
        hook.previousDeps[index] = dependencies;
        hook.queued.push(() => { hook.cleanups[index]?.(); hook.cleanups[index] = callback(); });
      }
    },
  };
  let api;
  if (!baseline) {
    const original = read("utils/setupNotifications.ts");
    const compiled = ts.transpileModule(original, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exported = {};
    const imports = { react, "@react-native-async-storage/async-storage": { default: deps.AsyncStorage },
      "react-native": { AppState: deps.AppState, Linking: deps.Linking, Platform: deps.Platform },
      "expo-notifications": deps.Notifications, "@/utils/firebase": { auth } };
    new Function("require", "exports", compiled)(name => {
      if (!(name in imports)) throw Error(`Import no adaptado: ${name}`);
      return imports[name];
    }, exported);
    api = exported;
  }
  function create(uid = "A") {
    if (!baseline) return api.createSetupNotificationController(uid, state => changes.push({ ...state }));
    // Puente de contratos para la fuente histórica: ambos cuerpos originales
    // se ejecutan íntegros. Su limpieza solo quitaba el listener, no las respuestas.
    const original = read(legacyFile), tree = ts.createSourceFile(legacyFile, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let keyExpression;
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "notificationKey") keyExpression = node.initializer.getText(tree);
      ts.forEachChild(node, visit);
    }
    visit(tree); assert.ok(keyExpression);
    const keyCode = ts.transpileModule(`const notificationKey = ${keyExpression};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const notificationKey = new Function("auth", `${keyCode}; return notificationKey;`)(auth);
    let notificationsEnabled = false;
    const setNotificationsEnabled = value => { notificationsEnabled = value; changes.push({ notificationsEnabled: value }); };
    const shared = { ...deps, notificationKey, setNotificationsEnabled };
    return {
      refresh: handlerOriginal(legacyFile, "refreshNotificationState", shared, original),
      enableNotifications: () => handlerOriginal(legacyFile, "enableNotifications", { ...shared, notificationsEnabled }, original)(),
      dispose() {}, // Equivale a remove(): no cambia los cuerpos que ya esperan IO.
    };
  }
  function render(uid = auth.currentUser?.uid ?? null) {
    hook.index = hook.refIndex = hook.effectIndex = 0;
    return api.useSetupNotifications(uid);
  }
  function effects() { while (hook.queued.length) hook.queued.shift()(); }
  return { auth, user, changes, events, writes, store, callbacks, create, render, effects, hook,
    setRead: next => { getChoice = next; }, setPermission: next => { getPermission = next; },
    setWrite: next => { setChoice = next; }, setChannel: next => { setChannel = next; }, setOpen: next => { openSettings = next; } };
}

// Regresión histórica: leer A, esperar Android y cambiar sesión no debe escribir B.
{
  const e = environment(), answer = deferred();
  e.setRead(async () => "pending"); e.setPermission(() => answer.promise);
  const controller = e.create(), pending = controller.refresh();
  e.auth.currentUser = { uid: "B" }; answer.resolve({ granted: true }); await pending;
  assert.deepEqual(e.writes, [], "Una respuesta de A no escribe preferencias de B");
  assert.deepEqual(e.changes, [], "Una respuesta de A no cambia la pantalla de B");
}
{
  const e = environment(), answer = deferred();
  e.setRead(async () => "pending"); e.setPermission(() => answer.promise);
  const controller = e.create(), pending = controller.refresh();
  e.auth.currentUser = { uid: "A" }; answer.resolve({ granted: true }); await pending;
  assert.deepEqual(e.writes, [], "Otra sesión con el mismo UID invalida la respuesta anterior");
  assert.deepEqual(e.changes, []);
}
{
  const e = environment(), first = deferred(), second = deferred();
  let calls = 0;
  e.setRead(async () => "true"); e.setPermission(() => ++calls === 1 ? first.promise : second.promise);
  const controller = e.create(), older = controller.refresh(), newer = controller.refresh();
  second.resolve({ granted: false }); await newer;
  first.resolve({ granted: true }); await older;
  assert.equal(e.changes.at(-1).notificationsEnabled, false, "La consulta nueva gana al permiso antiguo");
}
{
  const e = environment(), answer = deferred();
  e.setRead(async () => "pending"); e.setPermission(() => answer.promise);
  const controller = e.create(), pending = controller.refresh();
  controller.dispose(); answer.resolve({ granted: true }); await pending;
  assert.deepEqual(e.writes, []); assert.deepEqual(e.changes, [], "Desmontar cancela los resultados pendientes");
}
{
  const e = environment(); e.setRead(async () => "pending"); e.setPermission(async () => ({ granted: true }));
  await e.create().refresh();
  assert.deepEqual(e.writes, [["@fino/setup-notifications-enabled:A", "true"]]);
  assert.equal(e.changes.at(-1).notificationsEnabled, true);
  assert.ok(!e.events.some(event => event[0] === "channel" || event[0] === "settings"), "Consultar no abre Ajustes ni pide permisos");
}
{
  const e = environment(); e.auth.currentUser = null;
  const controller = e.create(null); await controller.refresh(); await controller.enableNotifications();
  assert.deepEqual(e.events, []); assert.deepEqual(e.writes, [], "Sin sesión no existe una clave local de respaldo");
}
{
  const e = environment(), channel = deferred(); e.setChannel(() => channel.promise);
  const controller = e.create(), first = controller.enableNotifications(); await controller.enableNotifications();
  assert.equal(e.events.filter(event => event[0] === "channel").length, 1, "El bloqueo actúa antes de React/del primer await");
  channel.resolve(); await first; await drain();
  assert.deepEqual(e.writes, [["@fino/setup-notifications-enabled:A", "pending"]]);
  assert.equal(e.events.filter(event => event[0] === "settings").length, 1);
  assert.equal(e.changes.at(-1).notificationBusy, false);
}
{
  const e = environment(); e.setRead(async () => "true"); e.setPermission(async () => ({ granted: true }));
  const controller = e.create(); await controller.refresh(); e.setOpen(async () => { throw Error("Ajustes no disponibles"); });
  await assert.doesNotReject(controller.enableNotifications());
  assert.equal(e.changes.at(-1).notificationErrorKey, "setup.notificationsFailed");
  assert.equal(e.changes.at(-1).notificationBusy, false);
  assert.equal(e.changes.at(-1).notificationsEnabled, true, "Abrir Ajustes falla, pero no inventa que Android retiró el permiso");
}
{
  const e = environment(); e.setOpen(async () => { throw Error("Ajustes no disponibles"); });
  const controller = e.create(); await assert.doesNotReject(controller.enableNotifications());
  assert.equal(e.changes.at(-1).notificationErrorKey, "setup.notificationsFailed");
  assert.equal(e.changes.at(-1).notificationBusy, false);
  assert.equal(e.changes.at(-1).notificationsEnabled, false);
  e.setOpen(async () => {}); await controller.enableNotifications(); await drain();
  assert.equal(e.changes.at(-1).notificationErrorKey, null, "Reintentar borra solo el fallo anterior, no inventa el permiso");
}
{
  const e = environment(); e.setChannel(async () => { throw Error("canal"); });
  const controller = e.create(); await controller.enableNotifications();
  assert.equal(e.changes.at(-1).notificationErrorKey, "setup.notificationsFailed");
  assert.equal(e.changes.at(-1).notificationBusy, false); assert.deepEqual(e.writes, []);
  e.setChannel(async () => {}); await controller.enableNotifications(); await drain();
  assert.equal(e.events.filter(event => event[0] === "settings").length, 1);
}
{
  const e = environment(); e.setPermission(async () => { throw Error("lectura Android"); });
  const controller = e.create(); await controller.refresh();
  assert.equal(e.changes.at(-1).notificationsEnabled, false);
  assert.equal(e.changes.at(-1).notificationErrorKey, "setup.notificationsFailed");
  e.setPermission(async () => ({ granted: false })); await controller.refresh();
  assert.equal(e.changes.at(-1).notificationErrorKey, null, "una consulta recuperada no mantiene un error antiguo ni inventa permiso");
  assert.equal(e.changes.at(-1).notificationsEnabled, false);
}
{
  const e = environment(), write = deferred();
  e.setRead(async () => "pending"); e.setPermission(async () => ({ granted: true }));
  e.setWrite(() => write.promise);
  const controller = e.create(), pending = controller.refresh(); await drain();
  e.auth.currentUser = { uid: "B" }; write.resolve(); await pending;
  assert.deepEqual(e.writes, [["@fino/setup-notifications-enabled:A", "true"]], "Una escritura ya empezada queda en la clave A, nunca en B");
  assert.deepEqual(e.changes, [], "La confirmación de escritura vieja no modifica la pantalla nueva");
}
{
  const e = environment(), channel = deferred(); e.setChannel(() => channel.promise);
  const controller = e.create(), pending = controller.enableNotifications();
  e.auth.currentUser = { uid: "B" }; channel.resolve(); await pending;
  assert.deepEqual(e.writes, []); assert.ok(!e.events.some(event => event[0] === "settings"));
}
{
  const e = environment(); e.setWrite(async () => { throw Error("disco"); });
  const controller = e.create(); await controller.enableNotifications();
  assert.equal(e.changes.at(-1).notificationErrorKey, "setup.notificationsFailed");
  assert.equal(e.changes.at(-1).notificationBusy, false);
  assert.ok(!e.events.some(event => event[0] === "settings"), "No abre Ajustes después de un guardado fallido");
  e.setWrite(async (key, value) => { e.store.set(key, value); });
  await controller.enableNotifications(); await drain();
  assert.equal(e.events.filter(event => event[0] === "settings").length, 1, "Se puede reintentar tras fallar");
}
{
  const e = environment(), settings = deferred(); e.setOpen(() => settings.promise);
  const controller = e.create(), pending = controller.enableNotifications(); await drain();
  e.setPermission(async () => ({ granted: true })); await controller.refresh();
  settings.resolve(); await pending; await drain();
  assert.equal(e.changes.at(-1).notificationsEnabled, true, "Regresar antes de liberar el toque no pierde la consulta final");
}
if (!baseline) {
  // Se ejecuta también el hook original con un ciclo React/IO adaptado, no Android.
  const e = environment(), oldAnswer = deferred();
  e.setRead(async () => "pending"); e.setPermission(() => oldAnswer.promise);
  e.render("A"); e.effects(); assert.equal(e.callbacks.size, 1);
  e.auth.currentUser = { uid: "B" };
  const changing = e.render("B");
  assert.equal(changing.notificationsEnabled, false);
  await changing.enableNotifications();
  assert.ok(!e.events.some(event => event[0] === "channel" || event[0] === "settings"), "Antes del nuevo efecto no usa el controlador de A");
  e.setRead(async () => null); e.setPermission(async () => ({ granted: false }));
  e.effects(); await drain(); oldAnswer.resolve({ granted: true }); await drain();
  assert.equal(e.callbacks.size, 1, "Cambiar cuenta retira el listener anterior");
  assert.deepEqual(e.writes, []); assert.equal(e.render("B").notificationsEnabled, false);
  e.auth.currentUser = null;
  assert.equal(e.render(null).notificationErrorKey, "settings.noActiveSession"); e.effects();
  const before = e.events.length; await e.render(null).enableNotifications();
  assert.equal(e.events.length, before, "El hook sin sesión no abre Ajustes");
  for (const cleanup of e.hook.cleanups) cleanup?.();
  assert.equal(e.callbacks.size, 0, "Desmontar retira la suscripción");
}
console.log("Setup: controlador/hook originales con IO/ciclo React adaptados. Clave, identidad exacta, orden, desmontaje, doble toque, fallos y retorno comprobados; permiso/entrega Android reales pendientes.");

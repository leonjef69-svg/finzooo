import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const require = createRequire(import.meta.url);
const baseline = process.env.FINO_LOCK_ALTERNATIVE_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const file = "components/AppLockGate.tsx";
const lockNames = ["biometricKind", "cancelBiometrics", "usaHuella", "lockEnabledState", "subscribeLockConfiguration", "olvidarSalida", "pinRetryAfterMs", "promptBiometrics", "recordarSalida", "salioHaceNada", "verifyPin"];
const compiled = (await build({ stdin: { contents: read(file), sourcefile: file, loader: "tsx", resolveDir: process.cwd() }, bundle: true, platform: "node", format: "cjs", jsx: "automatic", external: ["react/jsx-runtime"], write: false, logLevel: "silent", plugins: [{ name: "native-adapters", setup(b) {
  b.onResolve({ filter: /^(react$|react-native$|react-native-safe-area-context$|lucide-react-native$|@\/)/ }, args => ({ path: args.path, namespace: "adapter" }));
  b.onLoad({ filter: /.*/, namespace: "adapter" }, args => {
    const code = args.path === "react" ? "export const {useCallback,useEffect,useLayoutEffect,useRef,useState}=globalThis.__lockAlternative.hooks;"
      : args.path === "react-native" ? "export const AppState=globalThis.__lockAlternative.appState; export const Modal='Modal',ScrollView='ScrollView',Text='Text',TouchableOpacity='TouchableOpacity',View='View';"
      : args.path === "react-native-safe-area-context" ? "export const useSafeAreaInsets=()=>({top:24,bottom:24});"
      : args.path === "lucide-react-native" ? "export const Lock='Lock',Fingerprint='Fingerprint',ScanFace='ScanFace';"
      : args.path.endsWith("appLock") ? `export const GRACE_MS=120000,PIN_LENGTH=4; ${lockNames.map(n => `export const ${n}=(...args)=>globalThis.__lockAlternative.io.${n}(...args);`).join("\n")}`
      : args.path.endsWith("screenPrivacy") ? "export const applyLockScreenPrivacy=(...args)=>globalThis.__lockAlternative.io.applyLockScreenPrivacy(...args);"
      : args.path.endsWith("lockState") ? "export const setAppLocked=(value)=>globalThis.__lockAlternative.cover.push(value);"
      : args.path.endsWith("AppDataContext") ? "export const useAppData=()=>globalThis.__lockAlternative.context;"
      : "export default 'PinPad';";
    return { contents: code, loader: "js" };
  });
} }] })).outputFiles[0].text;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const nodes = tree => !tree || typeof tree !== "object" ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];

// Hook scheduler: executes the original JSX/effects/handlers through renders.
// Only React scheduling, Android/authentication IO and time are adapted.
function mount(overrides = {}, ready = true) {
  const slots = [], effects = [], layout = [], cleanups = new Map(), timers = new Map();
  const env = { cover: [], requests: [], pins: [], cancellations: 0, remembered: 0, forgotten: 0, now: 1000000, dirty: true, alive: true,
    context: { ready, t: key => key }, io: {}, appState: { currentState: "active", addEventListener(_event, listener) { env.listener = listener; return { remove() { env.listener = null; } }; } } };
  let index = 0, timerId = 0;
  const equal = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const register = (fn, deps, queue) => {
    const id = index++;
    if (!slots[id] || !equal(slots[id].deps, deps)) { slots[id] = { deps }; queue.push({ id, fn }); }
  };
  env.hooks = {
    useState(initial) { const id = index++; if (!(id in slots)) slots[id] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[id].value, value => { if (!env.alive) return; const next = typeof value === "function" ? value(slots[id].value) : value; if (!Object.is(next, slots[id].value)) { slots[id].value = next; env.dirty = true; } }]; },
    useRef(value) { const id = index++; return slots[id] ??= { current: value }; },
    useEffect(fn, deps) { register(fn, deps, effects); }, useLayoutEffect(fn, deps) { register(fn, deps, layout); },
    useCallback(fn, deps) { const id = index++; if (!slots[id] || !equal(slots[id].deps, deps)) slots[id] = { deps, fn }; return slots[id].fn; },
  };
  env.io = {
    lockEnabledState: async () => "enabled", applyLockScreenPrivacy: async () => "confirmed", salioHaceNada: async () => false,
    usaHuella: async () => true, biometricKind: async () => "fingerprint", pinRetryAfterMs: async () => 0,
    promptBiometrics: () => { const p = deferred(); env.requests.push(p); return p.promise; },
    cancelBiometrics: async () => { env.cancellations++; },
    verifyPin: async pin => { env.pins.push(pin); return pin === "1234" ? "real" : null; },
    recordarSalida: async () => { env.remembered++; }, olvidarSalida: async () => { env.forgotten++; },
    subscribeLockConfiguration: listener => { env.configuration = listener; return () => { env.configuration = null; }; }, ...overrides,
  };
  globalThis.__lockAlternative = env;
  const module = { exports: {} };
  const schedule = (fn, interval) => { const id = ++timerId; timers.set(id, { fn, interval }); return id; };
  class Clock extends Date { static now() { return env.now; } }
  new Function("module", "exports", "require", "Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", compiled)(module, module.exports, require, Clock,
    fn => schedule(fn, false), id => timers.delete(id), fn => schedule(fn, true), id => timers.delete(id));
  env.render = () => {
    globalThis.__lockAlternative = env;
    env.dirty = false; index = 0; env.tree = module.exports.default();
    for (const queue of [layout, effects]) for (const { id, fn } of queue.splice(0)) { cleanups.get(id)?.(); cleanups.set(id, fn()); }
  };
  env.flush = async () => { for (let i = 0; i < 20; i++) { if (env.dirty && env.alive) env.render(); await new Promise(r => setImmediate(r)); } assert.ok(!env.dirty || !env.alive, "Los efectos deben estabilizarse"); };
  env.emit = next => { env.appState.currentState = next; env.listener?.(next); };
  env.tick = async () => { for (const [id, timer] of [...timers]) { if (!timer.interval) timers.delete(id); timer.fn(); } await env.flush(); };
  env.pad = () => nodes(env.tree).find(n => n.type === "PinPad");
  env.button = key => nodes(env.tree).find(n => n.type === "TouchableOpacity" && (n.props.accessibilityLabel === key || nodes(n).some(x => x.type === "Text" && x.props.children === key)));
  env.close = () => { env.alive = false; for (const fn of cleanups.values()) fn?.(); timers.clear(); };
  return env;
}

let env;
try {
  // Activar desde una sesión ya abierta no exige una tercera entrada del PIN.
  let enabled = false;
  env = mount({ lockEnabledState: async () => enabled ? "enabled" : "disabled", usaHuella: async () => false });
  await env.flush(); assert.equal(env.tree, null);
  enabled = true; env.configuration("enabled"); await env.flush();
  assert.equal(env.tree, null, "PIN recién creado/confirmado no vuelve a pedirlo para abrir la misma sesión");
  assert.deepEqual(env.pins, []); assert.equal(env.requests.length, 0);
  env.emit("background"); env.now += 121000; env.emit("active"); await env.flush();
  assert.ok(env.pad(), "La activación no elimina el bloqueo al salir más de dos minutos");
  env.configuration("enabled"); await env.flush(); assert.ok(env.pad(), "Un aviso de activación no abre una app que ya estaba bloqueada"); env.close();

  enabled = false;
  env = mount({ lockEnabledState: async () => enabled ? "enabled" : "disabled" }); await env.flush();
  enabled = true; env.configuration("enabled"); await env.flush();
  assert.equal(env.tree, null); assert.equal(env.requests.length, 0, "Activar con huella disponible tampoco pide otra autenticación inmediata"); env.close();

  let enabledAfterRestart = true;
  env = mount({ lockEnabledState: async () => enabledAfterRestart ? "enabled" : "disabled", usaHuella: async () => false });
  await env.flush(); assert.ok(env.pad(), "Arranque frío no hereda la confirmación de activación en memoria"); env.close();

  let status = "disabled", privacyReply;
  env = mount({ lockEnabledState: async () => status, usaHuella: async () => false }); await env.flush();
  status = "enabled"; privacyReply = deferred(); env.io.applyLockScreenPrivacy = () => privacyReply.promise;
  env.configuration("enabled"); await env.flush(); env.emit("background"); env.emit("active");
  privacyReply.resolve("confirmed"); await env.flush();
  assert.ok(env.pad(), "Salir durante la activación invalida la exención, aunque se vuelva antes de la respuesta"); env.close();

  const lockFileForEnable = "utils/appLock.ts", lockSourceForEnable = read(lockFileForEnable);
  const storage = new Map(), events = [];
  const enableOriginal = handlerOriginal(lockFileForEnable, "enableLock", {
    PIN_LENGTH: 4, KEY_SALT: "salt", KEY_HASH: "hash", KEY_ENABLED: "enabled",
    Crypto: { randomUUID: () => "fixture-salt" }, hashPin: async () => "fixture-hash",
    write: async (key, value) => { storage.set(key, value); },
    SecureStore: { getItemAsync: async key => storage.get(key) },
    lockEnabledState: async () => storage.get("enabled") === "1" ? "enabled" : "disabled",
    hasPin: async () => storage.has("hash"), notifyLockConfiguration: change => events.push(change),
  }, lockSourceForEnable);
  assert.equal(await enableOriginal("2468"), true);
  assert.deepEqual(events, ["enabled"], "Solo el guardado confirmado emite la activación, no una preferencia genérica");

  env = mount({}, false); await env.flush();
  assert.equal(env.requests.length, 0, "No pedir huella mientras Fino todavía carga los datos");
  env.context.ready = true; env.dirty = true; await env.flush();
  assert.equal(env.requests.length, 1, "Huella automática, sin tocar botón");
  assert.equal(env.pad(), undefined, "No mostrar teclado de PIN junto con la huella");
  env.emit("inactive"); await env.flush();
  env.context.t = key => key; env.dirty = true; await env.flush();
  assert.equal(env.requests.length, 1, "Redibujar/traducir/inactive no vuelve a pedir la huella");
  env.emit("active"); env.requests[0].resolve(true); await env.flush();
  assert.equal(env.tree, null); assert.deepEqual(env.pins, [], "Una huella correcta entra sin pedir PIN");
  env.emit("background"); env.now += 10000; env.emit("active"); await env.flush();
  assert.equal(env.tree, null, "Regreso breve respeta el margen existente");
  env.emit("background"); env.now += 121000; env.emit("active"); await env.flush();
  assert.equal(env.requests.length, 2); assert.equal(env.pad(), undefined, "Nuevo bloqueo empieza otra vez con huella sola");
  env.requests[1].resolve(false); await env.flush();
  assert.ok(env.pad(), "Cancelar/fallar huella lleva directamente al PIN");
  env.context.t = key => key; env.dirty = true; await env.flush();
  assert.equal(env.requests.length, 2, "El PIN no es interrumpido por otra petición automática");
  env.pad().props.onChange("1234"); await env.flush(); assert.equal(env.tree, null, "PIN correcto entra sin confirmar ni volver a pedir huella");
  env.close();

  env = mount(); env.appState.currentState = "background"; await env.flush();
  assert.equal(env.requests.length, 0, "No abrir autenticación desde segundo plano");
  env.emit("active"); await env.flush(); assert.equal(env.requests.length, 1, "Al volver puede pedir huella sin otro toque"); env.close();

  env = mount(); await env.flush();
  env.button("lock.usePin").props.onPress(); await env.flush();
  env.requests[0].resolve(true); await env.flush();
  assert.ok(env.pad(), "Una huella atrasada no abre después de elegir PIN");
  assert.equal(env.cancellations, 1);
  env.pad().props.onBiometric(); env.pad()?.props.onBiometric(); await env.flush();
  assert.equal(env.requests.length, 2, "Reintento manual único aun con doble toque");
  assert.equal(env.pad(), undefined); env.requests[1].reject(Error("native-error")); await env.flush();
  assert.ok(env.pad(), "Error del lector mantiene PIN como alternativa"); env.close();

  for (const overrides of [{ biometricKind: async () => "none" }, { usaHuella: async () => false }]) {
    env = mount(overrides); await env.flush(); assert.ok(env.pad()); assert.equal(env.requests.length, 0);
    env.pad().props.onChange("1234"); await env.flush(); assert.equal(env.tree, null); env.close();
  }
  env = mount({ lockEnabledState: async () => "unavailable" }); await env.flush();
  assert.equal(env.pad(), undefined); assert.equal(env.requests.length, 0); assert.ok(env.button("lock.retryCheck")); env.close();
  env = mount({ applyLockScreenPrivacy: async () => { throw Error("privacy-failed"); } }); await env.flush();
  assert.equal(env.requests.length, 0); assert.ok(env.tree); env.close();

  env = mount(); await env.flush(); env.configuration(); await env.flush();
  env.requests[0].resolve(true); await env.flush();
  assert.ok(env.tree, "Configuración cambiada invalida la respuesta anterior");
  assert.equal(env.requests.length, 2, "La nueva comprobación puede pedir su propia huella"); env.close();
  env = mount(); await env.flush(); env.emit("background"); env.requests[0].resolve(true); await env.flush();
  assert.ok(env.tree); assert.equal(env.remembered, 0, "Salir bloqueado no crea margen para saltar el candado"); env.close();
  env = mount(); await env.flush(); const oldReply = env.requests[0]; env.close(); oldReply.resolve(true); await env.flush();
  assert.ok(env.cover.at(-1), "Una respuesta después de desmontar no abre la app");

  const pendingPin = deferred(); let pendingAttempts = 0;
  env = mount({ usaHuella: async () => false, verifyPin: () => { pendingAttempts++; return pendingPin.promise; } }); await env.flush();
  env.pad().props.onChange("1234"); await env.flush();
  assert.equal(env.pad().props.disabled, true);
  env.pad().props.onChange("9999"); await env.flush(); assert.equal(pendingAttempts, 1, "PIN en curso no se comprueba dos veces");
  env.emit("background"); pendingPin.resolve("real"); await env.flush();
  assert.ok(env.tree, "El PIN que termina de comprobarse en segundo plano no abre la app"); env.close();

  let retry = 0, attempts = 0;
  env = mount({ usaHuella: async () => false, pinRetryAfterMs: async () => retry,
    verifyPin: async () => { attempts++; retry = attempts >= 5 ? 30000 : 0; return attempts >= 5 ? "locked" : null; } });
  await env.flush();
  for (let i = 0; i < 5; i++) { env.pad().props.onChange("9999"); await env.flush(); await env.tick(); }
  assert.equal(attempts, 5); assert.equal(env.pad().props.value, "", "Un fallo no deja cuatro cifras listas para reenviar automáticamente");
  assert.equal(env.pad().props.disabled, true, "Espera progresiva conserva teclado bloqueado");
  retry = 0; await env.tick(); assert.equal(attempts, 5, "Al terminar la espera no reenvía el PIN antiguo"); env.close();

  const lockFile = "utils/appLock.ts", lockSource = read(lockFile);
  let nativeOptions;
  const prompt = handlerOriginal(lockFile, "promptBiometrics", { LocalAuthentication: { authenticateAsync: async options => { nativeOptions = options; return { success: true }; } } }, lockSource);
  assert.equal(await prompt("Fino", "PIN"), true);
  assert.equal(nativeOptions.disableDeviceFallback, true, "No pedir además el PIN del teléfono");
  assert.equal(nativeOptions.requireConfirmation, false, "No solicitar una confirmación biométrica adicional");
  assert.equal(nativeOptions.fallbackLabel, "");
} finally { env?.close(); delete globalThis.__lockAlternative; }
console.log("Guardián/JSX y petición Expo originales: huella sola, PIN alternativo, cancelación/error, doble toque, relectura, fondo/regreso, PIN incorrecto/espera y respuestas atrasadas conservan el candado. React/Android adaptados, sin credenciales ni dinero reales; sensor físico pendiente.");

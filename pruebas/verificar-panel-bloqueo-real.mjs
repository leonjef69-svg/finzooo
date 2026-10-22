import assert from "node:assert/strict";
import ts from "typescript";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createSourceReader } from "./helpers/source-reader.mjs";

const require = createRequire(import.meta.url);
const read = createSourceReader({ revision: process.env.FINO_LOCK_SHEET_BASELINE });
const source = (file) => read(file).toString();
const file = "screens/AppLockSettings.tsx";
const ast = (file) => ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = (tree) => !tree || typeof tree !== "object" ? []
  : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};

// Las opciones originales del navegador, no una segunda pantalla simulada.
const layout = ast("app/_layout.tsx");
let lockScreen;
function findRoute(node) {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(layout) === "Stack.Screen") {
    const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
    const name = attrs.find(attr => attr.name.getText(layout) === "name");
    if (name?.initializer && ts.isStringLiteral(name.initializer) && name.initializer.text === "app-lock") {
      assert.equal(lockScreen, undefined, "Una sola ruta del panel de bloqueo");
      lockScreen = attrs.find(attr => attr.name.getText(layout) === "options");
    }
  }
  ts.forEachChild(node, findRoute);
}
findRoute(layout);
assert.ok(lockScreen, "La configuración debe declararse como panel inferior, no como la pantalla completa anterior");
const optionsCode = ts.transpile("return (" + lockScreen.initializer.expression.getText(layout) + ");", { target: ts.ScriptTarget.ES2022 });
const options = new Function("reducedMotion", optionsCode)(false);
assert.equal(options.presentation, "transparentModal");
assert.equal(options.animation, "slide_from_bottom");
assert.equal(options.contentStyle.backgroundColor, "transparent");
assert.equal(options.gestureEnabled, false, "El gesto nativo no debe saltar la protección de una operación en curso");

const lockNames = ["biometricKind", "disableLock", "enableLock", "isLockEnabled", "usaHuella", "guardarUsaHuella", "verifyPin", "pinRetryAfterMs"];
async function compile(file) {
  return (await build({ stdin: { contents: source(file), sourcefile: file, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, platform: "node", format: "cjs", jsx: "automatic", external: ["react/jsx-runtime"], write: false, logLevel: "silent",
    plugins: [{ name: "panel-adapters", setup(b) {
      b.onResolve({ filter: /^(react$|react-native$|react-native-safe-area-context$|lucide-react-native$|@\/)/ }, args => ({ path: args.path, namespace: "adapter" }));
      b.onLoad({ filter: /.*/, namespace: "adapter" }, args => {
        const code = args.path === "react" ? "export const {useCallback,useEffect,useLayoutEffect,useRef,useState}=globalThis.__lockSheet.hooks;"
          : args.path === "react-native" ? "export const BackHandler=globalThis.__lockSheet.backHandler; export const useWindowDimensions=()=>({height:800,width:390}); export const ScrollView='ScrollView',Text='Text',TouchableOpacity='TouchableOpacity',Pressable='Pressable',View='View';"
          : args.path === "react-native-safe-area-context" ? "export const useSafeAreaInsets=()=>({top:24,bottom:24});"
          : args.path === "lucide-react-native" ? "export const ChevronDown='ChevronDown',ChevronLeft='ChevronLeft',ChevronRight='ChevronRight',Fingerprint='Fingerprint',Info='Info',Lock='Lock',ScanFace='ScanFace',X='X';"
          : args.path.endsWith("appLock") ? `export const PIN_LENGTH=4; ${lockNames.map(name => `export const ${name}=(...args)=>globalThis.__lockSheet.io.${name}(...args);`).join("\n")}`
          : args.path.endsWith("AppDataContext") ? "export const useAppData=()=>globalThis.__lockSheet.context;"
          : args.path.endsWith("nav") ? "export const safeBack=()=>globalThis.__lockSheet.closed++; export const useRedirectIfOrphaned=()=>globalThis.__lockSheet.orphan; export const irUnaVez=(route)=>globalThis.__lockSheet.navigation.push(route);"
          : args.path.endsWith("lockState") ? "export const useAppLocked=()=>globalThis.__lockSheet.locked;"
          : args.path.endsWith("style") ? "export const CARD_SHADOW={};"
          : args.path.endsWith("AppLockSettings") ? "export default 'AppLockSettings';"
          : args.path.endsWith("PremiumLocked") ? "export default 'PremiumLocked';"
          : args.path.endsWith("PinPad") ? "export default 'PinPad';"
          : args.path.endsWith("Toggle") ? "export default 'Toggle';"
          : "export default function Stub(){return null;}";
        return { contents: code, loader: "js" };
      });
    } }] })).outputFiles[0].text;
}
const code = await compile(file);
const routeCode = await compile("app/app-lock.tsx");

// Ejecuta JSX, efectos y callbacks originales. Solo React, reloj y Android IO se adaptan.
// Ninguna credencial, preferencia o movimiento del dispositivo se lee o escribe.
function mount(overrides = {}, props = {}, compiled = code) {
  const slots = [], effects = [], cleanups = new Map(), timers = new Map();
  let index = 0, timerId = 0;
  const env = { closed: 0, navigation: [], calls: [], dirty: true, alive: true, orphan: false, locked: false,
    context: { t: key => key, isCloudSynced: false, isPremium: true }, io: {},
    backHandler: { addEventListener(_name, fn) { env.back = fn; return { remove() { if (env.back === fn) env.back = null; } }; } },
  };
  const equal = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const register = (fn, deps) => {
    const id = index++;
    if (!slots[id] || !equal(slots[id].deps, deps)) { slots[id] = { deps }; effects.push({ id, fn }); }
  };
  env.hooks = {
    useState(initial) { const id = index++; if (!(id in slots)) slots[id] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[id].value, next => { if (!env.alive) return; const value = typeof next === "function" ? next(slots[id].value) : next;
        if (!Object.is(slots[id].value, value)) { slots[id].value = value; env.dirty = true; } }]; },
    useRef(initial) { const id = index++; return slots[id] ??= { current: initial }; },
    useEffect: register, useLayoutEffect: register,
    useCallback(fn, deps) { const id = index++; if (!slots[id] || !equal(slots[id].deps, deps)) slots[id] = { deps, fn }; return slots[id].fn; },
  };
  env.io = {
    isLockEnabled: async () => true, biometricKind: async () => "none", usaHuella: async () => true,
    enableLock: async value => { env.calls.push(["enable", value]); return true; },
    disableLock: async () => { env.calls.push(["disable"]); return true; },
    verifyPin: async value => { env.calls.push(["verify", value]); return "real"; },
    guardarUsaHuella: async value => { env.calls.push(["biometric", value]); return true; },
    pinRetryAfterMs: async () => 0, ...overrides,
  };
  globalThis.__lockSheet = env;
  const module = { exports: {} };
  new Function("module", "exports", "require", "setTimeout", "clearTimeout", compiled)(module, module.exports, require,
    fn => { const id = ++timerId; timers.set(id, fn); return id; }, id => timers.delete(id));
  env.render = () => {
    globalThis.__lockSheet = env; env.dirty = false; index = 0;
    env.tree = module.exports.default({ onBack: () => { env.closed++; }, ...props });
    for (const { id, fn } of effects.splice(0)) { cleanups.get(id)?.(); cleanups.set(id, fn()); }
  };
  env.flush = async () => { for (let i = 0; i < 20; i++) { if (env.dirty && env.alive) env.render(); await new Promise(r => setImmediate(r)); }
    assert.ok(!env.dirty || !env.alive, "El panel debe estabilizar sus efectos"); };
  env.find = id => nodes(env.tree).find(node => node.props?.testID === id);
  env.pad = () => nodes(env.tree).find(node => node.type === "PinPad");
  env.toggle = label => nodes(env.tree).find(node => node.type === "Toggle" && node.props.label === label);
  env.text = key => nodes(env.tree).some(node => node.type === "Text" && node.props.children === key);
  env.tick = async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); await env.flush(); };
  env.close = () => { env.alive = false; for (const cleanup of cleanups.values()) cleanup?.(); timers.clear(); };
  return env;
}

let env;
try {
  env = mount(); await env.flush();
  const sheet = env.find("app-lock-settings-sheet");
  assert.ok(sheet, "El contenido original se dibuja en una sola superficie inferior");
  assert.equal(sheet.props.style.maxHeight, 752, "Altura acotada por ventana y zona segura, no pantalla completa");
  assert.ok(nodes(env.tree).some(node => node.type === "ScrollView"), "El PIN y la ayuda caben con scroll en pantallas cortas");
  assert.equal(env.pad(), undefined, "Abrir ajustes no pide autenticación ni presenta el teclado");
  assert.ok(env.text("lock.biometricUnavailable"), "Sin huella registrada se explica por qué solo aparece PIN");
  assert.deepEqual(env.calls, [], "Leer la configuración no modifica PIN ni preferencias");
  env.find("app-lock-settings-close").props.onPress(); await env.flush();
  assert.equal(env.closed, 1); assert.deepEqual(env.calls, []); env.close();

  env = mount(); await env.flush(); env.find("app-lock-settings-backdrop").props.onPress();
  assert.equal(env.closed, 1); assert.deepEqual(env.calls, []); env.close();

  const loading = deferred();
  env = mount({ isLockEnabled: () => loading.promise }); await env.flush();
  assert.equal(env.toggle("lock.rowLabel").props.disabled, true, "No habilitar un control con una lectura pendiente");
  env.toggle("lock.rowLabel").props.onChange(true); await env.flush(); assert.equal(env.pad(), undefined);
  env.find("app-lock-settings-close").props.onPress(); assert.equal(env.closed, 1); env.close();
  loading.resolve(false); await env.flush(); assert.deepEqual(env.calls, [], "Una lectura atrasada no activa ni escribe un candado");
  env = mount({ isLockEnabled: async () => { throw Error("read-unavailable"); } }); await env.flush();
  assert.equal(env.toggle("lock.rowLabel").props.disabled, true); assert.ok(env.text("lock.readError"));
  env.find("app-lock-settings-close").props.onPress(); assert.equal(env.closed, 1); assert.deepEqual(env.calls, []); env.close();

  // Salir o cancelar borradores nunca escribe el PIN a medio crear.
  env = mount({ isLockEnabled: async () => false }); await env.flush();
  env.toggle("lock.rowLabel").props.onChange(true); await env.flush();
  assert.ok(env.pad()); env.pad().props.onChange("2468"); await env.flush();
  assert.ok(env.text("lock.stepConfirm")); assert.equal(env.pad().props.value, ""); assert.deepEqual(env.calls, []);
  env.find("app-lock-settings-cancel").props.onPress(); await env.flush();
  assert.equal(env.pad(), undefined); assert.equal(env.closed, 0); assert.deepEqual(env.calls, []);
  env.toggle("lock.rowLabel").props.onChange(true); await env.flush();
  assert.equal(env.pad().props.value, ""); env.find("app-lock-settings-close").props.onPress();
  assert.equal(env.closed, 1); assert.deepEqual(env.calls, []); env.close();

  env = mount(); await env.flush(); env.toggle("lock.rowLabel").props.onChange(false); await env.flush();
  assert.ok(env.text("lock.stepVerify")); env.pad().props.onChange("24"); await env.flush();
  assert.equal(env.back(), true); await env.flush();
  assert.equal(env.pad(), undefined); assert.equal(env.closed, 0); assert.deepEqual(env.calls, []);
  assert.equal(env.back(), true); assert.equal(env.closed, 1); env.close();

  // No Pro no impide quitar un candado existente, pero no permite crear otro.
  env = mount({ isLockEnabled: async () => false }, { allowEnable: false }); await env.flush();
  env.toggle("lock.rowLabel").props.onChange(true); await env.flush();
  assert.equal(env.pad(), undefined); assert.deepEqual(env.calls, []); env.close();
  for (const [premium, enabled, settings] of [[true, false, true], [false, true, true], [false, false, false]]) {
    env = mount({ isLockEnabled: async () => enabled }, {}, routeCode); env.context.isPremium = premium; await env.flush();
    const body = nodes(env.tree).find(node => node.type === "AppLockSettings");
    assert.equal(Boolean(body), settings, "La ruta conserva acceso Pro o gestión de candado ya existente");
    if (body) assert.equal(body.props.allowEnable, premium); env.close();
  }
  env = mount({}, {}, routeCode); env.locked = true; await env.flush();
  assert.equal(env.tree, null, "La configuración se oculta al aparecer la cubierta del candado"); env.close();

  env = mount({ isLockEnabled: async () => false }); await env.flush();
  env.toggle("lock.rowLabel").props.onChange(true); await env.flush();
  env.pad().props.onChange("2468"); await env.flush(); env.pad().props.onChange("1357"); await env.flush();
  assert.deepEqual(env.calls, [], "Dos PIN diferentes no activan ni guardan el candado"); assert.ok(env.text("lock.mismatch"));
  await env.tick(); assert.ok(env.text("lock.stepCreate")); assert.equal(env.pad().props.value, ""); env.close();

  env = mount({ verifyPin: async value => { env.calls.push(["verify", value]); return null; } }); await env.flush();
  env.toggle("lock.rowLabel").props.onChange(false); await env.flush(); env.pad().props.onChange("2468"); await env.flush();
  assert.deepEqual(env.calls, [["verify", "2468"]]); await env.tick(); assert.equal(env.pad().props.value, "");
  assert.equal(env.toggle("lock.rowLabel"), undefined, "Un PIN incorrecto permanece en comprobación, nunca desactiva");
  env.find("app-lock-settings-cancel").props.onPress(); await env.flush(); assert.equal(env.toggle("lock.rowLabel").props.on, true); env.close();

  for (const failure of [false, "throw"]) {
    env = mount({ isLockEnabled: async () => false, enableLock: async () => { if (failure === "throw") throw Error("save-failed"); return false; } }); await env.flush();
    env.toggle("lock.rowLabel").props.onChange(true); await env.flush();
    env.pad().props.onChange("2468"); await env.flush(); env.pad().props.onChange("2468"); await env.flush();
    assert.ok(env.text("lock.saveFailed")); assert.equal(env.pad().props.disabled, false, "Un fallo de guardado libera el panel sin anunciar activación");
    env.find("app-lock-settings-cancel").props.onPress(); await env.flush(); assert.equal(env.toggle("lock.rowLabel").props.on, false); env.close();
  }

  // Guardado iniciado: los controles de cierre no deben retirarlo a medias.
  const saved = deferred(); let writes = 0;
  env = mount({ isLockEnabled: async () => false, enableLock: () => { writes++; return saved.promise; } }); await env.flush();
  env.toggle("lock.rowLabel").props.onChange(true); await env.flush();
  env.pad().props.onChange("2468"); await env.flush(); env.pad().props.onChange("2468"); await env.flush();
  assert.equal(writes, 1); assert.equal(env.pad().props.disabled, true);
  env.find("app-lock-settings-close").props.onPress(); env.find("app-lock-settings-backdrop").props.onPress(); env.back(); await env.flush();
  assert.equal(env.closed, 0, "Ningún cierre descarta la respuesta de un guardado iniciado"); assert.equal(writes, 1);
  saved.resolve(true); await env.flush(); assert.equal(env.pad(), undefined); assert.equal(env.toggle("lock.rowLabel").props.on, true); env.close();

  const preference = deferred(); let changes = 0;
  env = mount({ biometricKind: async () => "fingerprint", guardarUsaHuella: () => { changes++; return preference.promise; } }); await env.flush();
  const choice = env.toggle("lock.usarHuella"); assert.ok(choice); assert.equal(choice.props.on, true); assert.deepEqual(env.calls, []);
  choice.props.onChange(false); choice.props.onChange(false); await env.flush();
  assert.equal(changes, 1, "Doble toque solo guarda una preferencia biométrica");
  env.find("app-lock-settings-close").props.onPress(); env.back(); assert.equal(env.closed, 0);
  preference.resolve(); await env.flush(); assert.equal(env.toggle("lock.usarHuella").props.on, false); env.close();

  const verified = deferred(); let checks = 0;
  env = mount({ verifyPin: () => { checks++; return verified.promise; } }); await env.flush();
  env.toggle("lock.rowLabel").props.onChange(false); await env.flush(); env.pad().props.onChange("2468"); await env.flush();
  assert.equal(checks, 1); assert.equal(env.pad().props.disabled, true);
  env.find("app-lock-settings-close").props.onPress(); env.back(); await env.flush(); assert.equal(env.closed, 0);
  verified.resolve("real"); await env.flush(); assert.deepEqual(env.calls, [["disable"]]); assert.equal(env.toggle("lock.rowLabel").props.on, false); env.close();

  // La cubierta de seguridad sigue siendo un Modal opaco no descartable; el
  // recorrido de huella/PIN y privacidad se ejecuta en sus regresiones existentes.
  const gateAst = ast("components/AppLockGate.tsx"); let gateModal;
  function findGateModal(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(gateAst) === "Modal") gateModal = node;
    ts.forEachChild(node, findGateModal);
  }
  findGateModal(gateAst); assert.ok(gateModal);
  const gateAttrs = gateModal.attributes.properties.filter(ts.isJsxAttribute);
  assert.ok(!gateAttrs.some(attr => attr.name.getText(gateAst) === "transparent"), "El candado nunca hereda la transparencia del panel");
  const onClose = gateAttrs.find(attr => attr.name.getText(gateAst) === "onRequestClose");
  const closeCode = ts.transpile("return (" + onClose.initializer.expression.getText(gateAst) + ");", { target: ts.ScriptTarget.ES2022 });
  assert.equal(new Function(closeCode)()(), undefined, "Atrás no descarta la cubierta de seguridad");

  const catalog = { exports: {} };
  new Function("exports", ts.transpile(source("constants/i18n.ts"), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(catalog.exports);
  const graceMinutes = Number(source("utils/appLock.ts").match(/export const GRACE_MS = ([\d_]+)/)[1].replaceAll("_", "")) / 60000;
  for (const [lang, preserve] of [["es", /no desinstales/], ["en", /do not uninstall/], ["pt", /não desinstale/]]) {
    const texts = catalog.exports.translations[lang];
    assert.ok(texts["lock.biometricUnavailable"], lang + ": nota biométrica disponible");
    assert.match(texts["lock.graceNote"], new RegExp(`\\b${graceMinutes}\\b`), "La ayuda coincide con el margen real, no uno antiguo");
    assert.match(texts["lock.warnWithCloud"], preserve, "Tener una copia no permite recomendar borrar datos locales");
    assert.match(texts["lock.warnNoCloud"], preserve, "Sin copia se conserva también el teléfono sin desinstalar");
  }
} finally { env?.close(); delete globalThis.__lockSheet; }
console.log("Panel original: presentación inferior, lectura sin escritura, cierres y cancelación de borradores, PIN confirmado/verificado con cierres inhibidos y acceso Pro comprobados con React/Android adaptados; candado opaco conservado. Sin datos reales.");

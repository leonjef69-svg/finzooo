import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const baseline = process.env.FINO_TEST_SCREEN_PRIVACY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresion exige un hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const gate = read("components/AppLockGate.tsx");
assert.ok(/await applyLockScreenPrivacy\(status\)/.test(gate), "El candado confirma la proteccion antes de quitar la cubierta inicial");
const result = await build({ stdin: { contents: read("utils/screenPrivacy.ts"), sourcefile: "screenPrivacy.ts", loader: "ts", resolveDir: process.cwd() },
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", plugins: [{ name: "native-io", setup(b) {
    b.onResolve({ filter: /^expo$|^react-native$/ }, args => ({ path: args.path, namespace: "mock" }));
    b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: args.path === "expo"
      ? "export function requireOptionalNativeModule(){return globalThis.__screenNative;}"
      : "export const Platform={OS:'android'};", loader: "js" }));
  } }] });
let calls = [];
globalThis.__screenNative = { setProtected: async value => { calls.push(value); return true; } };
function load() { const module = { exports: {} }; new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require); return module.exports; }
try {
  const api = load();
  for (const status of ["enabled", "unavailable", "disabled"]) await api.applyLockScreenPrivacy(status);
  assert.deepEqual(calls, [true, true, false]);
  globalThis.__screenNative.setProtected = async () => false;
  await assert.rejects(api.applyLockScreenPrivacy("enabled"), /screen-privacy-unconfirmed/);
  globalThis.__screenNative.setProtected = async () => { throw Error("native-failure"); };
  await assert.rejects(api.applyLockScreenPrivacy("enabled"), /native-failure/);
  globalThis.__screenNative = null;
  assert.equal(await load().applyLockScreenPrivacy("enabled"), "unsupported", "Un APK anterior no se anuncia como protegido ni rompe la importacion");
} finally { delete globalThis.__screenNative; }

// Ejecuta los efectos y componentes ORIGINALES, no una copia del flujo.
// Los hooks/ventana son adaptadores: no se anuncia como recorrido de Android.
const lockExports = ["lockEnabledState", "subscribeLockConfiguration", "salioHaceNada", "usaHuella", "biometricKind",
  "olvidarSalida", "pinRetryAfterMs", "promptBiometrics", "recordarSalida", "verifyPin"];
async function componentCode(file) {
  const compiled = await build({ stdin: { contents: read(file), sourcefile: file, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, platform: "node", format: "cjs", jsx: "automatic", write: false, logLevel: "silent",
    external: ["react/jsx-runtime"], plugins: [{ name: "component-io", setup(b) {
      b.onResolve({ filter: /^(react$|react-native$|react-native-safe-area-context$|lucide-react-native$|@\/)/ }, args => ({ path: args.path, namespace: "test-io" }));
      b.onLoad({ filter: /.*/, namespace: "test-io" }, args => {
        let contents;
        if (args.path === "react") contents = "export const {useCallback,useEffect,useLayoutEffect,useRef,useState}=globalThis.__gate.hooks;";
        else if (args.path === "react-native") contents = "export const AppState={addEventListener:()=>({remove(){}})}; export const Modal='Modal',ScrollView='ScrollView',Text='Text',TouchableOpacity='TouchableOpacity',View='View';";
        else if (args.path === "react-native-safe-area-context") contents = "export const useSafeAreaInsets=()=>({top:0,bottom:0});";
        else if (args.path === "lucide-react-native") contents = "export const Lock='Lock';";
        else if (args.path.endsWith("appLock")) contents = `export const GRACE_MS=120000,PIN_LENGTH=4; ${lockExports.map(name => `export const ${name}=(...args)=>globalThis.__gate.io.${name}(...args);`).join("\n")}`;
        else if (args.path.endsWith("screenPrivacy")) contents = "export const applyLockScreenPrivacy=(...args)=>globalThis.__gate.io.applyLockScreenPrivacy(...args);";
        else if (args.path.endsWith("lockState")) contents = "export const setAppLocked=(v)=>globalThis.__gate.cover.push(v); export const useAppLocked=()=>globalThis.__gate.modalLocked;";
        else if (args.path.endsWith("AppDataContext")) contents = "export const useAppData=()=>({t:(s)=>s,ready:false});";
        else contents = "export default function Stub(){return null;}";
        return { contents, loader: "js" };
      });
    } }] });
  return compiled.outputFiles[0].text;
}
const gateCode = await componentCode("components/AppLockGate.tsx");
function mount(io = {}, initial = []) {
  const state = [], effects = [], cover = [];
  let index = 0;
  const env = { state, effects, cover, modalLocked: false, io: {
    lockEnabledState: async () => "disabled", applyLockScreenPrivacy: async () => "confirmed",
    salioHaceNada: async () => false, usaHuella: async () => false, biometricKind: async () => "none",
    olvidarSalida: async () => {}, subscribeLockConfiguration: callback => { env.configuration = callback; return () => {}; }, ...io,
  }, hooks: {
    useState(value) { const id = index++; state[id] = id in initial ? initial[id] : value;
      return [state[id], next => { state[id] = typeof next === "function" ? next(state[id]) : next; }]; },
    useEffect(fn) { effects.push(fn); }, useLayoutEffect(fn) { effects.push(fn); },
    useCallback(fn) { return fn; }, useRef(value) { return { current: value }; },
  } };
  globalThis.__gate = env;
  const module = { exports: {} };
  new Function("module", "exports", "require", gateCode)(module, module.exports, require);
  env.element = module.exports.default();
  env.check = effects.find(fn => fn.toString().includes("applyLockScreenPrivacy"));
  assert.ok(env.check, "Se ejecuta el efecto original de comprobacion");
  return env;
}
const settle = () => new Promise(resolve => setImmediate(resolve));
try {
  let confirm;
  let env = mount({ applyLockScreenPrivacy: () => new Promise(resolve => { confirm = resolve; }) });
  env.check(); await settle();
  assert.equal(env.state[1], false, "No quita la cubierta mientras Android no confirme");
  confirm("confirmed"); await settle();
  assert.equal(env.state[1], true);
  assert.equal(env.state[4], false, "Candado apagado no exige PIN");
  env = mount({ lockEnabledState: async () => "enabled", applyLockScreenPrivacy: async () => { throw Error("native-failure"); } });
  env.check(); await settle();
  assert.equal(env.state[2], true); assert.equal(env.state[4], true); assert.equal(env.state[1], true);
  env = mount({ lockEnabledState: async () => "unavailable", applyLockScreenPrivacy: async status => { assert.equal(status, "unavailable"); } });
  env.check(); await settle();
  assert.equal(env.state[2], true); assert.equal(env.state[4], true);
  let readReply;
  let nativeCalls = 0;
  env = mount({ lockEnabledState: () => new Promise(resolve => { readReply = resolve; }),
    applyLockScreenPrivacy: async () => { nativeCalls++; } });
  const cleanup = env.check(); cleanup(); readReply("disabled"); await settle();
  assert.equal(nativeCalls, 0, "Lectura cancelada no apaga proteccion de una configuracion nueva");
  env = mount();
  env.effects.find(fn => fn.toString().includes("subscribeLockConfiguration"))();
  env.configuration();
  assert.deepEqual(env.cover, [true]); assert.equal(env.state[1], false); assert.equal(env.state[3], 1);
  assert.equal(env.element.key, "0-checking");
  env = mount({}, [true, true, false, 0, true]);
  assert.equal(env.element.key, "0-checked", "Modal del PIN se recrea despues de aplicar FLAG_SECURE");
  const modalCode = await componentCode("components/PrivateModal.tsx");
  const module = { exports: {} };
  new Function("module", "exports", "require", modalCode)(module, module.exports, require);
  env.modalLocked = true;
  assert.equal(module.exports.default({ visible: true, children: "Saldo" }), null);
  env.modalLocked = false;
  const modal = module.exports.default({ visible: true, children: "Saldo", onRequestClose: cleanup });
  assert.equal(modal.type, "Modal"); assert.equal(modal.props.children, "Saldo");
  assert.equal(modal.props.onRequestClose, cleanup);
  for (const file of ["components/ConfirmDialog.tsx", "components/MonthSelector.tsx", "components/SpaceInvitationSheet.tsx",
    "components/SpaceMembersSheet.tsx", "components/SpaceMovementControls.tsx", "components/SpaceMovementSheet.tsx", "screens/Home.tsx", "screens/Cajas.tsx"]) {
    assert.ok(read(file).includes('from "@/components/PrivateModal"'), `${file}: panel financiero debe respetar el candado`);
  }
} finally { delete globalThis.__gate; }
console.log("Candado original: confirmacion nativa, errores, lectura cancelada, cambios y paneles privados comprobados. Kotlin/Android fisico por separado; APK anterior sin soporte identificado.");

import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_NOTIFICATION_CONSENT_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
function execute(file, imports, source = read(file)) {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported = {};
  new Function("require", "exports", code)(name => {
    assert.ok(name in imports, `Import sin adaptar: ${name}`);
    return imports[name];
  }, exported);
  return exported;
}

// Ejecutar los manejadores originales actuales/anteriores con IO observable.
// No sustituirlos por una simulación de la regla de consentimiento.
for (const name of ["openAutoCaptureSettings", "setAutoCaptureOn"]) {
  const calls = [], session = { current: 4 }, user = { uid: "A" };
  const dependencies = {
    ready: true, hasOnboarded: true, isPremium: true, uid: "A", auth: { currentUser: user }, localSessionVersion: session,
    t: key => key, showToast() {},
    notificationReader: { openPermissionSettings: () => calls.push("android"), setEnabled: () => calls.push("enabled"), isEnabled: () => true, clear() {} },
    setAutoCaptureOnState() {},
    requestNotificationConsent: (_t, action, current) => calls.push({ action, current }),
  };
  handlerOriginal("contexts/AppDataContext.tsx", name, dependencies, read("contexts/AppDataContext.tsx"))(true);
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0], "object", `${name} accede/activa antes del aviso`);
  assert.equal(calls[0].current(), true);
  session.current++;
  assert.equal(calls[0].current(), false, "Una aceptación atrasada no vale para otra sesión");
}

const prompts = [], actions = [];
let consent = false, supported = true, canSave = true, current = true;
const reader = {
  get hasPrivacyProtection() { return supported; },
  hasDisclosureConsent: () => consent,
  acceptDisclosureConsent: () => { actions.push("save"); consent = canSave; return consent; },
};
const { requestNotificationConsent: request } = execute("utils/notificationConsent.ts", {
  "react-native": { Alert: { alert: (...args) => prompts.push(args) } },
  "@/modules/notification-reader": reader,
});
const ask = () => request(key => key, () => actions.push("continue"), () => current);
ask(); ask(); assert.equal(prompts.length, 1, "Toques repetidos no apilan avisos");
prompts.at(-1)[3].onDismiss(); assert.deepEqual(actions, []);
ask(); prompts.at(-1)[2][0].onPress(); assert.deepEqual(actions, []);
ask(); current = false; prompts.at(-1)[2][1].onPress(); assert.deepEqual(actions, []);
current = true; canSave = false; ask(); prompts.at(-1)[2][1].onPress();
assert.deepEqual(actions, ["save"], "No continuar si falla el guardado");
canSave = true; ask(); prompts.at(-1)[2][1].onPress();
assert.deepEqual(actions, ["save", "save", "continue"]);
ask(); assert.equal(actions.at(-1), "continue"); assert.equal(actions.filter(x => x === "save").length, 2);
supported = false; const before = actions.length; ask(); assert.equal(actions.length, before);

// El puente tampoco enciende ni abre permisos sin la confirmación nativa.
let nativeConsent = false, nativeEnabled = true;
const nativeCalls = [];
const native = {
  hasDisclosureConsent: () => nativeConsent,
  acceptDisclosureConsent: () => { nativeConsent = true; },
  isEnabled: () => nativeEnabled,
  setEnabled: value => { nativeEnabled = value; nativeCalls.push("enable"); },
  openPermissionSettings: () => nativeCalls.push("android"),
};
const bridge = execute("modules/notification-reader/index.ts", {
  expo: { requireOptionalNativeModule: () => native },
  "react-native": { Platform: { OS: "android" } },
});
assert.equal(bridge.isEnabled(), false);
bridge.openPermissionSettings(); bridge.setEnabled(true); assert.deepEqual(nativeCalls, []);
assert.equal(bridge.acceptDisclosureConsent(), true);
bridge.openPermissionSettings(); bridge.setEnabled(true); assert.deepEqual(nativeCalls, ["android", "enable"]);
const oldBridge = execute("modules/notification-reader/index.ts", {
  expo: { requireOptionalNativeModule: () => ({ isEnabled: () => true }) },
  "react-native": { Platform: { OS: "android" } },
});
assert.equal(oldBridge.isEnabled(), false, "Un APK anterior no se presenta como protegido");
const { translations } = execute("constants/i18n.ts", {});
for (const language of ["es", "en", "pt"]) {
  const text = translations[language]["autoCapture.consentBody"];
  assert.ok(text.includes("Firebase (Google)") && text.includes("Pro") && text.includes("Yape"));
  assert.doesNotMatch(translations[language]["autoCapture.privacyBody"], /Nada sale|Nothing leaves|Nada sai/);
}
const listener = read("modules/notification-reader/android/src/main/java/com/finzo/notificationreader/FinzoNotificationListener.kt");
const nativeFilter = listener.indexOf('if (NotificationPrivacy.isSecurityNotice(title, "$text $bigText")) return');
assert.ok(nativeFilter > 0 && nativeFilter < listener.indexOf("val item = JSONObject()"), "Filtrar ambos textos antes de crear/guardar/anunciar el aviso");
const module = read("modules/notification-reader/android/src/main/java/com/finzo/notificationreader/NotificationReaderModule.kt");
assert.match(module, /Function\("openPermissionSettings"\)\s*\{\s*check\(NotificationStore\.hasDisclosureConsent/);
console.log("Avisos: manejadores/puente originales y consentimiento explícito, cancelación, sesión, fallo, repetición, APK antiguo y tres idiomas comprobados. No Android real.");

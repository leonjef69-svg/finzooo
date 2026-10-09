import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_ENTRY_OPERATION_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const calls = [], messages = [];
let release;
const values = {
  verificationBusy: { current: false }, checking: false, resending: false, setChecking() {}, setResending() {}, setMessage: value => messages.push(value),
  onCheckAgain: async () => { calls.push("check"); await new Promise(resolve => { release = resolve; }); return false; },
  onResend: async () => calls.push("resend"), onLogout: async () => { throw new Error("logout-test"); }, t: key => key, firebaseErrorMessage: code => code,
};
const handler = name => handlerOriginal("screens/VerifyEmail.tsx", name, values, source("screens/VerifyEmail.tsx"));
const pending = handler("handleCheck")();
const duplicate = handler("handleCheck")();
const resend = handler("handleResend")();
assert.deepEqual(calls, ["check"], "verificar y reenviar no se duplican antes del próximo dibujado");
release(); await Promise.all([pending, duplicate, resend]); assert.equal(values.verificationBusy.current, false);
values.onCheckAgain = async () => { throw Object.assign(new Error("cuenta-protegida"), { name: "LocalAccountAccessError" }); };
await handler("handleCheck")(); assert.equal(messages.at(-1), "cuenta-protegida");
await handler("handleLogout")(); assert.equal(messages.at(-1), "verifyEmail.logoutFailed"); assert.equal(values.verificationBusy.current, false);

const resetCalls = [], reset = { authBusy: { current: false }, email: " synthetic@hotmail.com ", auth: {}, t: key => key, withTimeout: promise => promise,
  Alert: { alert: (...args) => resetCalls.push(args) }, firebaseErrorMessage: () => "reset-error", sendPasswordResetEmail: async (_, email) => { resetCalls.push(email); await new Promise(resolve => { release = resolve; }); } };
const forgot = () => handlerOriginal("screens/Login.tsx", "forgotPassword", reset, source("screens/Login.tsx"))();
const resetPending = forgot(); await forgot(); assert.equal(resetCalls.filter(item => typeof item === "string").length, 1);
release(); await resetPending; assert.equal(reset.authBusy.current, false);
assert.equal(resetCalls[0], "synthetic@hotmail.com");

// Árbol de los componentes originales: operaciones/fondo, no rediseño ni medidas nativas.
const React = { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...node.children.flat(Infinity).flatMap(flatten)];
const dependencies = { React, ActivityIndicator: "Spinner", View: "View", Text: "Text", Image: "Image", ScrollView: "ScrollView", KeyboardAvoidingView: "KeyboardAvoidingView", StatusBar: "StatusBar", Wallet: "Wallet", TouchableOpacity: "TouchableOpacity", AuthField: "AuthField", AuthLegalAcceptance: "AuthLegalAcceptance", GoogleButton: "GoogleButton", OrDivider: "OrDivider",
  Platform: { OS: "android" }, useSafeAreaInsets: () => ({ top: 24, bottom: 24 }), useWindowDimensions: () => ({ height: 480 }), useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect() {}, Keyboard: { addListener: () => ({ remove() {} }) }, useAppData: () => ({ t: key => key, showToast() {} }), require: () => "original-image" };
for (const [file, name] of [["screens/Login.tsx", "Login"], ["screens/Register.tsx", "Register"]]) {
  const tree = flatten(handlerOriginal(file, name, dependencies, source(file))({ onLoggedIn() {}, onGoRegister() {}, onRegistered() {}, onGoogleSignedIn() {}, onGoLogin() {} }));
  const scroll = tree.find(node => node.type === "ScrollView");
  assert.equal(scroll.props.contentContainerStyle.flexGrow, 1);
  assert.equal(scroll.props.contentContainerStyle.paddingBottom, 0, "sin hueco oscuro debajo de la ficha");
  assert.notEqual(scroll.props.scrollEnabled, false, "no encierra contenido en pantallas altas o con letra grande");
  const image = tree.find(node => node.type === "Image");
  assert.ok(image.props.style.transform.every(item => item.translateY === undefined));
}
const navCalls = [];
handlerOriginal("utils/entryNavigation.ts", "switchEntryRoute", { Keyboard: { dismiss: () => navCalls.push("keyboard") }, reemplazarUnaVez: path => navCalls.push(path) })("/register");
assert.deepEqual(navCalls, ["keyboard", "/register"]);
console.log("Originales/IO y JSX adaptados: verificación y reset únicos, errores protegidos, salida fallida, scroll y fondo sin hueco, teclado antes de cambiar. Android y cuentas reales pendientes.");

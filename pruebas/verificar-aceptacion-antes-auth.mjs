import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_LEGAL_AUTH_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const file = revision ? "screens/Register.tsx" : "screens/Login.tsx";
const action = revision ? "submit" : "registerSubmit";
const calls = [], errors = [];
const dependencies = {
  beginEntryOperation: () => () => true, withTimeout: promise => promise,
  recordLegalAcceptanceForCurrentAccount: async () => calls.push("receipt"),
  authBusy: { current: false }, legalAccepted: false, t: key => key,
  name: "Ana Torres", email: "ana@example.test", pass: "pass-test-only",
  auth: { currentUser: null }, createdUser: { current: null }, verificationSent: { current: false },
  setGoogleError() {}, setErrors: value => errors.push(value), setLoading() {},
  showToast: value => errors.push(value), firebaseErrorMessage: () => "auth-failure",
  createUserWithEmailAndPassword: async () => { calls.push("create"); const user = { uid: "uid-test" }; dependencies.auth.currentUser = user; return { user }; },
  updateProfile: async () => calls.push("profile"), sendEmailVerification: async () => calls.push("verify"),
  onRegistered: async () => calls.push("registered"),
};
const run = () => handlerOriginal(file, action, dependencies, source(file))();
await run();
assert.deepEqual(calls, [], "sin marcar no inicia el alta por correo");
assert.equal(errors.at(-1).general, "auth.legalRequired");
dependencies.legalAccepted = true;
await run(); assert.deepEqual(calls, ["create", "receipt", "profile", "verify", "registered"]);
calls.length = 0; dependencies.email = "invalid";
await run(); assert.deepEqual(calls, [], "aceptar no salta la validación");
dependencies.email = "ana@example.test"; dependencies.createdUser.current = null;
dependencies.verificationSent.current = false;
dependencies.recordLegalAcceptanceForCurrentAccount = async () => { calls.push("receipt-failed"); throw new Error("disk-error"); };
await run();
assert.deepEqual(calls, ["create", "receipt-failed"], "fallo de recibo no abre datos, modifica perfil ni envía verificación");
assert.equal(errors.at(-1).general, "register.accountCreatedRetry");
dependencies.recordLegalAcceptanceForCurrentAccount = async () => calls.push("receipt");
await run();
assert.equal(calls.filter(value => value === "create").length, 1, "reintento termina la cuenta ya creada");
assert.equal(calls.at(-1), "registered");
assert.equal(dependencies.authBusy.current, false);

// Componente JSX original con árbol/adaptadores, no dispositivo ni TalkBack.
const changes = [], routes = [];
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const component = handlerOriginal("components/AuthLegalAcceptance.tsx", "AuthLegalAcceptance", {
  React, Text: "Text", View: "View", TouchableOpacity: "TouchableOpacity", LEGAL_LAST_UPDATED: "8 de octubre de 2026", irUnaVez: path => routes.push(path),
});
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...node.children.flat(Infinity).flatMap(flatten)];
for (const accepted of [false, true]) {
  const tree = flatten(component({ accepted, onChange: value => changes.push(value), disabled: false, t: key => key }));
  const checkbox = tree.find(node => node.props.accessibilityRole === "checkbox");
  assert.equal(checkbox.props.accessibilityState.checked, accepted);
  assert.equal(checkbox.props.style.minHeight, 48);
  checkbox.props.onPress(); assert.equal(changes.at(-1), !accepted);
  const link = tree.find(node => node.props.accessibilityRole === "link");
  link.props.onPress(); assert.equal(routes.at(-1), "/legal");
}
const busyTree = flatten(component({ accepted: true, onChange() {}, disabled: true, t: key => key }));
assert.ok(busyTree.filter(node => node.props.accessibilityRole === "link" || node.props.accessibilityRole === "checkbox").every(node => node.props.disabled));
for (const file of ["screens/Login.tsx"]) {
  const text = source(file);
  assert.ok(text.includes("[legalAccepted, setLegalAccepted] = useState(false)"), "casilla nunca premarcada; contrato estático");
  assert.ok(text.includes("<AuthLegalAcceptance"), "conexión de la pantalla; contrato estático");
}
console.log("Registro por correo original/IO: aceptación previa, validación y recibo obligatorio; fallo/reintento sin repetir alta. Casilla/enlace originales. Google único se comprueba en sus suites propias, no consentimiento jurídico ni Android.");

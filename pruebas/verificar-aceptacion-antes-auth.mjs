import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_LEGAL_AUTH_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const paths = [
  ["screens/Register.tsx", "submit"],
  ["screens/Register.tsx", "registerWithGoogle"],
  ["screens/Login.tsx", "loginWithGoogle"],
];

for (const [file, name] of paths) {
  const calls = [], errors = [], authBusy = { current: false };
  let pendingResolve;
  const dependencies = {
    withTimeout: promise => promise, recordLegalAcceptanceForCurrentAccount: async () => { calls.push("receipt"); }, showToast: value => errors.push(value),
    authBusy, legalAccepted: false, t: key => key,
    name: "Ana Torres", email: "ana@example.test", pass: "pass-test-only", auth: { currentUser: null }, createdUser: { current: null }, verificationSent: { current: false },
    setGoogleError: value => errors.push(value), setErrors: value => errors.push(value), setError: value => errors.push(value),
    setLoading: value => calls.push(["loading", value]), setGoogleLoading: value => calls.push(["googleLoading", value]),
    createUserWithEmailAndPassword: async () => { calls.push("create"); const user = { uid: "uid-test" }; dependencies.auth.currentUser = user; return { user }; },
    updateProfile: async () => calls.push("profile"), sendEmailVerification: async () => calls.push("verify"),
    signInWithGoogle: async () => { calls.push("google"); if (pendingResolve === null) await new Promise(resolve => { pendingResolve = resolve; }); },
    onRegistered: async () => calls.push("registered"), onGoogleSignedIn: async () => calls.push("signed"),
    onLoggedIn: async () => calls.push("logged"), GoogleSignInCancelled: class extends Error {},
    googleSignInErrorMessage: () => "google-failure", firebaseErrorMessage: () => "auth-failure",
  };
  await handlerOriginal(file, name, dependencies, source(file))();
  assert.deepEqual(calls, [], `${file}:${name}: sin marcar no inicia Auth, perfil, verificación ni navegación`);
  assert.ok(errors.some(value => value === "auth.legalRequired" || value.general === "auth.legalRequired"));
  assert.equal(authBusy.current, false);

  dependencies.legalAccepted = true;
  await handlerOriginal(file, name, dependencies, source(file))();
  if (name === "submit") {
    assert.deepEqual(calls.filter(value => typeof value === "string"), ["create", "receipt", "profile", "verify", "registered"]);
    calls.length = 0; dependencies.email = "invalid";
    await handlerOriginal(file, name, dependencies, source(file))();
    assert.deepEqual(calls, [], "aceptar no salta la validación del correo");
  } else {
    assert.deepEqual(calls.filter(value => typeof value === "string"), ["google", "receipt", file.includes("Register") ? "signed" : "logged"]);
    calls.length = 0; pendingResolve = null;
    const handler = handlerOriginal(file, name, dependencies, source(file));
    const pending = handler(); await handler();
    assert.equal(calls.filter(value => value === "google").length, 1, "aceptación no rompe el bloqueo de doble toque");
    pendingResolve(); await pending;
    dependencies.signInWithGoogle = async () => { throw new dependencies.GoogleSignInCancelled(); };
    calls.length = 0; await handlerOriginal(file, name, dependencies, source(file))();
    assert.equal(authBusy.current, false, "cancelar Google libera el bloqueo sin navegar");
    assert.equal(calls.filter(value => typeof value === "string").length, 0);
  }
  calls.length = 0; errors.length = 0; dependencies.email = "ana@example.test";
  dependencies.createdUser.current = null; dependencies.verificationSent.current = false;
  dependencies.signInWithGoogle = async () => { calls.push("google"); };
  dependencies.recordLegalAcceptanceForCurrentAccount = async () => { calls.push("receipt-failed"); throw new Error("disk-error"); };
  await handlerOriginal(file, name, dependencies, source(file))();
  assert.equal(calls.filter(value => value === "create" || value === "google").length, 1, "fallo local no repite Auth exitoso");
  assert.ok(errors.includes("legal.saveFailed"), "no anuncia aceptación guardada ante fallo");
  assert.ok(calls.includes(name === "submit" ? "registered" : file.includes("Register") ? "signed" : "logged"), "acceso válido no queda atrapado por un recibo fallido");
}

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
for (const file of ["screens/Register.tsx", "screens/Login.tsx"]) {
  const text = source(file);
  assert.ok(text.includes("[legalAccepted, setLegalAccepted] = useState(false)"), "casilla nunca premarcada; contrato estático");
  assert.ok(text.includes("<AuthLegalAcceptance"), "conexión de la pantalla; contrato estático");
}
console.log("Originales con IO/JSX adaptado: tres altas bloqueadas sin aceptación, recibo tras Auth sin repetir altas ante fallo, validación, doble toque/cancelación y casilla/enlace. Persistencia real probada aparte; no consentimiento jurídico ni Android.");

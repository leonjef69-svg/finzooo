import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { entryUIFixture } from "./helpers/entry-ui-fixture.mjs";

// Formularios/manejadores/ruta originales; React, animación y SDK adaptados.
// No envía formularios reales ni acredita render, FPS o selector Google nativo.
const revision = process.env.FINO_UNIFIED_ENTRY_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw Error("Revisión inválida");
const read = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const React = { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...(node.children ?? []).flat(Infinity).flatMap(flatten)];
const scopeFactory = handlerOriginal("utils/entryOperation.ts", "createEntryOperationScope", {});
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function environment(initialMode = "login", accepted = true) {
  let stateIndex = 0, refIndex = 0;
  const states = [], refs = [], calls = [], scope = scopeFactory(); scope.focus();
  const user = { uid: "synthetic-unified", email: "fake@example.test", emailVerified: true };
  const deps = {
    ...entryUIFixture, React, Text: "Text", View: "View", TouchableOpacity: "Touch", Mail: "Mail", Smile: "Smile", KeyRound: "Key",
    AuthField: "Field", AuthLegalAcceptance: "Terms", GoogleButton: "Google", Platform: { OS: "android" },
    Keyboard: { dismiss: () => calls.push(["keyboard"]) }, reemplazarUnaVez: path => calls.push(["route", path]),
    useAppData: () => ({ t: key => key, showToast: value => calls.push(["toast", value]) }),
    useEntryOperation: () => () => scope.begin(),
    useState: initial => { const index = stateIndex++; if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; },
    useRef: initial => { const index = refIndex++; refs[index] ??= { current: initial }; return refs[index]; },
    auth: { currentUser: null }, withTimeout: promise => promise,
    hasAcceptedLegalDocuments: async () => { calls.push(["check"]); return accepted; },
    recordLegalAcceptanceForCurrentAccount: async () => calls.push(["receipt"]),
    signInWithGoogle: async () => { calls.push(["google"]); deps.auth.currentUser = user; return user; },
    signInWithEmailAndPassword: async () => { calls.push(["login"]); deps.auth.currentUser = user; return { user }; },
    createUserWithEmailAndPassword: async () => { calls.push(["create"]); deps.auth.currentUser = user; return { user }; },
    updateProfile: async () => calls.push(["profile"]), sendEmailVerification: async () => calls.push(["verify"]),
    sendPasswordResetEmail: async (_, email) => calls.push(["reset", email]),
    Alert: { alert: (...args) => calls.push(["alert", ...args]) }, firebaseErrorMessage: () => "synthetic-error",
    GoogleSignInCancelled: class extends Error {}, googleSignInErrorMessage: () => "synthetic-error",
  };
  const props = { initialMode, onLoggedIn: async current => { assert.equal(current(), true); calls.push(["opened"]); },
    onRegistered: async (name, email, current) => { assert.equal(current(), true); calls.push(["registered", name, email]); },
    // La versión anterior debe fallar por navegar a otra pantalla, no por una API nueva.
    onGoRegister: () => calls.push(["route", "/register"]) };
  const component = handlerOriginal("screens/Login.tsx", "Login", { ...deps,
    signInWithGoogle: (...args) => deps.signInWithGoogle(...args), updateProfile: (...args) => deps.updateProfile(...args),
  }, read("screens/Login.tsx"));
  const render = () => { stateIndex = 0; refIndex = 0; return flatten(component(props)); };
  const field = label => render().find(node => node.type === "Field" && node.props.label === label);
  const toggle = mode => render().find(node => node.props.accessibilityRole === "tab" && flatten(node).some(item => item.children.includes(mode === "login" ? "login.submit" : "register.submit")))
    ?? render().find(node => node.type === "EntryLink" && node.props.label.includes(mode === "login" ? "register.login" : "login.register"));
  const primary = () => render().find(node => node.type === "EntryButton");
  const google = () => render().find(node => node.type === "Google");
  const terms = () => render().find(node => node.type === "Terms");
  return { deps, user, calls, scope, render, field, toggle, primary, google, terms };
}

// Primera comprobación de regresión: el enlace antiguo movía a otra pantalla.
{
  const f = environment();
  f.field("auth.emailLabel").props.onChange("synthetic@example.test");
  f.field("auth.passwordLabel").props.onChange("Only-test-123");
  f.toggle("register").props.onPress();
  assert.deepEqual(f.calls.filter(([name]) => name === "route"), [], "alternar agrega campos en el mismo formulario, no navega");
  assert.equal(f.field("auth.emailLabel").props.value, "synthetic@example.test");
  assert.equal(f.field("auth.passwordLabel").props.value, "Only-test-123");
  assert.ok(f.field("register.nameLabel"));
  assert.equal(f.render().filter(node => node.type === "Field").length, 3);
  assert.equal(f.render().filter(node => node.type === "EntryScreen").length, 1);
  assert.equal(f.render().filter(node => node.type === "Terms").length, 1);
  const name = f.render().find(node => node.props.key === "name");
  assert.equal(name.props.entering.duration, 160);
  assert.equal(name.props.exiting.duration, 120);
  assert.equal(name.props.entering.reduceMotion, "system");
  for (let i = 0; i < 8; i++) { f.toggle("login").props.onPress(); f.toggle("register").props.onPress(); }
  f.toggle("login").props.onPress();
  assert.equal(f.field("register.nameLabel"), undefined);
  assert.equal(f.terms(), undefined);
  assert.equal(f.field("auth.emailLabel").props.value, "synthetic@example.test");
  assert.equal(f.render().filter(node => node.type === "Field").length, 2);
}
for (const mode of ["login", "register"]) {
  const f = environment(mode);
  assert.equal(f.google().props.disabled, false, "Google no exige marcar antes de comprobar la cuenta elegida");
  await f.google().props.onPress();
  assert.deepEqual(f.calls.filter(([name]) => ["google", "check", "receipt", "opened"].includes(name)), [["google"], ["check"], ["opened"]]);
}
for (const mode of ["login", "register"]) {
  const f = environment(mode, false);
  await f.google().props.onPress();
  assert.equal(f.calls.some(([name]) => name === "opened"), false);
  assert.equal(f.render().filter(node => node.type === "Terms").length, 1);
  f.terms().props.onChange(true);
  await f.google().props.onPress();
  assert.equal(f.calls.filter(([name]) => name === "google").length, 1);
  assert.equal(f.calls.filter(([name]) => name === "receipt").length, 1);
  assert.equal(f.calls.filter(([name]) => name === "opened").length, 1);
}
// Un cambio inmediato antes del próximo dibujado tampoco rompe el envío único.
{
  const f = environment(); let release;
  f.deps.signInWithGoogle = async () => { f.calls.push(["google"]); await new Promise(resolve => { release = resolve; }); f.deps.auth.currentUser = f.user; return f.user; };
  const oldTab = f.toggle("register"), google = f.google();
  const pending = google.props.onPress(); oldTab.props.onPress(); await google.props.onPress();
  assert.equal(f.field("register.nameLabel"), undefined);
  assert.equal(f.calls.filter(([name]) => name === "google").length, 1);
  release(); await pending;
}
// Cuenta creada parcialmente: el formulario no pierde su reintento al alternar.
{
  const f = environment("register");
  f.field("register.nameLabel").props.onChange("Persona de prueba");
  f.field("auth.emailLabel").props.onChange(" synthetic@example.test ");
  f.field("auth.passwordLabel").props.onChange("Only-test-123"); f.terms().props.onChange(true);
  let failed = true;
  f.deps.updateProfile = async () => { if (failed) throw new Error("synthetic-profile"); f.calls.push(["profile"]); };
  f.primary().props.onPress(); await flush();
  assert.equal(f.primary().props.label, "register.finishAccount");
  assert.equal(f.toggle("login").props.disabled, true);
  f.toggle("login").props.onPress(); assert.ok(f.field("register.nameLabel"));
  assert.equal(f.field("auth.emailLabel").props.editable, false);
  failed = false; f.primary().props.onPress(); await flush();
  assert.equal(f.calls.filter(([name]) => name === "create").length, 1);
  assert.equal(f.calls.filter(([name]) => name === "registered").length, 1);
}
{
  const f = environment();
  f.field("auth.emailLabel").props.onChange("synthetic@example.test");
  f.render().find(node => node.type === "EntryLink" && node.props.label === "login.forgotPassword").props.onPress();
  assert.equal(f.render().filter(node => node.type === "Field").length, 1);
  await f.primary().props.onPress();
  assert.deepEqual(f.calls.find(([name]) => name === "reset"), ["reset", "synthetic@example.test"]);
  f.render().find(node => node.type === "EntryLink" && node.props.label === "entry.backLogin").props.onPress();
  assert.equal(f.field("auth.emailLabel").props.value, "synthetic@example.test");
}
assert.match(read("app/register.tsx"), /^export \{ default \} from "\.\/login";\s*$/, "registro antiguo es alias puro, no otra pantalla");
assert.equal(existsSync("screens/Register.tsx"), false, "el formulario duplicado fue retirado");
for (const [pathname, mode, expected] of [["/login", undefined, "login"], ["/login", "register", "register"], ["/register", undefined, "register"], ["/login", "invalid", "login"]]) {
  const node = handlerOriginal("app/login.tsx", "AccessRoute", { React, LoginRoute: "Route", usePathname: () => pathname, useLocalSearchParams: () => ({ mode }) }, read("app/login.tsx"))();
  assert.equal(node.props.initialMode, expected);
}
// Verificación primero: la cuenta nueva conserva su nombre y no se pisa un perfil.
for (const result of ["new", "local", "cloud", "switch-local", "switch-cloud"]) {
  const user = { uid: "synthetic-verified", displayName: "Persona de prueba", email: "synthetic@example.test", emailVerified: true };
  const auth = { currentUser: user }, calls = [];
  const data = { t: key => key, logout: async () => {},
    setUserName: value => calls.push(["name", value]), setUserEmail: value => calls.push(["email", value]),
    openLocalAccount: async () => { calls.push(["local"]); if (result === "switch-local") auth.currentUser = { ...user }; return result === "local"; },
    hydrateFromCloud: async () => { calls.push(["cloud"]); if (result === "switch-cloud") auth.currentUser = { ...user }; return result === "cloud" ? "restored" : "empty"; },
  };
  const root = handlerOriginal("app/verify-email.tsx", "VerifyEmailRoute", {
    React, VerifyEmail: "Verify", auth, useAppData: () => data, reload: async () => {}, sendEmailVerification: async () => {},
    withTimeout: promise => promise, router: { replace: path => calls.push(["route", path]) },
  }, read("app/verify-email.tsx"))();
  if (result.startsWith("switch")) {
    await assert.rejects(root.props.onCheckAgain(), { name: "LocalAccountAccessError" });
    assert.equal(calls.some(([name]) => ["name", "email", "route"].includes(name)), false);
  } else {
    await root.props.onCheckAgain();
    if (result === "new") assert.deepEqual(calls.slice(-3), [["name", user.displayName], ["email", user.email], ["route", "/setup"]]);
    else { assert.equal(calls.some(([name]) => name === "name" || name === "email"), false); assert.deepEqual(calls.at(-1), ["route", "/(tabs)"]); }
  }
}
console.log("Acceso original/JSX/SDK adaptados: un formulario, alternancia sin navegar ni perder correo, campos/animación, Google en ambos modos sin repetir términos, envío único, registro parcial y recuperación. Android/FPS/Google/correo reales pendientes.");

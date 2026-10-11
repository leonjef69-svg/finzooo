import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_ABANDONED_ENTRY_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = file => revision
  ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" })
  : readFileSync(file, "utf8");
const original = (file, name, dependencies) => handlerOriginal(file, name, dependencies, source(file));
// La protección nueva se usa también con los manejadores antiguos: la regresión
// debe fallar por continuar/navegar después de salir, no por una API ausente.
const createScope = handlerOriginal("utils/entryOperation.ts", "createEntryOperationScope", {});
const React = { createElement: (type, props) => ({ type, props }) };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture() {
  const calls = [], scope = createScope(); scope.focus();
  const user = { uid: "synthetic-entry", email: "synthetic@example.test", emailVerified: true, displayName: "Prueba" };
  const values = {
    beginEntryOperation: () => scope.begin(), auth: { currentUser: user },
    authBusy: { current: false }, navigationBusy: { current: false },
    createdUser: { current: null }, verificationSent: { current: false }, legalAccepted: true,
    email: user.email, name: "Prueba", pass: "Only-test-123",
    t: key => key, firebaseErrorMessage: code => code || "sdk-error",
    googleSignInErrorMessage: () => "google-error", GoogleSignInCancelled: class extends Error {},
    withTimeout: promise => promise,
    setError: value => calls.push(["error", value]), setGoogleError: value => calls.push(["google-error", value]),
    setErrors: value => calls.push(["errors", value]), setLoading: value => calls.push(["loading", value]),
    setGoogleLoading: value => calls.push(["google-loading", value]), showToast: value => calls.push(["toast", value]),
    signInWithEmailAndPassword: async () => ({ user }), signInWithGoogle: async () => user,
    createUserWithEmailAndPassword: async () => ({ user }),
    recordLegalAcceptanceForCurrentAccount: async () => calls.push(["receipt"]),
    updateProfile: async () => calls.push(["profile"]), sendEmailVerification: async () => calls.push(["verify"]),
    sendPasswordResetEmail: async () => {},
    openLocalAccount: async () => { calls.push(["local"]); return false; },
    hydrateFromCloud: async () => { calls.push(["cloud"]); return "empty"; },
    setUserName: value => calls.push(["name", value]), setUserEmail: value => calls.push(["email", value]),
    onLoggedIn: async () => calls.push(["entered"]), onRegistered: async () => calls.push(["registered"]),
    onGoogleSignedIn: async () => calls.push(["entered"]),
    router: { replace: path => calls.push(["route", path]) }, Alert: { alert: (...args) => calls.push(["alert", ...args]) },
  };
  return { values, calls, scope, user };
}
function absent(f, names, message) {
  assert.deepEqual(f.calls.filter(([name]) => names.includes(name)), [], message);
}

// SDK respondió al acceso abandonado: no continúa el perfil ni la ruta.
{
  const f = fixture(), sdk = deferred();
  f.values.signInWithEmailAndPassword = () => sdk.promise;
  const pending = original("screens/Login.tsx", "submit", f.values)();
  f.scope.blur(); sdk.resolve({ user: f.user }); await pending;
  absent(f, ["entered"], "Login abandonado no debe abrir/navegar cuando el SDK responde tarde");
}
for (const file of ["screens/Login.tsx", "screens/Register.tsx"]) {
  const f = fixture(), sdk = deferred(); f.values.signInWithGoogle = () => sdk.promise;
  const pending = original(file, file === "screens/Login.tsx" ? "loginWithGoogle" : "registerWithGoogle", f.values)();
  f.scope.blur(); sdk.resolve(f.user); await pending;
  absent(f, ["receipt", "entered"], `${file}: Google abandonado no continúa`);
}
{
  const f = fixture(), sdk = deferred(); f.values.createUserWithEmailAndPassword = () => sdk.promise;
  const pending = original("screens/Register.tsx", "submit", f.values)();
  f.scope.blur(); sdk.resolve({ user: f.user }); await pending;
  absent(f, ["receipt", "profile", "verify", "registered"], "Registro abandonado no completa perfil/verificación/ruta");
}
for (const step of ["updateProfile", "sendEmailVerification"]) {
  const f = fixture(), wait = deferred(); let reached = false;
  f.values[step] = () => { reached = true; return wait.promise; };
  const pending = original("screens/Register.tsx", "submit", f.values)();
  for (let i = 0; i < 10 && !reached; i++) await Promise.resolve();
  assert.equal(reached, true); f.scope.blur(); wait.resolve(); await pending;
  absent(f, ["registered"], `Registro abandonado después de ${step} no navega`);
  if (step === "updateProfile") absent(f, ["verify"], "No envía correo tras abandonar el perfil");
}

// El bloqueo se transmite al callback ORIGINAL de cada ruta, también cuando
// la pantalla se abandona dentro de abrir el archivo o consultar la nube.
for (const [file, component, prop] of [
  ["app/login.tsx", "LoginRoute", "onLoggedIn"],
  ["app/register.tsx", "RegisterRoute", "onGoogleSignedIn"],
  ["app/onboarding.tsx", "OnboardingRoute", "onGoogle"],
]) {
  for (const step of ["openLocalAccount", "hydrateFromCloud"]) {
    const f = fixture(), wait = deferred(); let reached = false;
    f.values[step] = () => { reached = true; return wait.promise; };
    const props = original(file, component, { ...f.values, React, Login: "Login", Register: "Register", Onboarding: "Onboarding", useAppData: () => f.values })().props;
    const pending = props[prop](f.scope.begin());
    for (let i = 0; i < 10 && !reached; i++) await Promise.resolve();
    assert.equal(reached, true, `${file}: alcanzó el límite ${step}`);
    f.scope.blur(); wait.resolve(step === "openLocalAccount" ? false : "restored"); await pending;
    absent(f, ["route"], `${file}: respuesta de ${step} no cambia la pantalla abandonada`);
    if (step === "openLocalAccount") absent(f, ["name", "email", "cloud"], "No continúa escribiendo el perfil/consultando la nube");
  }
}
{
  const f = fixture(), wait = deferred(); f.values.signInWithGoogle = () => wait.promise;
  const pending = original("app/onboarding.tsx", "continueWithGoogle", f.values)(f.scope.begin());
  f.scope.blur(); wait.resolve(f.user); await pending;
  absent(f, ["receipt", "local", "route"], "Bienvenida abandonada no abre la cuenta de Google atrasada");
}
{
  const f = fixture(), wait = deferred(); let reached = false;
  f.values.openLocalAccount = () => { reached = true; return wait.promise; };
  const props = original("app/register.tsx", "RegisterRoute", {
    ...f.values, React, Register: "Register", useAppData: () => f.values,
  })().props;
  const pending = props.onRegistered("Prueba", f.user.email, f.scope.begin());
  assert.equal(reached, true); f.scope.blur(); wait.resolve(false); await pending;
  absent(f, ["name", "email", "route"], "Callback del registro por correo tampoco continúa tras salir");
}
{
  const f = fixture(), wait = deferred(); f.values.sendPasswordResetEmail = () => wait.promise;
  const pending = original("screens/Login.tsx", "forgotPassword", f.values)();
  f.scope.blur(); wait.resolve(); await pending;
  absent(f, ["alert"], "Recuperar contraseña no muestra un aviso en otra ruta");
}
{
  const f = fixture(), wait = deferred(); f.values.openLocalAccount = () => wait.promise;
  const props = original("app/login.tsx", "LoginRoute", {
    ...f.values, React, Login: "Login", useAppData: () => f.values,
  })().props;
  const pending = props.onLoggedIn(f.scope.begin());
  f.values.auth.currentUser = { ...f.user }; wait.resolve(true); await pending;
  absent(f, ["name", "email", "cloud", "route"], "Otra instancia de la misma UID no continúa la apertura anterior");
}

// El finally antiguo no debe desbloquear una petición NUEVA al volver; tampoco
// mostrar un error tardío sobre la pantalla reabierta.
for (const failure of [false, true]) {
  const f = fixture(), wait = deferred(); f.values.signInWithEmailAndPassword = () => wait.promise;
  const pending = original("screens/Login.tsx", "submit", f.values)();
  f.scope.blur(); f.scope.focus(); f.scope.begin(); f.values.authBusy.current = true;
  const count = f.calls.length;
  if (failure) wait.reject(Object.assign(new Error("test-network"), { code: "auth/network-request-failed" }));
  else wait.resolve({ user: f.user });
  await pending;
  assert.equal(f.values.authBusy.current, true, "la petición vieja no libera el bloqueo nuevo");
  assert.equal(f.calls.length, count, "sin aviso ni cambio de carga atrasado");
}

// Montar el hook original con enfoque y desmontaje adaptados; no reemplazar la
// protección por una bandera escrita dentro de esta prueba.
{
  let focusCallback, cleanup, resets = 0;
  const begin = handlerOriginal("utils/entryOperation.ts", "useEntryOperation", {
    createEntryOperationScope: createScope, useRef: initial => ({ current: initial }),
    useCallback: callback => callback, useFocusEffect: callback => { focusCallback = callback; },
  })(() => { resets++; });
  assert.equal(begin()(), false, "antes del enfoque no continúa");
  cleanup = focusCallback(); const first = begin(); assert.equal(first(), true);
  const second = begin(); assert.equal(first(), false); assert.equal(second(), true);
  cleanup(); assert.equal(second(), false);
  cleanup = focusCallback(); assert.equal(second(), false); assert.equal(begin()(), true);
  assert.equal(resets, 2); cleanup();
}

console.log("Manejadores/rutas/hook originales: SDK tardío, perfil/correo/apertura/nube abandonados, vuelta con petición nueva y errores viejos. Solo cancela la continuación de la ruta: no cancela un SDK enviado ni acredita Android/Google reales.");

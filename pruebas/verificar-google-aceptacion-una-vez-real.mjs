import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const file = "screens/Login.tsx";
const revision = process.env.FINO_GOOGLE_LOGIN_LEGAL_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");

function fixture({ accepted = false, checked = false, pending = null, receiptError = null } = {}) {
  const user = { uid: "google-user-test", email: "google@example.test" };
  const calls = [], errors = [];
  const state = { accepted, pending, currentUser: null };
  const deps = {
    authBusy: { current: false },
    pendingGoogleUser: { get current() { return state.pending; }, set current(value) { state.pending = value; } },
    legalAccepted: checked,
    beginEntryOperation: () => () => true,
    auth: { get currentUser() { return state.currentUser; }, set currentUser(value) { state.currentUser = value; } },
    signInWithGoogle: async () => { calls.push("google"); state.currentUser = user; return user; },
    hasAcceptedLegalDocuments: async uid => { calls.push(["check", uid]); if (receiptError) throw receiptError; return state.accepted; },
    recordLegalAcceptanceForCurrentAccount: async () => { calls.push("record"); state.accepted = true; },
    withTimeout: promise => promise,
    onLoggedIn: async current => { calls.push("open"); assert.equal(current(), true); },
    t: key => key,
    setGoogleLegalPending: () => {},
    setError: value => errors.push(["email", value]),
    setErrors: () => {},
    setGoogleError: value => errors.push(["google", value]),
    setLoading: () => {}, setGoogleLoading: () => {}, showToast: value => errors.push(["toast", value]),
    GoogleSignInCancelled: class extends Error {}, googleSignInErrorMessage: () => "google-failure",
    firebaseErrorMessage: () => "firebase-failure",
  };
  return { calls, errors, state, deps, run: () => handlerOriginal(file, "loginWithGoogle", deps, source)() };
}

// Una aceptación vigente se comprueba por UID: el inicio habitual de Google
// no vuelve a mostrar la casilla ni reemplaza la fecha del recibo.
{
  const f = fixture({ accepted: true });
  await f.run();
  assert.deepEqual(f.calls, ["google", ["check", "google-user-test"], "open"]);
  assert.equal(f.state.pending, null);
}

// Cuenta sin recibo: autenticar no abre los datos. La persona ve la casilla,
// y al aceptar continúa con esa misma sesión sin repetir Google.
{
  const f = fixture();
  await f.run();
  assert.deepEqual(f.calls, ["google", ["check", "google-user-test"]]);
  assert.equal(f.state.pending.uid, "google-user-test");
  assert.ok(f.errors.some(([, value]) => value === "auth.legalRequired"));
  f.deps.legalAccepted = true;
  await f.run();
  assert.deepEqual(f.calls, ["google", ["check", "google-user-test"], "record", "open"]);
  assert.equal(f.state.pending, null);
}

// Si ya se marcó la casilla antes del primer intento, guardar el recibo sigue
// siendo obligatorio; si el recibo no se puede leer, falla de forma cerrada.
{
  const f = fixture({ checked: true });
  await f.run();
  assert.deepEqual(f.calls, ["google", ["check", "google-user-test"], "record", "open"]);
}
{
  const f = fixture({ checked: true, receiptError: new Error("disk-error") });
  await f.run();
  assert.equal(f.calls.includes("open"), false);
  assert.equal(f.calls.includes("record"), false);
}
{
  const f = fixture({ receiptError: new Error("legal-receipt-invalid") });
  await f.run();
  assert.equal(f.state.pending.uid, "google-user-test", "recibo legal dañado permite pedir una elección nueva");
  f.deps.legalAccepted = true;
  f.deps.recordLegalAcceptanceForCurrentAccount = async () => { f.calls.push("record-failed"); throw new Error("disk-error"); };
  await f.run();
  assert.equal(f.calls.includes("open"), false, "fallo al guardar aceptación no abre los datos");
  assert.equal(f.state.pending.uid, "google-user-test", "conserva la sesión para reintentar sin abrir Google de nuevo");
}

const ui = readFileSync(file, "utf8");
assert.match(ui, /!recovering && \(mode === "register" \|\| googleLegalPending\)[\s\S]*?<AuthLegalAcceptance/,
  "una sola casilla aparece para registrar o cuando falta el recibo de Google");
assert.match(ui, /disabled=\{loading \|\| !!createdUser.current \|\| \(googleLegalPending && !legalAccepted\)\}/,
  "Google no se bloquea con la casilla en cuentas que ya aceptaron");
for (const key of ["auth.legalRequiredForAccount", "auth.acceptAndContinue"]) {
  assert.equal((readFileSync("constants/i18n.ts", "utf8").match(new RegExp(`\\"${key}\\"`, "g")) ?? []).length, 3,
    `${key}: traducción disponible en español, inglés y portugués`);
}

console.log("Inicio con Google original: aceptación vigente no se repite; cuenta sin recibo exige elección explícita antes de abrir sus datos; recibo ilegible bloquea sin borrar ni entrar. Adaptado en Node, sin Google real, Firebase de producción o Android.");

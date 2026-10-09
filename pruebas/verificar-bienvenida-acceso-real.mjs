import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_ENTRY_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const calls = [], errors = [];
const dependencies = {
  legalAccepted: false, authBusy: { current: false }, navigationBusy: { current: false },
  t: key => key, setGoogleError: value => errors.push(value), setGoogleLoading: value => calls.push(["loading", value]),
  onGoogle: async () => { calls.push("google"); },
};
const welcome = () => handlerOriginal("screens/Onboarding.tsx", "continueWithGoogle", dependencies, source("screens/Onboarding.tsx"));
await welcome()();
assert.deepEqual(calls, [], "el Google de bienvenida NO inicia Auth sin elección explícita");
assert.ok(errors.includes("auth.legalRequired"));
dependencies.legalAccepted = true;
let release;
dependencies.onGoogle = async () => { calls.push("google"); await new Promise(resolve => { release = resolve; }); };
const access = welcome()(); await welcome()();
assert.equal(calls.filter(value => value === "google").length, 1, "doble toque inicia un solo acceso");
const navigated = [];
const navigation = handlerOriginal("screens/Onboarding.tsx", "navigate", { ...dependencies, setNavigating() {} }, source("screens/Onboarding.tsx"));
navigation(() => navigated.push("login"));
assert.deepEqual(navigated, [], "no navega hacia otra cuenta durante Auth");
release(); await access;
assert.equal(dependencies.authBusy.current, false);
navigation(() => navigated.push("login")); navigation(() => navigated.push("register"));
assert.deepEqual(navigated, ["login"], "dos destinos rápidos no apilan pantallas");
dependencies.navigationBusy.current = false;
dependencies.onGoogle = async () => { throw new Error("fallo-probado"); };
await welcome()();
assert.equal(errors.at(-1), "fallo-probado");
assert.equal(dependencies.authBusy.current, false, "fallo libera el acceso para reintentar");

const routeCalls = [], toasts = [];
const routeDependencies = {
  auth: { currentUser: { uid: "uid-test", email: "synthetic@example.test", displayName: "Prueba", emailVerified: true } },
  signInWithGoogle: async () => routeCalls.push("auth"),
  withTimeout: promise => promise,
  recordLegalAcceptanceForCurrentAccount: async () => routeCalls.push("receipt"),
  openLocalAccount: async () => { routeCalls.push("local"); return true; },
  hydrateFromCloud: async () => { routeCalls.push("cloud"); return "empty"; },
  setUserName() {}, setUserEmail() {}, t: key => key, showToast: value => toasts.push(value),
  router: { replace: path => routeCalls.push(path) }, Alert: { alert() {} },
  GoogleSignInCancelled: class extends Error {}, googleSignInErrorMessage: () => "google-unknown",
};
const route = () => handlerOriginal("app/onboarding.tsx", "continueWithGoogle", routeDependencies, source("app/onboarding.tsx"));
await route()();
assert.deepEqual(routeCalls, ["auth", "receipt", "local", "/(tabs)"], "recibo precede apertura; copia local evita restauración antigua");
routeCalls.length = 0;
routeDependencies.recordLegalAcceptanceForCurrentAccount = async () => { throw new Error("disk-test"); };
await route()(); assert.deepEqual(routeCalls, ["auth", "local", "/(tabs)"]);
assert.deepEqual(toasts, ["legal.saveFailed"], "fallo de recibo se avisa sin repetir Auth");
routeDependencies.openLocalAccount = async () => { const error = new Error("datos-protegidos-test"); error.name = "LocalAccountAccessError"; throw error; };
await assert.rejects(route()(), { name: "LocalAccountAccessError", message: "datos-protegidos-test" }, "no oculta protección de datos bajo GSIN");
routeDependencies.openLocalAccount = async () => { throw new Error("local-data-test"); };
await assert.rejects(route()(), { message: "login.accountOpenFailed" }, "Google exitoso no se anuncia como fallo de Google por datos inaccesibles");
routeDependencies.openLocalAccount = async () => { throw Object.assign(new Error("format-test"), { code: "cloud/history-format-unsupported" }); };
await assert.rejects(route()(), { message: "google-unknown" }, "formato nuevo conserva el traductor especializado, no pide reintentar indefinidamente");
routeDependencies.signInWithGoogle = async () => { throw new routeDependencies.GoogleSignInCancelled(); };
routeCalls.length = 0; await route()(); assert.deepEqual(routeCalls, [], "cancelar no abre cuentas ni navega");
console.log("Bienvenida original con IO adaptado: elección previa, acceso único, navegación bloqueada, reintento, recibo y preservación de errores de protección. Sin cuentas reales ni Google nativo.");

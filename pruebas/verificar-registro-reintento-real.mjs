import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_REGISTRATION_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = revision ? execFileSync("git", ["show", `${revision}:screens/Register.tsx`], { encoding: "utf8" }) : readFileSync("screens/Register.tsx", "utf8");
function fixture() {
  const calls = [], errors = [], toasts = [];
  const user = { uid: "registration-test", email: "synthetic@hotmail.com" };
  const values = {
    authBusy: { current: false }, createdUser: { current: null }, verificationSent: { current: false }, legalAccepted: true,
    name: "Persona de prueba", email: "synthetic@hotmail.com", pass: "Test-only-pass-123", auth: { currentUser: null },
    t: key => key, setGoogleError() {}, setLoading() {}, setErrors: value => errors.push(value), showToast: value => toasts.push(value),
    withTimeout: promise => promise, firebaseErrorMessage: code => `firebase:${code}`,
    createUserWithEmailAndPassword: async (_, email) => { calls.push(["create", email]); values.auth.currentUser = user; return { user }; },
    recordLegalAcceptanceForCurrentAccount: async () => calls.push(["receipt"]),
    updateProfile: async () => calls.push(["profile"]), sendEmailVerification: async () => calls.push(["verify"]),
    onRegistered: async (_, email) => calls.push(["registered", email]),
  };
  return { calls, errors, toasts, user, values, submit: () => handlerOriginal("screens/Register.tsx", "submit", values, source)() };
}
// Cuenta creada y correo fallido: permite verificar/reintentar, no repetir el alta.
{
  const f = fixture(); f.values.sendEmailVerification = async () => { f.calls.push(["verify-failed"]); throw new Error("network-test"); };
  await f.submit();
  assert.ok(f.calls.some(([name]) => name === "registered"), "correo fallido no descarta una cuenta ya creada");
  assert.deepEqual(f.toasts, ["register.verificationRetry"]);
  assert.equal(f.values.authBusy.current, false);
}
// Perfil falla; el mismo botón recupera la cuenta parcial. El correo se envía una sola vez.
{
  const f = fixture(); let attempts = 0;
  f.values.updateProfile = async () => { if (++attempts === 1) throw new Error("profile-test"); };
  await f.submit(); assert.equal(f.errors.at(-1).general, "register.accountCreatedRetry");
  f.values.onRegistered = async () => { throw Object.assign(new Error("datos-preservados"), { name: "LocalAccountAccessError" }); };
  await f.submit(); await f.submit();
  assert.equal(f.calls.filter(([name]) => name === "create").length, 1);
  assert.equal(f.calls.filter(([name]) => name === "verify").length, 1);
  assert.equal(f.errors.at(-1).general, "datos-preservados", "no oculta la protección de otra cuenta");
}
// Correo pegado con espacios se normaliza; Hotmail/Outlook no tienen bloqueo de dominio.
for (const domain of ["hotmail.com", "outlook.com", "gmail.com"]) {
  const f = fixture(); f.values.email = ` synthetic@${domain} `;
  await f.submit(); assert.deepEqual(f.calls.find(([name]) => name === "create"), ["create", `synthetic@${domain}`]);
}
// Un cambio de sesión intermedio jamás abre ni verifica otra cuenta.
{
  const f = fixture(); f.values.updateProfile = async () => { f.values.auth.currentUser = { uid: "other-test" }; };
  await f.submit();
  assert.equal(f.calls.filter(([name]) => name === "verify" || name === "registered").length, 0);
  assert.equal(f.errors.at(-1).general, "settings.noActiveSession");
  await f.submit(); assert.equal(f.calls.filter(([name]) => name === "create").length, 1);
}
// La misma UID con otra instancia de sesión también invalida el registro pendiente.
{
  const f = fixture(); f.values.updateProfile = async () => { f.values.auth.currentUser = { ...f.user }; };
  await f.submit();
  assert.equal(f.calls.filter(([name]) => name === "verify" || name === "registered").length, 0);
  assert.equal(f.errors.at(-1).general, "settings.noActiveSession");
}
// Doble toque antes de que Firebase responda usa un solo alta y libera el bloqueo.
{
  const f = fixture(); let release;
  f.values.createUserWithEmailAndPassword = async () => { f.calls.push(["create"]); await new Promise(resolve => { release = resolve; }); f.values.auth.currentUser = f.user; return { user: f.user }; };
  const pending = f.submit(); await f.submit(); assert.equal(f.calls.filter(([name]) => name === "create").length, 1);
  release(); await pending; assert.equal(f.values.authBusy.current, false);
}
console.log("Registro original/IO adaptado: fallo del correo, perfil/reintento sin recrear, envío único, espacios y dominios, cambio de sesión y doble toque. No entrega real de email ni Android.");

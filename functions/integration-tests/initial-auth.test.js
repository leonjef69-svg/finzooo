"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const path = require("node:path"), { createRequire } = require("node:module");
// Usar exactamente el SDK de la APP, no la versión de reglas de functions/.
const requireClient = createRequire(path.resolve(__dirname, "../../package.json"));
const { initializeApp, deleteApp } = requireClient("firebase/app");
const { initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendEmailVerification, applyActionCode, reload, signOut,
  sendPasswordResetEmail, confirmPasswordReset, GoogleAuthProvider, signInWithCredential, updateProfile } = requireClient("firebase/auth");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099", "solo Firebase local; nunca producción");
const projectId = "demo-fino-node22";
const host = "http://127.0.0.1:9099";

async function codes() {
  const response = await fetch(`${host}/emulator/v1/projects/${projectId}/oobCodes`);
  assert.equal(response.ok, true); return (await response.json()).oobCodes;
}
test("acceso inicial: SDK Auth real conectado exclusivamente a emulador", async t => {
  const { handlerOriginal } = await import("../../pruebas/helpers/handler-original.mjs");
  const withTimeout = handlerOriginal("utils/withTimeout.ts", "withTimeout", {});
  const app = initializeApp({ apiKey: "demo-test-only", projectId }, "initial-auth-test");
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, host, { disableWarnings: true });
  try {
    for (const domain of ["hotmail.com", "outlook.com"]) await t.test(`${domain}: crear, verificar y volver a entrar`, async () => {
      const email = `fino-synthetic-${Date.now()}@${domain}`, password = "Only-local-test-123";
      const errors = [], completed = [];
      const register = {
        authBusy: { current: false }, createdUser: { current: null }, verificationSent: { current: false }, legalAccepted: true,
        name: "Persona sintética", email: ` ${email} `, pass: password, auth,
        t: key => key, setGoogleError() {}, setLoading() {}, setErrors: value => { if (Object.keys(value).length) errors.push(value); },
        showToast: value => errors.push(value), firebaseErrorMessage: code => code, withTimeout,
        createUserWithEmailAndPassword, updateProfile, sendEmailVerification,
        recordLegalAcceptanceForCurrentAccount: async () => {}, // solo recibo local sustituido
        onRegistered: async (_, normalized) => completed.push(normalized), // apertura/Router no Android
      };
      await handlerOriginal("screens/Register.tsx", "submit", register)();
      assert.deepEqual(errors, []); assert.deepEqual(completed, [email]);
      const user = register.createdUser.current;
      assert.equal(auth.currentUser, user, "sesión SDK real conserva la instancia del registro");
      const uid = user.uid;
      assert.equal(user.emailVerified, false);
      const code = (await codes()).find(item => item.email === email && item.requestType === "VERIFY_EMAIL");
      assert.ok(code, "el correo se simula en el emulador; no sale de este PC");
      await applyActionCode(auth, code.oobCode); await reload(user);
      assert.equal(user.emailVerified, true);
      await signOut(auth);
      let entered = false;
      const login = { authBusy: { current: false }, email: ` ${email} `, pass: password, auth,
        setGoogleError() {}, setError: value => { if (value) errors.push(value); }, setLoading() {}, t: key => key,
        firebaseErrorMessage: code => code, signInWithEmailAndPassword, onLoggedIn: async () => { entered = true; } };
      await handlerOriginal("screens/Login.tsx", "submit", login)();
      assert.equal(entered, true); assert.deepEqual(errors, []);
      assert.equal(auth.currentUser.uid, uid); assert.equal(auth.currentUser.emailVerified, true);
      await signOut(auth);
    });
    await t.test("recuperación de contraseña: enlace local y nuevo acceso", async () => {
      const email = `fino-reset-${Date.now()}@hotmail.com`;
      await createUserWithEmailAndPassword(auth, email, "Old-test-only-123"); await signOut(auth);
      await sendPasswordResetEmail(auth, email);
      const code = (await codes()).find(item => item.email === email && item.requestType === "PASSWORD_RESET"); assert.ok(code);
      await confirmPasswordReset(auth, code.oobCode, "New-test-only-456");
      await assert.rejects(signInWithEmailAndPassword(auth, email, "Old-test-only-123"));
      assert.equal((await signInWithEmailAndPassword(auth, email, "New-test-only-456")).user.email, email);
      await signOut(auth);
    });
    await t.test("Google: credencial simulada, entrada y misma cuenta tras salir", async () => {
      // Forma de credencial literal documentada SOLO para el emulador.
      // No instala nada ni abre el selector de Google en Android.
      const credential = GoogleAuthProvider.credential(JSON.stringify({ sub: `google-synthetic-${Date.now()}`, email: "google-synthetic@example.test", email_verified: true }));
      const googleCredential = handlerOriginal("utils/googleAuth.ts", "googleCredential", {
        WEB_CLIENT_ID: "demo-client-not-production", GoogleAuthProvider,
        GoogleSignInCancelled: class extends Error {},
        configureGoogleSignIn: () => ({ GoogleSignin: { hasPlayServices: async () => true, signIn: async () => ({ type: "success", data: { idToken: credential.idToken } }) }, isErrorWithCode: () => false, statusCodes: {} }),
      });
      const signInOriginal = handlerOriginal("utils/googleAuth.ts", "signInWithGoogle", { auth, signInWithCredential, googleCredential });
      await signInOriginal();
      const first = auth.currentUser, uid = first.uid;
      assert.equal(first.emailVerified, true);
      assert.equal(first.providerData[0].providerId, "google.com");
      await signOut(auth); assert.equal((await signInWithCredential(auth, credential)).user.uid, uid);
      await signOut(auth);
    });
  } finally { await deleteApp(app); }
});

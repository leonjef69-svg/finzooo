import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_GOOGLE_RESULT_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const read = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
for (const [file, name] of [["screens/Login.tsx", "loginWithGoogle"], ["screens/Register.tsx", "registerWithGoogle"], ["app/onboarding.tsx", "continueWithGoogle"]]) {
  for (const replaced of [true, false]) {
    const calls = [], a = { uid: "synthetic-A", email: "a@example.test", emailVerified: true }, b = { uid: "synthetic-B", email: "b@example.test", emailVerified: true };
    const auth = { currentUser: null };
    const signIn = handlerOriginal("utils/googleAuth.ts", "signInWithGoogle", {
      auth, googleCredential: async () => ({ synthetic: true }),
      signInWithCredential: async () => {
        auth.currentUser = a;
        if (replaced) queueMicrotask(() => { auth.currentUser = b; });
        return { user: a };
      },
    }, read("utils/googleAuth.ts"));
    const values = {
      auth, signInWithGoogle: signIn, beginEntryOperation: () => () => true,
      authBusy: { current: false }, navigationBusy: { current: false }, legalAccepted: true,
      pendingGoogleUser: { current: null }, setGoogleLegalPending() {}, hasAcceptedLegalDocuments: async () => true,
      t: key => key, setError() {}, setErrors() {}, setGoogleError: value => { if (value) calls.push(["error", value]); },
      setGoogleLoading() {}, showToast: value => calls.push(["toast", value]), withTimeout: promise => promise,
      recordLegalAcceptanceForCurrentAccount: async () => calls.push(["receipt", auth.currentUser.uid]),
      onLoggedIn: async () => calls.push(["opened", auth.currentUser.uid]), onGoogleSignedIn: async () => calls.push(["opened", auth.currentUser.uid]),
      openLocalAccount: async () => { calls.push(["opened", auth.currentUser.uid]); return true; },
      router: { replace: route => calls.push(["route", route]) }, GoogleSignInCancelled: class extends Error {},
      googleSignInErrorMessage: () => "synthetic-error",
    };
    await handlerOriginal(file, name, values, read(file))();
    if (replaced) assert.deepEqual(calls, [], `${file}: el resultado A no se atribuye a la sesión B que llegó después`);
    else {
      const expected = file !== "screens/Register.tsx" ? [["opened", a.uid]] : [["receipt", a.uid], ["opened", a.uid]];
      assert.deepEqual(calls.filter(([name]) => name === "receipt" || name === "opened"), expected);
      assert.equal(values.authBusy.current, false);
    }
  }
}
console.log("Google helper y tres manejadores originales: resultado SDK exacto, reemplazo en microtarea y acceso normal. No cancela SDK global ya enviado ni acredita selector Google real.");

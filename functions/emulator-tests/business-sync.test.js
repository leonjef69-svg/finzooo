"use strict";
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, deleteDoc } = require("firebase/firestore");

test("Negocio: versiones antiguas no retiran marcas de borrado ni cambian el propietario", async () => {
  const env = await initializeTestEnvironment({ projectId: "demo-fino-business-sync",
    firestore: { host: "127.0.0.1", port: 8080, rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") } });
  const deleted = { negocios: ["n-old"], productos: ["p-old"], ventas: ["v1"], movimientos: ["m-old"] };
  const copy = { syncFormat: 2, deleted, negocios: [], productos: [], ventas: [], movimientos: [] };
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "users", "owner"), { isPremium: true });
      await setDoc(doc(context.firestore(), "users", "free"), { isPremium: false });
    });
    const owner = env.authenticatedContext("owner", { email_verified: true }).firestore();
    const ref = doc(owner, "negocios", "owner");
    await assertSucceeds(setDoc(ref, copy));
    await assertFails(setDoc(ref, { negocios: [], productos: [], ventas: [{ id: "v1" }], movimientos: [] }));
    for (const name of Object.keys(deleted)) await assertFails(setDoc(ref, { ...copy, deleted: { ...deleted, [name]: [] } }));
    await assertFails(setDoc(ref, { ...copy, syncFormat: 1 }));
    await assertFails(setDoc(ref, { ...copy, syncFormat: 3 }));
    await assertSucceeds(setDoc(ref, { ...copy, deleted: { ...deleted, ventas: ["v1", "v2"] } }));
    const stranger = env.authenticatedContext("other", { email_verified: true }).firestore();
    await assertFails(getDoc(doc(stranger, "negocios", "owner")));
    await assertFails(setDoc(doc(stranger, "negocios", "owner"), copy));
    const free = env.authenticatedContext("free", { email_verified: true }).firestore();
    await assertFails(setDoc(doc(free, "negocios", "free"), copy));
    await assertSucceeds(deleteDoc(ref));
  } finally { await env.cleanup(); }
});

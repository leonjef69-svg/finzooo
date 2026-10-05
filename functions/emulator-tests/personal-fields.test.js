"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, setDoc, getDoc, updateDoc } = require("firebase/firestore");

// Solo se ejecuta contra el emulador de demo-fino, nunca contra producción.
test("unión por campos: permite migrar y bloquea el reemplazo de una app antigua", async t => {
  const env = await initializeTestEnvironment({ projectId: "demo-fino",
    firestore: { host: "127.0.0.1", port: 8080,
      rules: process.env.FINO_TEST_BASELINE
        ? execFileSync("git", ["show", "HEAD:firestore.rules"], { encoding: "utf8", cwd: path.resolve(__dirname, "../..") })
        : fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") } });
  try {
    await env.clearFirestore();
    const owner = env.authenticatedContext("fields-owner", { email_verified: true }).firestore();
    const other = env.authenticatedContext("fields-other", { email_verified: true }).firestore();
    const unverified = env.authenticatedContext("fields-owner", { email_verified: false }).firestore();
    const ref = doc(owner, "users", "fields-owner");
    const legacy = { hasOnboarded: true, userName: "Prueba", userPhoto: null,
      userCurrency: "PEN", userLanguage: "es", budgets: { "2026-10": 1000 },
      categoryBudgets: {}, transactions: [], goals: [], isPremium: false, syncUpdatedAt: { budgets: 1 } };
    await t.test("el formato antiguo puede seguir leyendo y guardar antes de migrar", async () => {
      await assertSucceeds(setDoc(ref, legacy));
      assert.equal((await getDoc(ref)).data().budgets["2026-10"], 1000);
    });
    const migrated = { ...legacy, syncFormat: 2, syncUpdatedAt: { budgets: 2,
      'write:budgets:%5B%222026-10%22%5D': 2, 'delete:customCategories:%5B%22retirada%22%2C%22%24exists%22%5D': 3 } };
    await t.test("la unión nueva conserva su formato y las marcas", async () => {
      await assertSucceeds(setDoc(ref, migrated));
      assert.equal((await getDoc(ref)).data().syncFormat, 2);
      await assertSucceeds(updateDoc(ref, { userName: "Actualizado" }));
    });
    await t.test("la versión antigua no puede quitar el marcador ni pisar las listas", async () => {
      await assertFails(setDoc(ref, legacy));
      await assertFails(setDoc(ref, { ...legacy, syncFormat: 1 }));
      await assertFails(updateDoc(ref, { syncFormat: 3 }));
      assert.equal((await getDoc(ref)).data().userName, "Actualizado");
    });
    await t.test("no abre acceso a otra cuenta ni a un correo sin verificar", async () => {
      await assertFails(getDoc(doc(other, "users", "fields-owner")));
      await assertFails(setDoc(doc(other, "users", "fields-owner"), migrated));
      await assertFails(getDoc(doc(unverified, "users", "fields-owner")));
      await assertFails(setDoc(doc(unverified, "users", "fields-owner"), migrated));
    });
  } finally {
    await env.cleanup();
  }
});

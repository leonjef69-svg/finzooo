"use strict";
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, setDoc, updateDoc, Timestamp } = require("firebase/firestore");

const baseline = process.env.FINO_TEST_CURRENCY_RULES_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const rules = baseline ? execFileSync("git", ["show", `${baseline}:firestore.rules`], {
  cwd: path.resolve(__dirname, "../.."), encoding: "utf8",
}) : fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8");
const copy = { hasOnboarded: true, userName: "Ana", userPhoto: null, userCurrency: "PEN", userLanguage: "es",
  budgets: {}, categoryBudgets: {}, transactions: [], goals: [], isPremium: true, syncFormat: 2 };

test("Moneda fija: reglas reales rechazan reetiquetar una cuenta ya configurada", { timeout: 120_000 }, async t => {
  const env = await initializeTestEnvironment({ projectId: "demo-fino-currency", firestore: { host: "127.0.0.1", port: 8080, rules } });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, "users", "owner"), copy);
      const { userCurrency: _currency, ...legacy } = copy; void _currency;
      await setDoc(doc(db, "users", "legacy"), legacy);
      await setDoc(doc(db, "testerPremium", "new"), { active: true, grantedAt: Timestamp.now() });
    });
    const owner = env.authenticatedContext("owner", { email_verified: true }).firestore();
    const ref = doc(owner, "users", "owner");
    await t.test("USD no puede reemplazar PEN aunque el historial esté vacío", async () => {
      await assertFails(updateDoc(ref, { userCurrency: "USD" }));
    });
    await t.test("reiniciar configuración no elude el bloqueo", async () => {
      await assertFails(updateDoc(ref, { hasOnboarded: false }));
      await assertFails(updateDoc(ref, { hasOnboarded: false, userCurrency: "USD" }));
    });
    await t.test("nombre, idioma y presupuestos siguen editables con la misma moneda", async () => {
      await assertSucceeds(updateDoc(ref, { userName: "Ana María", userLanguage: "en", budgets: { "2026-10": 100 } }));
      await assertSucceeds(updateDoc(ref, { budgets: {}, transactions: [] }));
      await assertFails(updateDoc(ref, { userCurrency: "USD" }));
    });
    await t.test("la cuenta nueva elige USD con su concesión de tester, sin concederse Pro", async () => {
      const client = env.authenticatedContext("new", { email_verified: true }).firestore();
      await assertSucceeds(setDoc(doc(client, "users", "new"), { ...copy, isPremium: false, userCurrency: "USD" }));
      await assertFails(updateDoc(doc(client, "users", "new"), { userCurrency: "PEN" }));
    });
    await t.test("copia antigua sin moneda explícita conserva PEN, su interpretación anterior", async () => {
      const client = env.authenticatedContext("legacy", { email_verified: true }).firestore();
      await assertFails(updateDoc(doc(client, "users", "legacy"), { userCurrency: "USD" }));
      await assertSucceeds(updateDoc(doc(client, "users", "legacy"), { userCurrency: "PEN" }));
    });
  } finally { await env.cleanup(); }
});

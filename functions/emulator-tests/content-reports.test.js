"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { initializeTestEnvironment, assertFails } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc } = require("firebase/firestore");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080", "solo Firestore local: no ejecutar contra producción");
const baseline = process.env.FINO_REPORT_BASELINE_FILE;
let reportModule = require("../src/content-reports");
if (baseline) {
  const resolved = path.resolve(baseline), temporaryRoot = path.resolve(__dirname, "../../.tmp") + path.sep;
  assert.ok(resolved.startsWith(temporaryRoot), "la comparación solo lee una captura local en .tmp");
  const module = { exports: {} };
  new Function("require", "module", "exports", fs.readFileSync(resolved, "utf8"))(require, module, module.exports);
  reportModule = module.exports;
}
const { CONTACT, submitContentReport, cleanupExpiredReports, cleanupReportsForAccount } = reportModule;

test("denuncias: SDK/Admin originales, acceso propio, cupo, reintento y dinero intacto", async t => {
  const projectId = "demo-fino-content-reports", env = await initializeTestEnvironment({ projectId,
    firestore: { host: "127.0.0.1", port: 8080, rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8") } });
  const app = initializeApp({ projectId }, "content-report-audit"), db = getFirestore(app);
  const now = Date.UTC(2026, 9, 8, 12);
  const input = (extra = {}) => ({ id: crypto.randomUUID(), kind: "family", spaceId: "F", targetType: "movement", targetId: "M",
    reason: "abuse", details: "Texto señalado", expectedText: "Texto a revisar", expectedUid: "B", processingAccepted: true, policyVersion: "2026-10-08", ...extra });
  const financial = { creadoPor: "B", descripcion: "Texto a revisar", monto: 9_000, fecha: "2026-10-08", tipo: "ingreso", notes: "NO COPIAR NOTAS", method: "cash" };
  let original;
  try {
    await env.clearFirestore();
    await db.doc("users/A").set({ hasOnboarded: true, isPremium: false });
    await db.doc("familySpaces/F").set({ ownerUid: "B", nombre: "Familia", currency: "PEN" });
    await db.doc("familySpaces/F/members/A").set({ uid: "A", nombre: "A", rol: "member" });
    await db.doc("familySpaces/F/movements/M").set(financial);
    const queueSize = async () => (await db.collection("moderationMail").get()).size;
    await t.test("sin envío configurado no finge recibir ni deja correo/denuncia", async () => {
      await assert.rejects(submitContentReport(db, "A", input(), now), /report-unavailable/);
      assert.equal(await queueSize(), 0);
      assert.equal((await db.collection("contentReports").get()).size, 0);
      await db.doc("privateSettings/moderation").set({ enabled: true, mailConfigured: true, contact: CONTACT });
    });
    await t.test("miembro Gratis denuncia sin enviar importes, notas ni tocar saldos", async () => {
      original = input();
      const masks = [];
      const observedDb = { collection: name => db.collection(name), runTransaction: work => db.runTransaction(tx => work({
        get: ref => tx.get(ref), set: (...args) => tx.set(...args),
        getAll: (...args) => { masks.push(args.at(-1).fieldMask); return tx.getAll(...args); },
      })) };
      assert.deepEqual(await submitContentReport(observedDb, "A", original, now), { id: original.id, saved: true, emailConfirmed: false });
      assert.equal(masks.length, 2);
      assert.equal(masks.flat().includes("transactions"), false);
      assert.equal(masks.flat().includes("monto"), false);
      assert.equal(masks.flat().includes("notes"), false);
      const saved = (await db.collection("contentReports").get()).docs[0].data();
      assert.equal(saved.text, financial.descripcion); assert.equal(saved.reporterUid, "A"); assert.equal(saved.targetUid, "B");
      assert.equal("monto" in saved, false); assert.equal("notes" in saved, false);
      const mail = (await db.collection("moderationMail").get()).docs[0].data();
      assert.equal(mail.to, CONTACT); assert.equal(mail.message.text.includes("NO COPIAR NOTAS"), false);
      assert.equal(mail.message.text.includes("9000"), false);
      assert.deepEqual((await db.doc("familySpaces/F/movements/M").get()).data(), financial);
      assert.deepEqual((await db.doc("users/A").get()).data(), { hasOnboarded: true, isPremium: false });
    });
    await t.test("respuesta perdida reintenta el mismo aviso; otro cuerpo no lo reemplaza", async () => {
      assert.equal((await submitContentReport(db, "A", original, now)).saved, true);
      assert.equal(await queueSize(), 1);
      assert.equal((await db.doc("reportRateLimits/A").get()).data().count, 1);
      await assert.rejects(submitContentReport(db, "A", { ...original, details: "Otro cuerpo" }, now), /report-conflict/);
      assert.equal(await queueSize(), 1);
    });
    await t.test("cuenta no miembro, datos inválidos y cierre de cuenta no escriben", async () => {
      const count = await queueSize();
      await assert.rejects(submitContentReport(db, "C", input(), now), /report-permission/);
      await assert.rejects(submitContentReport(db, "A", input({ expectedText: "Otro texto" }), now), /report-source-changed/);
      await assert.rejects(submitContentReport(db, "A", input({ expectedUid: "D" }), now), /report-source-changed/);
      for (const change of [{ spaceId: "../F" }, { details: "x".repeat(501) }, { to: "other@example.com" }, { monto: 100 }, { id: "-".repeat(36) }, { processingAccepted: false }, { policyVersion: "anterior" }]) {
        await assert.rejects(submitContentReport(db, "A", input(change), now), /report-invalid/);
      }
      await db.doc("premiumTrialClaims/A").set({ deletionPending: true });
      await assert.rejects(submitContentReport(db, "A", input(), now), /report-account-closing/);
      await db.doc("premiumTrialClaims/A").delete();
      assert.equal(await queueSize(), count);
    });
    await t.test("SDK de miembro o Pro no puede leer avisos ni enviar correo directo", async () => {
      const sdk = env.authenticatedContext("A", { email_verified: true }).firestore();
      for (const name of ["contentReports", "moderationMail", "reportRateLimits", "privateSettings"]) {
        await assertFails(getDoc(doc(sdk, name, "test")));
        await assertFails(setDoc(doc(sdk, name, "test"), { to: "other@example.com" }));
      }
    });
    await t.test("tres cupos reales incluso con cuatro solicitudes simultáneas", async () => {
      const tomorrow = now + 86_400_000;
      const results = await Promise.allSettled(Array.from({ length: 4 }, () => submitContentReport(db, "A", input(), tomorrow)));
      assert.equal(results.filter(item => item.status === "fulfilled").length, 3);
      assert.equal(results.find(item => item.status === "rejected").reason.message, "report-limit");
      assert.equal((await db.doc("reportRateLimits/A").get()).data().count, 3);
    });
    await t.test("limpieza por cuenta retira sus copias, no el libro financiero", async () => {
      await cleanupReportsForAccount(db, "B", now);
      assert.equal(await queueSize(), 0);
      assert.equal((await db.collection("contentReports").get()).size, 0);
      assert.equal((await db.doc("reportRateLimits/B").get()).data().closed, true);
      assert.deepEqual((await db.doc("familySpaces/F/movements/M").get()).data(), financial);
    });
    await t.test("expiración elimina el par de copias, no la pertenencia ni el dinero", async () => {
      await submitContentReport(db, "A", input(), now);
      assert.equal(await cleanupExpiredReports(db, now + 31 * 86_400_000), 1);
      assert.equal(await queueSize(), 0);
      assert.equal((await db.doc("familySpaces/F/members/A").get()).exists, true);
      assert.deepEqual((await db.doc("familySpaces/F/movements/M").get()).data(), financial);
    });
    await t.test("nombre del espacio o miembro se denuncia con el autor correcto", async () => {
      await db.doc("familySpaces/F/members/B").set({ uid: "B", nombre: "Persona", rol: "owner" });
      for (const value of [
        { targetType: "space", targetId: "F", expectedText: "Familia", expectedUid: "B" },
        { targetType: "member", targetId: "B", expectedText: "Persona", expectedUid: "B" },
      ]) assert.equal((await submitContentReport(db, "A", input(value), now + 32 * 86_400_000)).saved, true);
      await cleanupReportsForAccount(db, "A", now + 32 * 86_400_000);
      await assert.rejects(submitContentReport(db, "A", input(), now + 32 * 86_400_000), /report-account-closing/,
        "una solicitud que llegue tarde no recrea datos de una cuenta eliminada");
      assert.deepEqual((await db.doc("familySpaces/F/movements/M").get()).data(), financial);
    });
    await t.test("Caja compartida: denuncia propia, acceso ajeno rechazado y saldo conservado", async () => {
      await db.doc("users/C").set({ hasOnboarded: true, isPremium: false });
      await db.doc("boxSpaces/K").set({ ownerUid: "D", nombre: "Caja", currency: "PEN", migrationComplete: true });
      await db.doc("boxSpaces/K/members/C").set({ uid: "C", nombre: "C", rol: "member" });
      await db.doc("boxSpaces/K/movements/M").set(financial);
      const boxInput = input({ kind: "box", spaceId: "K" });
      assert.equal((await submitContentReport(db, "C", boxInput, now)).saved, true);
      await assert.rejects(submitContentReport(db, "X", input({ kind: "box", spaceId: "K" }), now), /report-permission/);
      await db.doc("boxSpaces/K").update({ migrationComplete: false });
      await assert.rejects(submitContentReport(db, "C", input({ kind: "box", spaceId: "K" }), now), /report-permission/);
      assert.deepEqual((await db.doc("boxSpaces/K/movements/M").get()).data(), financial);
      await cleanupReportsForAccount(db, "C", now);
      await cleanupExpiredReports(db, now + 65 * 86_400_000);
      assert.equal((await db.doc("reportRateLimits/A").get()).exists, false);
      assert.equal((await db.doc("reportRateLimits/C").get()).exists, false);
      assert.equal(await queueSize(), 0);
    });
  } finally { await env.cleanup(); await deleteApp(app); }
});

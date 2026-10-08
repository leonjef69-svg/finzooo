"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { initializeApp, deleteApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore");
const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } = require("firebase/firestore");
const { DOCUMENTS, acceptLegalDocuments } = require("../src/legal-acceptance");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
const baseline = process.env.FINO_LEGAL_RULES_BASELINE;
if (baseline) assert.match(baseline, /^[a-f\d]{7,40}$/i);
test("aceptación: reglas SDK originales sin saltos desde versiones antiguas", async t => {
  const projectId = "demo-fino-legal-rules", root = path.resolve(__dirname, "../..");
  const env = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080,
    rules: baseline ? execFileSync("git", ["show", `${baseline}:firestore.rules`], { cwd: root, encoding: "utf8" }) : fs.readFileSync(path.join(root, "firestore.rules"), "utf8") } });
  const app = initializeApp({ projectId }, "legal-rules"), admin = getFirestore(app);
  const owner = env.authenticatedContext("owner", { email_verified: true }).firestore();
  const free = env.authenticatedContext("free", { email_verified: true }).firestore();
  const payload = { ...DOCUMENTS, termsAccepted: true, privacyRead: true }; delete payload.version;
  const movement = { tipo: "ingreso", monto: 100, descripcion: "Prueba", fecha: "2026-10-08", creadoPor: "owner", creadoEn: serverTimestamp() };
  try {
    await env.clearFirestore(); await admin.doc("users/owner").set({ isPremium: true });
    await admin.doc("users/free").set({ isPremium: false });
    await t.test("sin aceptación Pro no crea espacio por SDK directo", async () => {
      await assertFails(setDoc(doc(owner, "familySpaces", "new"), { nombre: "Casa", ownerUid: "owner", currency: "PEN", creadoEn: serverTimestamp() }));
      await assertFails(setDoc(doc(owner, "boxSpaces", "new"), { nombre: "Casa", ownerUid: "owner", currency: "PEN", creadaEn: serverTimestamp() }));
    });
    if (baseline) return; // Comparar el mismo permiso con reglas antiguas, sin otros escenarios.
    for (const kind of ["family", "box"]) {
      const spaces = kind === "family" ? "familySpaces" : "boxSpaces", invites = kind === "family" ? "familyInvites" : "boxInvites", field = kind === "family" ? "familyId" : "boxId";
      await admin.doc(`${spaces}/home`).set({ nombre: "Casa", ownerUid: "owner", currency: "PEN" });
      await admin.doc(`${spaces}/home/members/owner`).set({ uid: "owner", nombre: "Dueño", rol: "owner" });
      await admin.doc(`${spaces}/home/movements/old`).set({ ...movement, creadoEn: new Date() });
      await t.test(`${kind}: puede leer/borrar registro viejo, no nombre/movimiento/invitación nuevos`, async () => {
        await assertSucceeds(getDoc(doc(owner, spaces, "home", "movements", "old")));
        await assertSucceeds(deleteDoc(doc(owner, spaces, "home", "movements", "old")));
        await assertFails(updateDoc(doc(owner, spaces, "home"), { nombre: "Otro" }));
        await assertFails(setDoc(doc(owner, spaces, "home", "movements", "new"), movement));
        await assertFails(setDoc(doc(owner, invites, "new"), { [field]: "home", createdBy: "owner", expiresAt: Date.now() + 60000 }));
      });
    }
    await t.test("recibo ausente, ajeno, antiguo o con fecha futura nunca abre las reglas", async () => {
      for (const change of [{ uid: "other" }, { version: "old" }, { termsHash: "f".repeat(64) }, { privacyRead: false }, { acceptedAt: Date.now() + 600000 }]) {
        await admin.doc("legalAcceptances/owner").set({ format: 1, uid: "owner", ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt: Date.now() - 1000, ...change });
        await assertFails(updateDoc(doc(owner, "familySpaces", "home"), { nombre: "Otro" }));
      }
      await admin.doc("legalAcceptances/owner").delete();
    });
    await acceptLegalDocuments(admin, "owner", payload);
    await t.test("elección vigente permite espacio/nombre/movimiento/invitación con permisos anteriores", async () => {
      for (const kind of ["family", "box"]) {
        const spaces = kind === "family" ? "familySpaces" : "boxSpaces", invites = kind === "family" ? "familyInvites" : "boxInvites", field = kind === "family" ? "familyId" : "boxId";
        await assertSucceeds(updateDoc(doc(owner, spaces, "home"), { nombre: "Otro" }));
        await assertSucceeds(setDoc(doc(owner, spaces, "home", "movements", "new"), movement));
        await assertSucceeds(setDoc(doc(owner, invites, "new"), { [field]: "home", createdBy: "owner", expiresAt: Date.now() + 60000 }));
        const batch = writeBatch(owner);
        batch.set(doc(owner, spaces, "fresh"), { nombre: "Nueva", ownerUid: "owner", currency: "PEN", [kind === "family" ? "creadoEn" : "creadaEn"]: serverTimestamp() });
        batch.set(doc(owner, spaces, "fresh", "members", "owner"), { uid: "owner", nombre: "Ana", rol: "owner", unidoEn: serverTimestamp() });
        await assertSucceeds(batch.commit());
      }
    });
    await t.test("miembro Gratis necesita elección propia; invitación se conserva al rechazar", async () => {
      for (const kind of ["family", "box"]) {
        const spaces = kind === "family" ? "familySpaces" : "boxSpaces", invites = kind === "family" ? "familyInvites" : "boxInvites";
        const join = () => { const batch = writeBatch(free); batch.set(doc(free, spaces, "home", "members", "free"), { uid: "free", nombre: "Ana", rol: "member", unidoEn: serverTimestamp(), inviteCode: "new" }); batch.delete(doc(free, invites, "new")); return batch.commit(); };
        await assertFails(join()); assert.equal((await getDoc(doc(owner, invites, "new"))).exists(), true);
        await acceptLegalDocuments(admin, "free", payload); await assertSucceeds(join());
        await admin.doc("legalAcceptances/free").delete();
        await assertSucceeds(getDoc(doc(free, spaces, "home", "movements", "new")));
      }
    });
    await t.test("ni dueño/Pro ni otro usuario pueden fabricar, leer o borrar recibos por SDK", async () => {
      for (const sdk of [owner, free]) for (const uid of ["owner", "free"]) {
        await assertFails(getDoc(doc(sdk, "legalAcceptances", uid)));
        await assertFails(setDoc(doc(sdk, "legalAcceptances", uid), { ...DOCUMENTS, uid }));
        await assertFails(deleteDoc(doc(sdk, "legalAcceptances", uid)));
      }
    });
    await t.test("borrado pendiente bloquea nuevas altas aunque quede recibo válido", async () => {
      await admin.doc("premiumTrialClaims/owner").set({ deletionPending: true });
      await assertFails(setDoc(doc(owner, "familySpaces", "home", "movements", "late"), movement));
      await assertSucceeds(getDoc(doc(owner, "familySpaces", "home")));
      await assertSucceeds(deleteDoc(doc(owner, "familySpaces", "home", "movements", "new")));
    });
  } finally { await env.cleanup(); await deleteApp(app); }
});

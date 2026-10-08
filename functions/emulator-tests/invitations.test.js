"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, deleteDoc, writeBatch, runTransaction, serverTimestamp } = require("firebase/firestore");
const root = path.resolve(__dirname, "../..");
const { DOCUMENTS } = require("../src/legal-acceptance");

test("Invitaciones Familia/Caja: una entrada consume su código en el mismo guardado", async t => {
  const { handlerOriginal } = await import("../../pruebas/helpers/handler-original.mjs");
  const baseline = process.env.FINO_TEST_INVITES_BASELINE;
  if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("La regresión exige un hash Git.");
  const env = await initializeTestEnvironment({ projectId: baseline ? "demo-fino-invitations-baseline" : "demo-fino-invitations", firestore: {
    host: "127.0.0.1", port: 8080, rules: baseline
      ? execFileSync("git", ["show", `${baseline}:firestore.rules`], { cwd: root, encoding: "utf8" })
      : fs.readFileSync(path.join(root, "firestore.rules"), "utf8") } });
  function database(uid, verified = true) { return env.authenticatedContext(uid, { email_verified: verified }).firestore(); }
  const owner = database("owner");
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, "users", "owner"), { isPremium: true });
      // Estos escenarios prueban invitaciones con elección vigente; la ausencia
      // y el callable real se prueban en las suites legal-acceptance aparte.
      for (const uid of ["owner", ...["family", "box"].flatMap(kind => ["single", "ok", "reuse", "bad", "race-a", "race-b", "deleting", "closed"].map(suffix => `${kind}-${suffix}`))]) {
        await setDoc(doc(db, "legalAcceptances", uid), { format: 1, uid, ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt: Date.now() - 1000 });
      }
      for (const name of ["familySpaces", "boxSpaces"]) {
        await setDoc(doc(db, name, "home"), { ownerUid: "owner", nombre: "Demo", currency: "PEN", creadoEn: serverTimestamp(), creadaEn: serverTimestamp() });
        await setDoc(doc(db, name, "home", "members", "owner"), { uid: "owner", rol: "owner" });
        await setDoc(doc(db, name, "other"), { ownerUid: "owner", nombre: "Otro", currency: "PEN" });
      }
    });
    for (const kind of ["family", "box"]) {
      const collection = kind === "family" ? "familySpaces" : "boxSpaces";
      const invites = kind === "family" ? "familyInvites" : "boxInvites";
      const field = kind === "family" ? "familyId" : "boxId";
      const source = path.join(root, kind === "family" ? "utils/cloudFamilia.ts" : "utils/cloudCajasCompartidas.ts");
      const makeInvite = async (code, extras = {}) => env.withSecurityRulesDisabled(context =>
        setDoc(doc(context.firestore(), invites, code), { [field]: "home", createdBy: "owner", expiresAt: Date.now() + 60000, ...extras }));
      const member = (uid, code) => ({ uid, nombre: "Invitado", rol: "member", inviteCode: code, unidoEn: serverTimestamp() });
      async function rawJoin(db, uid, code, consume = true, space = "home", extraWrite) {
        const batch = writeBatch(db);
        batch.set(doc(db, collection, space, "members", uid), member(uid, code));
        if (consume) batch.delete(doc(db, invites, code));
        if (extraWrite) extraWrite(batch);
        return batch.commit();
      }
      function originalJoin(db) {
        const alNumero = () => 123; // Solo formato de la fecha mostrada; no decide permisos ni escribe.
        const deps = { db, doc, getDoc, runTransaction, serverTimestamp, alNumero, assertSharedContentAccepted: async () => {} };
        if (kind === "box") deps.desdeDocumento = handlerOriginal(source, "desdeDocumento", { alNumero });
        return handlerOriginal(source, kind === "family" ? "unirseAFamilia" : "unirseACaja", deps);
      }
      await t.test(`${kind}: no se puede entrar sin consumir, ni quitar el código sin entrar`, async () => {
        await makeInvite("SINGLE01");
        const db = database(`${kind}-single`);
        await assertFails(rawJoin(db, `${kind}-single`, "SINGLE01", false));
        await assertFails(deleteDoc(doc(db, invites, "SINGLE01")));
        assert.equal((await getDoc(doc(owner, invites, "SINGLE01"))).exists(), true);
      });
      await t.test(`${kind}: cliente original guarda membresía, índices y consumo juntos; no se reutiliza`, async () => {
        const uid = `${kind}-ok`, db = database(uid);
        await makeInvite("NORMAL01");
        const joined = await originalJoin(db)(uid, "Invitado", " normal01 ");
        assert.equal(joined.id, "home"); assert.equal(joined.currency, "PEN");
        assert.equal((await getDoc(doc(owner, invites, "NORMAL01"))).exists(), false);
        assert.equal((await getDoc(doc(db, collection, "home", "members", uid))).data().inviteCode, "NORMAL01");
        const index = kind === "family" ? doc(db, "familyUsers", uid, "spaces", "home") : doc(db, "boxUsers", uid, "spaces", "home");
        assert.equal((await getDoc(index)).exists(), true);
        await assertFails(rawJoin(database(`${kind}-reuse`), `${kind}-reuse`, "NORMAL01"));
        await makeInvite("OTHER001");
        await assertFails(deleteDoc(doc(db, invites, "OTHER001")), "Un miembro no revoca invitaciones ajenas");
        await assertSucceeds(deleteDoc(doc(owner, invites, "OTHER001")));
      });
      await t.test(`${kind}: destino equivocado, vencimiento, no verificado y lote fallido conservan código`, async () => {
        const uid = `${kind}-bad`, db = database(uid);
        await makeInvite("WRONG001");
        await assertFails(rawJoin(db, uid, "WRONG001", true, "other"));
        await assertFails(rawJoin(database(uid, false), uid, "WRONG001"));
        await assertFails(rawJoin(db, uid, "WRONG001", true, "home", batch =>
          batch.set(doc(db, "users", "victim"), { isPremium: true })));
        assert.equal((await getDoc(doc(owner, invites, "WRONG001"))).exists(), true);
        await makeInvite("EXPIRED1", { expiresAt: Date.now() - 10000 });
        await assertFails(rawJoin(db, uid, "EXPIRED1"));
      });
      await t.test(`${kind}: dos usuarios con el mismo código no entran ambos`, async () => {
        await makeInvite("RACE0001");
        const uids = [`${kind}-race-a`, `${kind}-race-b`];
        const results = await Promise.allSettled(uids.map(uid => originalJoin(database(uid))(uid, "Demo", "RACE0001")));
        assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
        const members = await Promise.all(uids.map(uid => getDoc(doc(owner, collection, "home", "members", uid))));
        assert.equal(members.filter(snapshot => snapshot.exists()).length, 1);
        assert.equal((await getDoc(doc(owner, invites, "RACE0001"))).exists(), false);
      });
      await t.test(`${kind}: una cuenta en eliminación no puede volver a entrar con una petición atrasada`, async () => {
        const uid = `${kind}-deleting`, db = database(uid);
        for (const marker of ["users", "premiumTrialClaims"]) {
          await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), marker, uid),
            marker === "users" ? { accountDeletionPending: true } : { deletionPending: true }));
          await makeInvite("DELETE01");
          await assertFails(rawJoin(db, uid, "DELETE01"));
          assert.equal((await getDoc(doc(owner, invites, "DELETE01"))).exists(), true);
          await env.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), marker, uid)));
        }
      });
      await t.test(`${kind}: cerrado, en borrado o dueño sin Pro no admite invitación`, async () => {
        const uid = `${kind}-closed`, db = database(uid);
        for (const patch of [{ closed: true }, { deleting: true }, { closing: true }]) {
          await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), collection, "home"),
            { ownerUid: "owner", nombre: "Demo", currency: "PEN", ...patch }));
          await makeInvite("CLOSED01");
          await assertFails(rawJoin(db, uid, "CLOSED01"));
        }
        await env.withSecurityRulesDisabled(async context => {
          await setDoc(doc(context.firestore(), collection, "home"), { ownerUid: "owner", nombre: "Demo", currency: "PEN" });
          await setDoc(doc(context.firestore(), "users", "owner"), { isPremium: false });
        });
        await makeInvite("FREE0001");
        await assertFails(rawJoin(db, uid, "FREE0001"));
        await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "users", "owner"), { isPremium: true }));
      });
    }
  } finally { await env.cleanup(); }
});

"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path"), { createRequire } = require("node:module");
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth"), { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const requireRoot = createRequire(path.resolve(__dirname, "../../package.json"));
const { initializeApp, deleteApp } = requireRoot("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword, deleteUser } = requireRoot("firebase/auth");
const { getFunctions, connectFunctionsEmulator, httpsCallable } = requireRoot("firebase/functions");
const { DOCUMENTS, acceptLegalDocuments } = require("../src/legal-acceptance");
const { digestSource } = require("../src/private-box-migration");
test("aceptación HTTP: Auth real local, transacción, borrado y token atrasado", { timeout: 120000 }, async t => {
  assert.equal(Number(process.versions.node.split(".")[0]), 22);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099"); assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  const projectId = "demo-fino-node22", adminApp = initializeAdmin({ projectId }, "legal-http-admin"), admin = getAdminFirestore(adminApp), adminAuth = getAdminAuth(adminApp), apps = [];
  const input = { termsHash: DOCUMENTS.termsHash, privacyHash: DOCUMENTS.privacyHash, termsAccepted: true, privacyRead: true };
  async function account(uid, verified = true) {
    await adminAuth.createUser({ uid, email: `${uid}@example.test`, emailVerified: verified, password: "LocalPrueba123!" });
    const app = initializeApp({ projectId, apiKey: "demo-only", authDomain: `${projectId}.firebaseapp.com` }, uid); apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    const functions = getFunctions(app, "southamerica-east1"); connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    await signInWithEmailAndPassword(auth, `${uid}@example.test`, "LocalPrueba123!");
    return { auth, functions, accept: data => httpsCallable(functions, "acceptLegalDocuments")(data) };
  }
  const reason = expected => error => error.details?.reason === expected;
  try {
    const a = await account("legal-free"), unverified = await account("legal-unverified", false);
    let original;
    await t.test("Gratis confirma elección propia; reintento y dos llamadas no cambian fecha", async () => {
      original = (await a.accept(input)).data; assert.equal(original.uid, "legal-free"); assert.equal(original.version, DOCUMENTS.version);
      assert.ok(Number.isSafeInteger(original.acceptedAt));
      const results = await Promise.all([a.accept(input), a.accept(input)]);
      for (const result of results) assert.deepEqual(result.data, original);
      assert.deepEqual((await admin.doc("legalAcceptances/legal-free").get()).data(), original);
      assert.equal((await admin.doc("users/legal-free").get()).exists, false, "no crea respaldo personal Gratis");
      const b = await account("legal-concurrent");
      const first = await Promise.all([b.accept(input), b.accept(input)]);
      assert.deepEqual(first[0].data, first[1].data, "la primera aceptación concurrente también conserva una fecha única");
    });
    await t.test("no crea aceptación para UID del cuerpo ni documentos no vigentes", async () => {
      await assert.rejects(a.accept({ ...input, uid: "other" }), reason("legal-invalid-request"));
      await assert.rejects(a.accept({ ...input, privacyHash: "f".repeat(64) }), reason("legal-version-changed"));
      await assert.rejects(a.accept({ ...input, termsAccepted: false }), reason("legal-invalid-request"));
      assert.equal((await admin.doc("legalAcceptances/other").get()).exists, false);
    });
    await t.test("sin verificar o deshabilitado no acepta pese al token antiguo", async () => {
      await assert.rejects(unverified.accept(input), e => e.code === "functions/unauthenticated");
      await adminAuth.updateUser("legal-free", { disabled: true });
      await assert.rejects(a.accept(input), e => e.code === "functions/unauthenticated");
      await adminAuth.updateUser("legal-free", { disabled: false });
    });
    await t.test("cerrar/borrar sin aceptación no cambia dinero ni exige renovar Pro", async () => {
      await admin.doc("users/legal-free").set({ isPremium: false });
      await admin.doc("legalAcceptances/legal-free").delete();
      const space = admin.doc("familySpaces/legal-consumed"); await space.set({ ownerUid: "legal-free", currency: "PEN", nombre: "Casa" });
      await space.collection("members").doc("legal-free").set({ uid: "legal-free", rol: "owner" });
      await space.collection("movements").doc("in").set({ tipo: "ingreso", monto: 100, personalOwnerUid: "legal-free", personalTransactionId: 1 });
      await space.collection("movements").doc("out").set({ tipo: "gasto", monto: 100 });
      await httpsCallable(a.functions, "manageLinkedSpace")({ kind: "family", spaceId: space.id, action: "close" });
      assert.equal((await space.get()).data().closed, true); assert.equal((await space.collection("movements").get()).size, 2);
    });
    await t.test("editar texto de aporte por HTTP exige aceptación; deshacer dinero no la exige", async () => {
      const owner = await account("legal-owner");
      await admin.doc("users/legal-owner").set({ isPremium: true });
      const space = admin.doc("familySpaces/legal-edit"), row = space.collection("movements").doc("contribution");
      await space.set({ ownerUid: "legal-owner", nombre: "Casa", currency: "PEN" });
      await space.collection("members").doc("legal-owner").set({ uid: "legal-owner", rol: "owner" });
      await row.set({ tipo: "ingreso", monto: 100, descripcion: "Original", personalTransactionId: 10, personalOwnerUid: "legal-owner", creadoPor: "legal-owner" });
      const change = httpsCallable(owner.functions, "changePersonalContribution");
      const body = { kind: "family", spaceId: space.id, movementId: row.id, action: "update", amount: 100, description: "Nuevo" };
      await assert.rejects(change(body), reason("legal-acceptance-required"));
      assert.equal((await row.get()).data().descripcion, "Original");
      await owner.accept(input); await change(body);
      assert.equal((await row.get()).data().descripcion, "Nuevo");
      await admin.doc("legalAcceptances/legal-owner").delete();
      await change({ ...body, action: "delete" }); assert.equal((await row.get()).exists, false);
    });
    await t.test("iniciar conversión exige aceptación, recuperar/finalizar la ya iniciada no", async () => {
      const owner = await account("legal-migration"); await admin.doc("users/legal-migration").set({ isPremium: true });
      const box = { id: "box", nombre: "Caja", creadaEn: 1 }, origin = admin.doc("cajas/legal-migration");
      await origin.set({ cajas: [box], movimientos: [], cajasBorradas: [], movimientosBorrados: [] });
      const payload = { sourceId: box.id, digest: digestSource(box, [], "PEN"), currency: "PEN", attemptId: "legal-attempt-000001" };
      const migrate = httpsCallable(owner.functions, "privateBoxMigration");
      await assert.rejects(migrate({ ...payload, action: "begin", memberName: "Ana" }), reason("legal-acceptance-required"));
      assert.equal((await admin.doc("boxSpaces/legal-migration_box").get()).exists, false);
      await owner.accept(input); await migrate({ ...payload, action: "begin", memberName: "Ana" });
      await admin.doc("legalAcceptances/legal-migration").delete(); await admin.doc("users/legal-migration").update({ isPremium: false });
      const result = (await migrate({ ...payload, action: "finish" })).data; assert.equal(result.complete, true);
      assert.equal((await migrate({ ...payload, action: "status" })).data.complete, true);
      assert.equal((await origin.get()).data().cajas.length, 0);
    });
    await t.test("barrera de cierre, borrado Auth y petición atrasada no recrean recibo", async () => {
      await a.accept(input); await admin.doc("premiumTrialClaims/legal-free").set({ deletionPending: true });
      await assert.rejects(a.accept(input), reason("legal-account-closing"));
      await admin.doc("premiumTrialClaims/legal-free").delete();
      const token = await a.auth.currentUser.getIdToken(); await deleteUser(a.auth.currentUser);
      const until = Date.now() + 25000;
      while ((await admin.doc("legalAcceptances/legal-free").get()).exists && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 200));
      assert.equal((await admin.doc("legalAcceptances/legal-free").get()).exists, false);
      const response = await fetch(`http://127.0.0.1:5001/${projectId}/southamerica-east1/acceptLegalDocuments`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ data: input }) });
      assert.ok(response.status >= 400);
      await assert.rejects(acceptLegalDocuments(admin, "legal-free", input), /legal-account-closing/);
      assert.equal((await admin.doc("legalAcceptances/legal-free").get()).exists, false);
    });
  } finally { await Promise.all(apps.map(deleteApp)); await deleteAdmin(adminApp); }
});

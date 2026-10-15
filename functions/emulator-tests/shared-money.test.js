"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { initializeTestEnvironment, assertFails } = require("@firebase/rules-unit-testing");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { addDoc, collection, serverTimestamp, doc, deleteDoc, setDoc } = require("firebase/firestore");
const { mutateSharedMovement } = require("../src/shared-movements");
const { DOCUMENTS } = require("../src/legal-acceptance");

test("Familia/Caja: saldo transaccional, borrados, reintentos y permisos reales", { timeout: 120_000 }, async t => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  const baseline = process.env.FINO_TEST_SHARED_BASELINE;
  if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Hash inválido");
  const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
  const projectId = baseline ? "demo-fino-shared-money-old" : "demo-fino-shared-money";
  const env = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080, rules: read("firestore.rules") } });
  const app = initializeApp({ projectId }, "shared-money");
  const db = getFirestore(app);
  const movement = (tipo = "gasto", monto = 80) => ({ tipo, monto, descripcion: "Prueba aislada", fecha: "2026-10-15", method: "cash" });
  const client = uid => env.authenticatedContext(uid, { email_verified: true }).firestore();
  const legal = uid => db.doc(`legalAcceptances/${uid}`).set({ format: 1, uid, ...DOCUMENTS, termsAccepted: true, privacyRead: true, acceptedAt: Date.now() - 1000 });
  try {
    await env.clearFirestore();
    await db.doc("users/owner").set({ isPremium: true });
    for (const uid of ["owner", "member", "stranger"]) await legal(uid);
    for (const kind of ["family", "box"]) {
      const spaceId = `shared-${kind}`, rootName = kind === "family" ? "familySpaces" : "boxSpaces";
      const ref = db.doc(`${rootName}/${spaceId}`);
      const create = async (uid, movementId, data) => {
        if (!baseline) return mutateSharedMovement(db, uid, { kind, spaceId, action: "create", movementId, movement: data });
        // Ejecuta el escritor anterior ORIGINAL, no una traducción del error.
        const file = kind === "family" ? "utils/cloudFamilia.ts" : "utils/cloudCajasCompartidas.ts";
        const name = kind === "family" ? "guardarMovimientoFamilia" : "guardarMovimientoCajaCompartida";
        const source = read(file), start = source.indexOf(`export async function ${name}`);
        const body = source.slice(source.indexOf("{", source.indexOf("Promise<string>", start)) + 1, source.indexOf("\n}", start));
        const fn = new Function("assertSharedContentAccepted", "isSafeMoneyAmount", "addDoc", "collection", "db", "serverTimestamp",
          `return async function(${kind === "family" ? "familyId" : "boxId"},uid,movimiento){${body}}`)(async () => {}, Number.isFinite, addDoc, collection, client(uid), serverTimestamp);
        return fn(spaceId, uid, data);
      };
      const seed = async () => {
        await ref.set({ ownerUid: "owner", currency: "PEN", nombre: "Demo" });
        for (const uid of ["owner", "member"]) await ref.collection("members").doc(uid).set({ uid });
        const rows = await ref.collection("movements").get();
        for (const row of rows.docs) await row.ref.delete();
        const receipts = await ref.collection("moneyOperations").get();
        for (const row of receipts.docs) await row.ref.delete();
        await ref.collection("movements").doc("initial").set({ ...movement("ingreso", 100), creadoPor: "owner", creadoEn: 1 });
      };
      await t.test(`${kind}: dos gastos simultáneos no pueden consumir el mismo saldo`, async () => {
        await seed();
        const results = await Promise.allSettled([create("owner", "expense-a", movement()), create("member", "expense-b", movement())]);
        assert.equal(results.filter(item => item.status === "fulfilled").length, 1, "solo uno de los dos gastos de 80 cabe en un saldo de 100");
        const rows = await ref.collection("movements").get();
        assert.equal(rows.docs.reduce((sum, row) => sum + (row.data().tipo === "ingreso" ? row.data().monto : -row.data().monto), 0), 20);
      });
      if (baseline) continue; // La regresión termina por la conducta financiera de arriba.
      await t.test(`${kind}: borrar ingreso utilizado se rechaza, borrar gasto devuelve disponibilidad`, async () => {
        await seed(); await create("owner", "spent", movement());
        await assert.rejects(mutateSharedMovement(db, "owner", { kind, spaceId, action: "delete", movementId: "initial" }), error => error.reason === "shared-insufficient-balance");
        assert.equal((await ref.collection("movements").doc("initial").get()).exists, true);
        await mutateSharedMovement(db, "owner", { kind, spaceId, action: "delete", movementId: "spent" });
        await mutateSharedMovement(db, "owner", { kind, spaceId, action: "delete", movementId: "initial" });
        assert.equal((await ref.collection("movements").get()).size, 0);
      });
      await t.test(`${kind}: reglas SDK cierran el atajo de gastos/borrados sin servidor`, async () => {
        await seed(); const sdk = client("owner");
        await assertFails(setDoc(doc(sdk, rootName, spaceId, "movements", "bypass"), { ...movement(), creadoPor: "owner", creadoEn: serverTimestamp() }));
        await assertFails(deleteDoc(doc(sdk, rootName, spaceId, "movements", "initial")));
        // También los ingresos deben serializarse frente al cierre del espacio.
        await assertFails(setDoc(doc(sdk, rootName, spaceId, "movements", "legacy-income"), { ...movement("ingreso", 1), creadoPor: "owner", creadoEn: serverTimestamp() }));
        await assertFails(setDoc(doc(sdk, rootName, spaceId, "moneyOperations", "forged"), { fingerprint: "fake" }));
      });
      await t.test(`${kind}: reintentar no duplica ni revive un movimiento borrado`, async () => {
        await seed(); const first = await create("owner", "same", movement("gasto", 10));
        assert.deepEqual(await create("owner", "same", movement("gasto", 10)), first);
        await assert.rejects(create("owner", "same", movement("gasto", 11)), error => error.reason === "shared-conflict");
        await mutateSharedMovement(db, "owner", { kind, spaceId, action: "delete", movementId: "same" });
        await assert.rejects(create("owner", "same", movement("gasto", 10)), error => error.reason === "shared-conflict");
        assert.equal((await ref.collection("movements").doc("same").get()).exists, false);
      });
      await t.test(`${kind}: no redondea céntimos ni acepta fechas/montos/enlaces falsos`, async () => {
        await seed();
        for (const invalid of [{ ...movement(), monto: 0.001 }, { ...movement(), fecha: "2026-02-30" }, { ...movement(), personalReturnAmount: 80 },
          { ...movement("ingreso", 10), personalTransactionId: 10, personalOwnerUid: "stranger", method: "transfer" }]) {
          await assert.rejects(create("owner", "invalid", invalid));
        }
        await ref.collection("movements").doc("initial").update({ monto: 0.3 });
        await create("owner", "cent-a", movement("gasto", 0.1));
        await create("member", "cent-b", movement("gasto", 0.2));
        await assert.rejects(create("owner", "cent-c", movement("gasto", 0.01)), error => error.reason === "shared-insufficient-balance");
      });
      await t.test(`${kind}: miembro ajeno, cierre, cuenta sin Pro y datos dañados no escriben`, async () => {
        await seed(); await assert.rejects(create("stranger", "stranger", movement()), error => error.reason === "shared-permission-denied");
        await ref.update({ closed: true });
        await assert.rejects(create("owner", "closed", movement()), error => error.reason === "shared-space-closed");
        await ref.update({ closed: false }); await db.doc("users/owner").update({ isPremium: false });
        await assert.rejects(create("owner", "expired", movement()), error => error.reason === "shared-premium-required");
        await db.doc("users/owner").update({ isPremium: true });
        await ref.collection("movements").doc("broken").set({ tipo: "desconocido", monto: 100 });
        await assert.rejects(create("owner", "new-with-broken-ledger", movement()), error => error.reason === "shared-invalid-data");
        assert.equal((await ref.collection("movements").doc("broken").get()).data().tipo, "desconocido");
      });
      await t.test(`${kind}: retirar ingreso propio disponible no obliga a aceptar documentos nuevos ni renovar Pro`, async () => {
        await seed();
        await db.doc("legalAcceptances/owner").delete();
        await db.doc("users/owner").update({ isPremium: false });
        await mutateSharedMovement(db, "owner", { kind, spaceId, action: "delete", movementId: "initial" });
        assert.equal((await ref.collection("movements").get()).size, 0);
        await legal("owner"); await db.doc("users/owner").update({ isPremium: true });
      });
    }
  } finally { await env.cleanup(); await db.terminate(); await deleteApp(app); }
});

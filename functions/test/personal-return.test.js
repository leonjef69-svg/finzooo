"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { returnPersonalContribution, refundable, units } = require("../src/personal-return");

function database(currency = "PEN", movements = [
  { id: "sent", tipo: "ingreso", monto: 100, personalTransactionId: 10, personalOwnerUid: "owner", creadoEn: 1 },
  { id: "spent", tipo: "gasto", monto: 60, creadoEn: 2 },
]) {
  const entries = new Map([["familySpaces/f", { ownerUid: "owner", nombre: "Familia", currency }],
    ["familySpaces/f/members/owner", { uid: "owner" }], ...movements.map(item => [`familySpaces/f/movements/${item.id}`, item])]);
  const writes = [], queries = [];
  function doc(path) { return { path, collection: name => collection(`${path}/${name}`) }; }
  function collection(path) { return { path, query: true, doc: id => doc(`${path}/${id}`) }; }
  let queue = Promise.resolve();
  return { entries, writes, queries, doc, runTransaction: work => {
    const result = queue.then(async () => {
      const pending = [];
      const value = await work({ get: async ref => {
        if (ref.query) { queries.push(ref.path); return { docs: [...entries].filter(([path]) => path.startsWith(ref.path + "/"))
          .map(([path, data]) => ({ id: path.split("/").at(-1), data: () => data })) }; }
        return { exists: entries.has(ref.path), data: () => entries.get(ref.path) };
      }, set: (ref, data) => pending.push([ref.path, data]), update: (ref, data) => pending.push([ref.path, { ...entries.get(ref.path), ...data }]) });
      for (const [path, data] of pending) { entries.set(path, data); writes.push(path); }
      return value;
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  } };
}
const input = { kind: "family", spaceId: "f", personalTransactionId: 11, currency: "PEN", fecha: "2026-10-05", amount: 40, description: "Devolver" };
test("devuelve disponible sin Pro y el mismo identificador nunca confirma dos veces", async () => {
  const db = database();
  const receipt = await returnPersonalContribution(db, "owner", input, 1000);
  assert.equal(receipt.amount, 40);
  assert.deepEqual(receipt.allocations, [{ transactionId: 10, amount: 40 }]);
  assert.equal(db.writes.length, 3);
  assert.deepEqual(await returnPersonalContribution(db, "owner", input, 2000), receipt);
  assert.equal(db.writes.length, 3);
  assert.equal(db.queries.length, 1, "repetir una confirmación no descarga otra vez el historial");
});
test("otro miembro no recibe el aporte del propietario", async () => {
  const db = database(); db.entries.set("familySpaces/f/members/guest", { uid: "guest" });
  await assert.rejects(returnPersonalContribution(db, "guest", input), error => error.reason === "return-changed");
  await assert.rejects(returnPersonalContribution(db, "stranger", input), error => error.reason === "return-permission-denied");
  assert.equal(db.writes.length, 0);
});
test("no devuelve más o menos que el saldo confirmado y conserva un gasto total", async () => {
  for (const amount of [41, 39, 60]) {
    const db = database();
    await assert.rejects(returnPersonalContribution(db, "owner", { ...input, amount }), error => error.reason === "return-changed");
    assert.equal(db.writes.length, 0);
  }
  assert.equal(refundable([{ tipo: "ingreso", monto: 100, personalTransactionId: 10, personalOwnerUid: "owner" },
    { tipo: "gasto", monto: 100 }], "owner", "PEN").available, 0n);
});
test("dos solicitudes simultáneas diferentes no duplican una devolución", async () => {
  const db = database();
  const result = await Promise.allSettled([returnPersonalContribution(db, "owner", input),
    returnPersonalContribution(db, "owner", { ...input, personalTransactionId: 12 })]);
  assert.equal(result.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(db.writes.length, 3);
});
test("centavos exactos, moneda sin decimales y moneda con tres decimales", async () => {
  assert.equal(units(0.1 + 0.2, "PEN"), 30n);
  assert.equal(units(0.003, "BHD"), 3n);
  assert.equal(units(9_000_000_000_000, "JPY"), 9_000_000_000_000n);
  assert.throws(() => units(0.01, "JPY"));
  for (const [currency, sent, spent, amount] of [["PEN", 0.3, 0.1, 0.2], ["JPY", 3, 1, 2], ["BHD", 0.003, 0.001, 0.002]]) {
    const db = database(currency, [{ id: "sent", tipo: "ingreso", monto: sent, personalTransactionId: 10, personalOwnerUid: "owner" }, { id: "spent", tipo: "gasto", monto: spent }]);
    assert.equal((await returnPersonalContribution(db, "owner", { ...input, currency, amount })).amount, amount);
  }
});
test("bloquea fechas inválidas, cambio de moneda, espacio cerrado y choque de identificadores", async () => {
  await assert.rejects(returnPersonalContribution(database(), "owner", { ...input, fecha: "2026-02-30" }));
  await assert.rejects(returnPersonalContribution(database(), "owner", { ...input, spaceId: "../other" }));
  await assert.rejects(returnPersonalContribution(database(), "owner", { ...input, currency: "USD" }), error => error.reason === "return-currency-mismatch");
  await assert.rejects(returnPersonalContribution(database(), "owner", { ...input, personalTransactionId: 10 }), error => error.reason === "return-conflict");
  const closed = database(); closed.entries.get("familySpaces/f").closed = true;
  await assert.rejects(returnPersonalContribution(closed, "owner", input), error => error.reason === "return-space-closed");
  const corrupt = database(); corrupt.entries.get("familySpaces/f/movements/spent").monto = NaN;
  await assert.rejects(returnPersonalContribution(corrupt, "owner", input), error => error.reason === "return-invalid-data");
  const deleting = database(); deleting.entries.set("premiumTrialClaims/owner", { deletionPending: true });
  await assert.rejects(returnPersonalContribution(deleting, "owner", input), error => error.reason === "return-space-closed");
  assert.equal(deleting.writes.length, 0, "una cuenta en eliminación no crea nuevas devoluciones");
});
test("el comprobante propio sigue disponible tras eliminar el grupo", async () => {
  const db = database();
  const receipt = await returnPersonalContribution(db, "owner", input);
  for (const path of [...db.entries.keys()]) if (path.startsWith("familySpaces/")) db.entries.delete(path);
  assert.deepEqual(await returnPersonalContribution(db, "owner", input), receipt);
  assert.equal(db.writes.length, 3);
  await assert.rejects(returnPersonalContribution(db, "owner", { ...input, spaceId: "another" }), error => error.reason === "return-conflict");
});
test("un comprobante anulado no confirma otro ingreso aunque siga existiendo", async () => {
  const db = database();
  const receipt = await returnPersonalContribution(db, "owner", input);
  db.entries.set(`personalReturnReceipts/owner/operations/${receipt.movementId}`, { ...receipt, cancelled: true, cancelledAt: 2000 });
  await assert.rejects(returnPersonalContribution(db, "owner", input), error => error.reason === "return-cancelled");
  assert.equal(db.writes.length, 3, "un reintento anulado no modifica dinero ni comprobantes");
});

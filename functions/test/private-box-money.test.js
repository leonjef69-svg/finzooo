"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { resolvePrivateBoxMoney } = require("../src/private-box-money");
const { validateMoneyReview, moneyChoices, moneyResult } = require("../src/private-box-money-shared");
const copy = value => structuredClone(value);
const box = { id: "caja-a", nombre: "Viaje", creadaEn: 1, updatedAt: 10 };
const p = { id: 10, type: "expense", amount: 100, date: "2026-10-06", category: "otros", method: "transfer", description: "Aporte", notes: "Conservar", tags: ["viaje"], internalTransfer: "box", internalTransferLink: "mov-a", internalTransferSpaceId: box.id, updatedAt: 10 };
const m = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: p.date, creadoEn: 2, personalTransactionId: p.id, updatedAt: 10 };
const revision = { id: "money-operation-one", uid: "owner", currency: "PEN", box,
  local: { personal: p, movement: m }, remote: { personal: { ...p, amount: 80 }, movement: { ...m, monto: 80 } }, chosen: "local-personal", createdAt: 100, version: 100 };
function database(entry = revision, format = 1) {
  const entries = new Map([["users/owner", { isPremium: true, hasOnboarded: true, userCurrency: entry.currency, future: "conservar",
    ...(format === 2 ? { historyFormat: 2 } : { transactions: [copy(entry.remote.personal)], deletedTransactionIds: [] }) }],
  ["cajas/owner", { cajas: [copy(box)], movimientos: [copy(entry.remote.movement)], cajasBorradas: [], movimientosBorrados: ["mov-old"], future: "no borrar" }]]);
  if (format === 2) entries.set("users/owner/history/10", { id: 10, deleted: false, transaction: copy(entry.remote.personal), syncAt: "before" });
  const writes = []; let queue = Promise.resolve(), rejectCommit = false;
  const doc = path => ({ path, collection: name => collection(`${path}/${name}`) });
  const collection = (path, filters = [], count = Infinity) => ({ path, query: true, doc: id => doc(`${path}/${id}`),
    where: (key, operator, value) => { assert.equal(operator, "=="); return collection(path, [...filters, [key, value]], count); },
    limit: value => collection(path, filters, value), filters, count });
  const snap = (path, value) => ({ id: path.split("/").at(-1), exists: value !== undefined, data: () => copy(value) });
  return { entries, writes, doc, collection, failCommit: () => { rejectCommit = true; }, runTransaction: work => {
    const result = queue.then(async () => {
      const pending = [];
      const result = await work({ get: async ref => ref.query ? { docs: [...entries].filter(([path, value]) => path.startsWith(ref.path + "/") && path.split("/").length === ref.path.split("/").length + 1
        && ref.filters.every(([key, expected]) => key.split(".").reduce((item, part) => item?.[part], value) === expected)).slice(0, ref.count).map(([path, value]) => snap(path, value)) } : snap(ref.path, entries.get(ref.path)),
        update: (ref, value) => pending.push([ref.path, { ...entries.get(ref.path), ...copy(value) }]) });
      if (rejectCommit) throw Error("commit-interrupted");
      for (const [path, value] of pending) { entries.set(path, value); writes.push(path); } return result;
    }); queue = result.catch(() => {}); return result;
  } };
}
test("cuatro fuentes explícitas guardan Personal/Caja juntos y conservan campos y originales", async () => {
  for (const chosen of ["local-personal", "local-box", "remote-personal", "remote-box"]) {
    const entry = { ...copy(revision), chosen }, db = database(entry), before = copy(entry);
    assert.equal(moneyChoices(entry).length, 2);
    const ack = await resolvePrivateBoxMoney(db, "owner", entry), selected = moneyResult(entry);
    assert.equal(ack.amount, selected.personal.amount); assert.equal(db.entries.get("users/owner").transactions[0].amount, ack.amount);
    assert.equal(db.entries.get("cajas/owner").movimientos[0].monto, ack.amount); assert.equal(db.writes.length, 2);
    assert.equal(db.entries.get("users/owner").transactions[0].notes, "Conservar"); assert.equal(db.entries.get("users/owner").future, "conservar");
    assert.equal(db.entries.get("cajas/owner").future, "no borrar"); assert.deepEqual(db.entries.get("cajas/owner").movimientosBorrados, ["mov-old"]);
    assert.deepEqual(entry, before); assert.deepEqual(await resolvePrivateBoxMoney(db, "owner", entry), ack); assert.equal(db.writes.length, 2);
  }
});
test("una interrupción al confirmar no guarda solo una mitad", async () => {
  const db = database(), before = copy([...db.entries]); db.failCommit();
  await assert.rejects(resolvePrivateBoxMoney(db, "owner", revision), /commit-interrupted/);
  assert.deepEqual([...db.entries], before); assert.equal(db.writes.length, 0);
});
test("historial separado actualiza solo el documento exacto y no vuelve a introducir una lista raíz", async () => {
  const db = database(revision, 2); db.entries.set("users/owner/history/20", { id: 20, deleted: false, transaction: { ...p, id: 20, internalTransferLink: "otra" } });
  await resolvePrivateBoxMoney(db, "owner", revision);
  assert.equal(db.entries.get("users/owner").transactions, undefined); assert.equal(db.entries.get("users/owner/history/10").transaction.amount, 100);
  assert.equal(db.entries.get("users/owner/history/20").transaction.amount, p.amount); assert.equal(db.writes.includes("users/owner"), false);
});
test("fuente editada, ID duplicado, devolución, cierre, conversión y borrado no aceptan una elección vieja", async () => {
  for (const change of [db => { db.entries.get("users/owner").transactions[0].amount = 70; },
    db => { db.entries.get("cajas/owner").movimientos[0].updatedAt = 11; },
    db => { db.entries.get("cajas/owner").movimientos.push({ ...m, id: "duplicate" }); },
    db => { db.entries.get("cajas/owner").movimientos.push({ ...m, id: "returned", tipo: "gasto", personalTransactionId: 11, monto: 20, personalReturnAmount: 20 }); },
    db => { db.entries.get("cajas/owner").cajasBorradas.push(box.id); },
    db => { db.entries.get("cajas/owner").movimientosBorrados.push(m.id); },
    db => { db.entries.get("cajas/owner").syncFormat = 3; db.entries.get("cajas/owner").conversiones = { [box.id]: {} }; },
    db => { db.entries.get("users/owner").deletedTransactionIds.push(p.id); },
    db => { db.entries.get("users/owner").transactions.push({ ...p, id: 11 }); },
    db => { db.entries.get("users/owner").transactions[0].notes = NaN; }]) {
    const db = database(); change(db); const before = copy([...db.entries]);
    await assert.rejects(resolvePrivateBoxMoney(db, "owner", revision), /money-/); assert.equal(db.writes.length, 0); assert.deepEqual([...db.entries], before);
  }
  const db = database(revision, 2); db.entries.set("users/owner/history/11", { id: 11, deleted: false, transaction: { ...p, id: 11 } });
  await assert.rejects(resolvePrivateBoxMoney(db, "owner", revision), /source-changed/); assert.equal(db.writes.length, 0);
});
test("dos elecciones simultáneas diferentes no imponen dos resultados", async () => {
  const db = database();
  const result = await Promise.allSettled([resolvePrivateBoxMoney(db, "owner", revision), resolvePrivateBoxMoney(db, "owner", { ...copy(revision), chosen: "remote-personal", version: 101 })]);
  assert.equal(result.filter(item => item.status === "fulfilled").length, 1); assert.equal(db.writes.length, 2);
});
test("negativo, moneda cambiada, Pro vencido y cuenta en borrado se rechazan sin escribir", async () => {
  for (const change of [db => { db.entries.get("users/owner").isPremium = false; }, db => { db.entries.get("users/owner").userCurrency = "USD"; },
    db => { db.entries.get("users/owner").accountDeletionPending = true; },
    db => { db.entries.get("cajas/owner").movimientos.push({ ...m, id: "spent", tipo: "gasto", monto: 110, personalTransactionId: undefined }); }]) {
    const db = database(); change(db); await assert.rejects(resolvePrivateBoxMoney(db, "owner", revision), /money-/); assert.equal(db.writes.length, 0);
  }
  await assert.rejects(resolvePrivateBoxMoney(database(), "guest", revision), /invalid-review/);
});
test("validación compartida rechaza metadatos distintos, vinculación incorrecta, fechas e importes inválidos", () => {
  for (const change of [entry => { entry.remote.personal.notes = "Otra nota"; }, entry => { entry.remote.movement.descripcion = "Otra"; },
    entry => { entry.remote.personal.internalTransferSpaceId = "otra"; }, entry => { entry.local.personal.internalTransferSettled = true; },
    entry => { entry.remote.movement.personalReturnAmount = 80; }, entry => { entry.local.personal.date = "2026-02-30"; },
    entry => { entry.local.personal.amount = 1.001; }, entry => { entry.version = 10; }, entry => { entry.chosen = "inventado"; },
    entry => { entry.local.personal.extra = NaN; entry.remote.personal.extra = null; }]) {
    const entry = copy(revision); change(entry); assert.throws(() => validateMoneyReview(entry), /invalid-review/);
  }
});
test("monedas de cero/dos/tres decimales mantienen la escala exacta", async () => {
  for (const [currency, local, remote] of [["JPY", 101, 80], ["PEN", 100.01, 80.03], ["KWD", 100.001, 80.003]]) {
    const entry = { ...copy(revision), currency }; entry.local.personal.amount = local; entry.local.movement.monto = local;
    entry.remote.personal.amount = remote; entry.remote.movement.monto = remote;
    const db = database(entry); await resolvePrivateBoxMoney(db, "owner", entry);
    assert.equal(db.entries.get("cajas/owner").movimientos[0].monto, local); assert.equal(db.entries.get("users/owner").transactions[0].amount, local);
  }
});
test("copia incoherente solo ofrece valores existentes y no inventa una devolución", async () => {
  const entry = copy(revision); entry.local.personal.amount = 90; entry.remote.personal.amount = 70;
  assert.equal(moneyChoices(entry).length, 4); entry.chosen = "remote-personal";
  const db = database(entry); await resolvePrivateBoxMoney(db, "owner", entry);
  assert.equal(db.entries.get("cajas/owner").movimientos[0].monto, 70); assert.equal(db.entries.get("users/owner").transactions[0].amount, 70);
});
test("petición grande y versión de historial desconocida no escriben ni sustituyen datos", async () => {
  const entry = copy(revision); entry.extra = "x".repeat(150000);
  await assert.rejects(resolvePrivateBoxMoney(database(), "owner", entry), /review-too-large/);
  const db = database(); db.entries.get("users/owner").historyFormat = 99;
  await assert.rejects(resolvePrivateBoxMoney(db, "owner", revision), /invalid-source/); assert.equal(db.writes.length, 0);
});

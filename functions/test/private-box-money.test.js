"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { resolvePrivateBoxMoney, recoverPrivateBoxMoney, retirePrivateBoxMoney } = require("../src/private-box-money");
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
        update: (ref, value) => pending.push([ref.path, { ...entries.get(ref.path), ...copy(value) }]),
        set: (ref, value) => pending.push([ref.path, copy(value)]) });
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

test("respuesta perdida se recupera sin Pro solo con resultado exacto vigente, sin escrituras", async () => {
  for (const format of [1, 2]) {
    const db = database(revision, format);
    const ack = await resolvePrivateBoxMoney(db, "owner", revision);
    db.entries.get("users/owner").isPremium = false;
    const before = copy([...db.entries]), writes = db.writes.length;
    assert.deepEqual(await recoverPrivateBoxMoney(db, "owner", revision), ack);
    assert.deepEqual([...db.entries], before); assert.equal(db.writes.length, writes);
    await assert.rejects(resolvePrivateBoxMoney(db, "owner", { ...revision, readOnly: true, action: "recover" }), /premium-required/);
    assert.deepEqual([...db.entries], before);
  }
});
test("recuperar nunca inicia una corrección pendiente aunque la cuenta tenga Pro", async () => {
  for (const premium of [true, false]) {
    const db = database(); db.entries.get("users/owner").isPremium = premium;
    const before = copy([...db.entries]);
    await assert.rejects(recoverPrivateBoxMoney(db, "owner", { ...revision, action: "resolve", readOnly: false }), /money-not-confirmed/);
    assert.equal(db.writes.length, 0); assert.deepEqual([...db.entries], before);
  }
});
test("recuperación rechaza copia posterior, pareja parcial, borrado, cuenta y moneda distintas", async () => {
  for (const format of [1, 2]) for (const change of ["version", "notes", "partial", "duplicate", "deleted", "box", "return", "account", "claim-deleting", "currency", "history"]) {
    const db = database(revision, format); await resolvePrivateBoxMoney(db, "owner", revision);
    const user = db.entries.get("users/owner"), boxes = db.entries.get("cajas/owner"); user.isPremium = false;
    const row = format === 2 ? db.entries.get("users/owner/history/10").transaction : user.transactions[0];
    if (change === "version") row.updatedAt++;
    if (change === "notes") row.notes = "Cambio posterior";
    if (change === "partial") boxes.movimientos[0] = copy(revision.remote.movement);
    if (change === "duplicate") boxes.movimientos.push({ ...copy(boxes.movimientos[0]), id: "duplicate" });
    if (change === "deleted") { if (format === 2) db.entries.get("users/owner/history/10").deleted = true; else user.deletedTransactionIds.push(10); }
    if (change === "box") boxes.cajasBorradas.push(box.id);
    if (change === "return") boxes.movimientos.push({ ...copy(m), id: "returned", tipo: "gasto", monto: 20, personalTransactionId: 11, personalReturnAmount: 20 });
    if (change === "account") user.accountDeletionPending = true;
    if (change === "claim-deleting") db.entries.set("premiumTrialClaims/owner", { deletionPending: true });
    if (change === "currency") user.userCurrency = "USD";
    if (change === "history") user.historyFormat = 99;
    const before = copy([...db.entries]), writes = db.writes.length;
    await assert.rejects(recoverPrivateBoxMoney(db, "owner", revision), /money-/);
    assert.equal(db.writes.length, writes); assert.deepEqual([...db.entries], before);
  }
  await assert.rejects(recoverPrivateBoxMoney(database(), "guest", revision), /invalid-review/);
});
test("recuperación mantiene límites y rechaza diario local en servidor sin crear colecciones", async () => {
  const db = database(); const large = { ...revision, extra: "x".repeat(150000) };
  await assert.rejects(recoverPrivateBoxMoney(db, "owner", large), /review-too-large/);
  db.entries.get("cajas/owner").revisionesImporte = [];
  await assert.rejects(recoverPrivateBoxMoney(db, "owner", revision), /invalid-source/);
  assert.equal(db.writes.length, 0); assert.equal(db.entries.size, 2);
});

test("retiro sin Pro solo cuando Personal y Caja remotos coinciden con los locales; bloquea escrituras tardías", async () => {
  for (const format of [1, 2]) {
    const db = database(revision, format);
    const user = db.entries.get("users/owner"), boxes = db.entries.get("cajas/owner");
    if (format === 2) db.entries.get("users/owner/history/10").transaction = copy(p);
    else user.transactions[0] = copy(p);
    boxes.movimientos[0] = copy(m);
    user.isPremium = false;
    const beforeUser = copy(user), beforeBoxes = copy(boxes);
    const receipt = await retirePrivateBoxMoney(db, "owner", revision);
    assert.equal(receipt.status, "retired");
    assert.equal(receipt.id, revision.id);
    assert.match(receipt.digest, /^[a-f0-9]{64}$/);
    assert.deepEqual(user, beforeUser); assert.deepEqual(boxes, beforeBoxes);
    assert.deepEqual(db.writes, [`moneyReviewRetirements/owner/operations/${revision.id}`]);
    assert.deepEqual(await retirePrivateBoxMoney(db, "owner", revision), receipt);
    await assert.rejects(recoverPrivateBoxMoney(db, "owner", revision), /money-review-retired/);
    user.isPremium = true;
    await assert.rejects(resolvePrivateBoxMoney(db, "owner", revision), /money-review-retired/);
    assert.deepEqual(db.writes, [`moneyReviewRetirements/owner/operations/${revision.id}`]);
  }
});
test("retiro conserva el pendiente si las copias no coinciden o una fuente cambia", async () => {
  for (const change of [() => {}, db => { db.entries.get("users/owner").transactions[0] = copy(p); },
    db => { db.entries.get("cajas/owner").movimientos[0] = copy(m); },
    db => { db.entries.get("users/owner").transactions[0] = { ...p, notes: "modificado" }; db.entries.get("cajas/owner").movimientos[0] = copy(m); },
    db => { db.entries.get("users/owner").accountDeletionPending = true; },
    db => { db.entries.get("cajas/owner").movimientos.push({ ...m, id: "devolucion", tipo: "gasto", monto: 1, personalReturnAmount: 1 }); }]) {
    const db = database(); change(db);
    const before = copy([...db.entries]);
    await assert.rejects(retirePrivateBoxMoney(db, "owner", revision), /money-/);
    assert.deepEqual([...db.entries], before); assert.equal(db.writes.length, 0);
  }
});
test("retiro idempotente rechaza reutilizar el mismo ID con otra elección", async () => {
  const db = database();
  db.entries.get("users/owner").transactions[0] = copy(p);
  db.entries.get("cajas/owner").movimientos[0] = copy(m);
  await retirePrivateBoxMoney(db, "owner", revision);
  await assert.rejects(retirePrivateBoxMoney(db, "owner", { ...revision, chosen: "remote-personal" }), /money-review-retired/);
  assert.equal(db.writes.length, 1);
});
test("retiro mira el saldo actual, no el saldo hipotético de la elección vieja", async () => {
  const oldChoice = { ...revision, chosen: "remote-personal" }, db = database(oldChoice);
  db.entries.get("users/owner").transactions[0] = copy(p);
  db.entries.get("cajas/owner").movimientos = [copy(m), { ...m, id: "spent", tipo: "gasto", monto: 90, personalTransactionId: undefined }];
  assert.equal((await retirePrivateBoxMoney(db, "owner", oldChoice)).status, "retired");
  const invalid = database(oldChoice);
  invalid.entries.get("users/owner").transactions[0] = copy(p);
  invalid.entries.get("cajas/owner").movimientos = [copy(m), { ...m, id: "spent", tipo: "gasto", monto: 110, personalTransactionId: undefined }];
  await assert.rejects(retirePrivateBoxMoney(invalid, "owner", oldChoice), /money-invalid-source/);
});
test("si la elección ya se aplicó, retirar no falsea un recibo ni cambia el dinero", async () => {
  const db = database();
  await resolvePrivateBoxMoney(db, "owner", revision);
  db.entries.get("users/owner").isPremium = false;
  const before = copy([...db.entries]), count = db.writes.length;
  assert.deepEqual(await retirePrivateBoxMoney(db, "owner", revision), { status: "applied", uid: "owner", id: revision.id });
  assert.deepEqual([...db.entries], before); assert.equal(db.writes.length, count);
  assert.equal((await recoverPrivateBoxMoney(db, "owner", revision)).amount, 100);
});

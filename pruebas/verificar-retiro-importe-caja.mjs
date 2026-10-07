import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { createMoneyBatchHarness, box, movement, personal, other, entry, original } from "./verificar-lote-importe-caja.mjs";

const require = createRequire(import.meta.url), clone = value => structuredClone(value);
const { moneyAcknowledgement } = require("../functions/src/private-box-money-shared.js");
const localPersonal = { ...personal, amount: movement.monto };
const review = { ...entry, id: "money-retirement-0001", local: { personal: localPersonal, movement },
  remote: { personal, movement }, chosen: "local-personal" };
const old = { ...original, revisionesImporte: [review] };
const instances = [];
const receipt = () => ({ status: "retired", uid: review.uid, id: review.id, boxId: box.id,
  movementId: movement.id, personalId: localPersonal.id, digest: "a".repeat(64) });
function setup() {
  const h = createMoneyBatchHarness(null, review, old, [localPersonal, other]); instances.push(h);
  h.e.premium = false;
  h.port = { current: () => h.e.active, premium: () => h.e.premium, boxes: () => h.e.screen.current,
    local: h.ctx.readPrivateBoxMoneyLocal, stage() { throw Error("No se inicia otra elección"); },
    commit: (before, chosen, ack, lease, current) => h.ctx.commitPrivateBoxMoney(before, chosen, ack, lease, current, h.setBoxes),
    retire: (before, chosen, ack, lease, current) => h.ctx.retirePrivateBoxMoney(before, chosen, ack, lease, current, h.setBoxes) };
  h.e.send = async (payload, endpoint) => {
    assert.equal(endpoint, "retirePrivateBoxMoney"); assert.equal(payload.estado, undefined);
    return { data: receipt() };
  };
  h.runRetire = () => h.api.retirarImporteCaja(review.uid, review, h.port);
  return h;
}
try {
  {
    const h = setup(), beforeRows = clone(h.e.rows.current), beforeMovement = clone(h.e.screen.current.movimientos);
    assert.equal(await h.runRetire(), true);
    assert.deepEqual(h.e.endpoints, ["retirePrivateBoxMoney"]);
    assert.deepEqual(h.e.rows.current, beforeRows); assert.deepEqual(h.e.screen.current.movimientos, beforeMovement);
    assert.deepEqual(h.disk(h.api.STORAGE_KEYS.transactions), beforeRows);
    assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado, "retirado");
    assert.deepEqual(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].remote, review.remote);
    assert.equal(h.e.writes, 1); await h.api.flushPendingSaves();
    assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado, "retirado");
    await assert.rejects(h.runRetire(), /changed/);
  }
  {
    const h = setup();
    await h.api.withPrivateBoxMoneyReview(review.uid, async lease => {
      const ack = await h.api.requestPrivateBoxMoneyRetirement(review.uid, review, lease, h.port.local, h.port.current);
      assert.equal(ack.status, "retired");
      await assert.rejects(h.port.retire(h.e.screen.current, review, { ...ack }, lease, h.port.current), /unconfirmed/);
      assert.equal(h.e.writes, 0);
      assert.equal(await h.port.retire(h.e.screen.current, review, ack, lease, h.port.current), true);
    });
  }
  for (const failure of ["offline", "changed", "wrong-receipt", "disk", "row", "currency", "account"]) {
    const h = setup();
    if (failure === "offline") h.e.send = async () => { throw Error("offline"); };
    else if (failure === "changed") h.e.send = async () => { throw { details: { reason: "money-source-changed" } }; };
    else if (failure === "wrong-receipt") h.e.send = async () => ({ data: { ...receipt(), personalId: 99 } });
    else {
      h.e.send = async () => {
        if (failure === "disk") h.put(h.api.STORAGE_KEYS.cajasDinero, `v2:${JSON.stringify({ ...old, movimientosBorrados: [movement.id] })}`);
        if (failure === "row") h.ctx.setTransactions(rows => rows.map(row => row.id === localPersonal.id ? { ...row, updatedAt: 999 } : row));
        if (failure === "currency") h.ctx.setUserCurrency("USD");
        if (failure === "account") { h.e.uid = "B"; h.e.version.current++; }
        return { data: receipt() };
      };
    }
    await assert.rejects(h.runRetire());
    assert.equal(h.e.writes, 0, failure);
    assert.equal(h.e.screen.current.revisionesImporte[0].estado, "pendiente", failure);
  }
  for (const failure of ["rollback", "encrypt"]) {
    const h = setup(); if (failure === "encrypt") h.e.encryptFailure = true; else h.e.failure = failure;
    assert.equal(await h.runRetire(), false);
    assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado, "pendiente");
    h.e.failure = null; h.e.encryptFailure = false;
    assert.equal(await h.runRetire(), true);
    assert.deepEqual(h.e.endpoints, ["retirePrivateBoxMoney", "retirePrivateBoxMoney"]);
  }
  {
    const h = setup();
    h.e.send = async (payload, endpoint) => endpoint === "retirePrivateBoxMoney"
      ? { data: { status: "applied", uid: review.uid, id: review.id } }
      : { data: moneyAcknowledgement(payload) };
    assert.equal(await h.runRetire(), true);
    assert.deepEqual(h.e.endpoints, ["retirePrivateBoxMoney", "recoverPrivateBoxMoney"]);
    assert.equal(h.disk(h.api.STORAGE_KEYS.cajasDinero).revisionesImporte[0].estado, "confirmado");
    assert.equal(h.e.rows.current[0].amount, movement.monto);
  }
} finally { for (const h of instances) h.e.db.close(); }
const screen = fs.readFileSync("screens/Cajas.tsx", "utf8");
const component = fs.readFileSync("components/PrivateBoxMoneyReview.tsx", "utf8");
assert.match(screen, /trabajarImporteCaja\(\(\) => retirarImporteCaja\(accountUid, entry, moneyPort\(\)\), true, true\)/,
  "el botón debe permitir este cierre sin Pro y distinguir su aviso");
assert.match(screen, /retire=\{pedirRetirarImporteCaja\}/);
assert.match(component, /onPress=\{\(\) => retire\(entry\)\}/);
console.log("Retiro de Caja: sin Pro, recibo auténtico, lote local indivisible, originales y montos conservados; fallos mantienen el pendiente.");

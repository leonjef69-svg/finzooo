import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const baseline = process.env.FINO_TEST_LINK_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const code = baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
    module, exports: module.exports, require: name => load(name.replace("@/", "") + ".ts"), Error, Date });
  return cache[file] = module.exports;
}
const api = load("utils/privateBoxRepair.ts");
const box = { id: "caja-a", nombre: "Viaje", creadaEn: 1 };
const move = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte antiguo", fecha: "2026-10-06", creadoEn: 2 };
const data = { cajas: [box], movimientos: [move], cajasBorradas: [], movimientosBorrados: [] };
const tx = { id: 10, type: "expense", amount: 100, category: "otros", date: move.fecha, time: "12:00", method: "transfer", description: "Desde Personal", notes: "nota conservada", icono: "foto", internalTransfer: "box" };
const choice = { movementId: move.id, personalId: tx.id, from: "link" };
let resolved;
assert.doesNotThrow(() => { resolved = api.resolvePrivateBoxConflict(data, [tx], [], "a", choice); }, "una selección explícita comprobable debe poder unir las dos mitades antiguas");
assert.equal(resolved.data.movimientos[0].personalTransactionId, tx.id);
assert.equal(resolved.upserts[0].internalTransferLink, move.id); assert.equal(resolved.upserts[0].internalTransferSpaceId, box.id);
assert.equal(resolved.upserts[0].amount, tx.amount); assert.equal(resolved.data.movimientos[0].monto, move.monto);
assert.equal(resolved.upserts[0].notes, tx.notes); assert.equal(resolved.upserts[0].icono, tx.icono);
assert.equal(data.movimientos[0].personalTransactionId, undefined); assert.equal(tx.internalTransferLink, undefined);
api.validatePrivateBoxRepair(data, resolved.data, [tx], [], resolved.upserts, [], "a", choice);
assert.equal(api.planPrivateBoxRepair(data, [tx], [], "a").upserts.length, 0, "nunca elige el candidato automáticamente");
assert.equal(api.planPrivateBoxRepair(resolved.data, resolved.upserts, [], "a").upserts.length, 0, "repetir la carga no duplica la transferencia");
const candidates = (d = data, rows = [tx], deleted = []) => api.privateBoxLinkCandidates(d, rows, deleted, move.id);
assert.equal(candidates().length, 1);
assert.equal(candidates(data, [tx, { ...tx, id: 11 }]).length, 2, "muestra alternativas, no un ganador por orden");
for (const row of [{ ...tx, amount: 99 }, { ...tx, date: "2026-10-05" }, { ...tx, internalTransfer: "family" },
  { ...tx, internalTransfer: undefined }, { ...tx, internalTransferLink: "mov-otra" }, { ...tx, internalTransferSpaceId: "caja-otra" },
  { ...tx, internalTransferSettled: true }, { ...tx, type: "income" }, { ...tx, id: -1 }]) {
  assert.equal(candidates(data, [row]).length, 0);
  assert.throws(() => api.resolvePrivateBoxConflict(data, [row], [], "a", { ...choice, personalId: row.id }), /repair-conflict/);
}
assert.equal(candidates(data, [tx, tx]).length, 0, "IDs duplicados no ofrecen elección");
assert.equal(candidates(data, [tx], [10]).length, 0, "no resucita un borrado");
assert.equal(candidates({ ...data, movimientosBorrados: [move.id] }).length, 0);
assert.equal(candidates({ ...data, cajasBorradas: [box.id] }).length, 0);
assert.equal(candidates({ ...data, movimientos: [{ ...move, fecha: "2026-02-30" }] }, [{ ...tx, date: "2026-02-30" }]).length, 0);
assert.equal(candidates({ ...data, cajas: [{ ...box, sharingPending: true }] }).length, 0);
assert.equal(candidates({ ...data, movimientos: [{ ...move, personalTransactionId: 10 }] }).length, 0);
assert.equal(candidates({ ...data, movimientos: [move, { ...move, id: "mov-otro", personalTransactionId: 10 }] }).length, 0, "no reutiliza una mitad enlazada");
assert.equal(candidates({ ...data, movimientos: [move, { ...move, id: "mov-return", tipo: "gasto", monto: 40, personalReturnAmount: 40, personalTransactionId: 12 }] }).length, 0, "reparto antiguo no admite ajuste parcial");
assert.throws(() => api.resolvePrivateBoxConflict(data, [tx], [], "a", { ...choice, personalId: 99 }), /repair-conflict/);
const tree = ts.createSourceFile("Cajas.tsx", fs.readFileSync("screens/Cajas.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let confirm;
function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "confirmarEnlaceHeredado") confirm = node.getText(tree); ts.forEachChild(node, visit); }
visit(tree); assert.ok(confirm);
for (const kind of ["cancel", "ok", "disk", "account", "changed-personal", "changed-box", "premium", "missing"]) {
  const dialogs = [], writes = [], messages = [];
  const rows = [tx], source = data;
  const s = { datosActuales: { current: source }, personalActuales: { current: rows }, linkReview: move.id, cuentaActual: () => kind !== "account",
    guardandoRef: { current: false }, personalReady: true, cloudReady: true, premiumForSync: { current: false }, isPremium: false, compartiendo: false,
    deletedTransactionIds: [], syncIssue: null, accountUid: "a", nubeConfirmadaPara: { current: null }, privateBoxLinkCandidates: api.privateBoxLinkCandidates,
    resolvePrivateBoxConflict: api.resolvePrivateBoxConflict, t: key => key, fmt: String, Alert: { alert: (...args) => dialogs.push(args) },
    guardarCambioCaja: async (...args) => { writes.push(args); return kind !== "disk"; }, setLinkReview: value => messages.push(value), showToast: value => messages.push(value) };
  vm.runInNewContext(ts.transpile(confirm, { target: ts.ScriptTarget.ES2022 }), s);
  s.confirmarEnlaceHeredado(kind === "missing" ? 99 : 10);
  if (kind === "account" || kind === "missing") { assert.equal(dialogs.length, 0); assert.equal(writes.length, 0); continue; }
  if (kind === "cancel") { assert.equal(writes.length, 0); assert.equal(dialogs[0][2][0].style, "cancel"); continue; }
  if (kind === "changed-personal") s.personalActuales.current = [...rows];
  if (kind === "changed-box") s.datosActuales.current = { ...data };
  if (kind === "premium") s.premiumForSync.current = true;
  await dialogs[0][2][1].onPress();
  assert.equal(writes.length, ["ok", "disk"].includes(kind) ? 1 : 0, "un aviso obsoleto no guarda");
  assert.equal(messages.includes("boxes.repairSaved"), kind === "ok");
  if (writes.length) assert.equal(writes[0][3].from, "link");
}
let saveAction;
function findSave(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "guardarCambioCaja") saveAction = node.getText(tree); ts.forEachChild(node, findSave); }
findSave(tree); assert.ok(saveAction);
for (const mismatch of [true, false]) {
  const messages = [], warning = [], before = data;
  const s = { cuentaActual: () => true, guardandoRef: { current: false }, hasUnreadableLocalData: () => false, datosActuales: { current: before },
    setGuardando() {}, commitPrivateBoxData: async () => { if (mismatch) throw Error("private-box-source-changed"); return true; },
    setDatos() {}, setRepairCloudChanged: value => warning.push(value), showToast: key => messages.push(key), t: key => key, cloudReady: true, Error };
  vm.runInNewContext(ts.transpile(saveAction, { target: ts.ScriptTarget.ES2022 }), s);
  assert.equal(await s.guardarCambioCaja(resolved.data, resolved.upserts, [], choice), !mismatch);
  assert.equal(warning[0], mismatch);
  assert.equal(messages.includes("boxes.repairCloudChanged"), mismatch, "la diferencia remota se explica, no se presenta como un simple fallo de disco");
}
console.log("Enlace heredado: selección humana explícita, montos intactos, campos conservados, duplicados/borrados/consumo protegidos.");

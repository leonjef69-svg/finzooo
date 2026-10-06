import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const requireCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const requirePure = name => requireCore(name === "./utf8" ? "./utf8.ts" : name);
const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere hash Git.");
const load = file => {
  const source = baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), { module, exports: module.exports, require: requirePure });
  return module.exports;
};
const api = load("utils/cajas.ts");
const linksModule = { exports: {} };
vm.runInNewContext(ts.transpile(fs.readFileSync("utils/privateBoxPersonal.ts", "utf8"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), { module: linksModule, exports: linksModule.exports });
const box = { id: "caja-a", nombre: "A", creadaEn: 1 };
const row = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-05", creadoEn: 2, personalTransactionId: 10 };
const local = { cajas: [box], movimientos: [row], cajasBorradas: [], movimientosBorrados: [] };
const receipt = { uid: "a", sourceId: box.id, targetId: "a_caja-a", name: "A", currency: "PEN", createdAt: 1,
  digest: "a".repeat(64), completedAt: 3, links: [{ personalId: 10, movementId: row.id }] };
const remote = { cajas: [], movimientos: [], cajasBorradas: [box.id], movimientosBorrados: [row.id], syncFormat: 3, conversiones: { [box.id]: receipt } };
assert.throws(() => api.fusionarCajas(local, remote), /cajas-sync-conflict/, "una Caja convertida no borra ediciones de un teléfono atrasado por inferencia");
assert.equal(local.movimientos[0].monto, 100);
assert.equal(api.validarCajas(remote).conversiones[box.id].targetId, receipt.targetId);
assert.equal(api.fusionarCajas({ ...remote, conversiones: {} }, remote).syncFormat, 3);
assert.equal(api.fusionarCajas(remote, remote).conversiones[box.id].digest, receipt.digest);
assert.throws(() => api.fusionarCajas(remote, { ...remote, conversiones: { [box.id]: { ...receipt, digest: "b".repeat(64) } } }), /cajas-sync-conflict/);
// Ejecuta las dos funciones puras reales que usa la pantalla (no copia la lógica).
const source = fs.readFileSync("utils/boxMigration.ts", "utf8");
const tree = ts.createSourceFile("boxMigration.ts", source, ts.ScriptTarget.Latest, true);
const functions = tree.statements.filter(node => ts.isFunctionDeclaration(node) && ["retirarCajaConvertida", "enlacesCajaConvertida"].includes(node.name?.text)).map(node => node.getText(tree)).join("\n");
const module = { exports: {} }; vm.runInNewContext(ts.transpile(functions, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), { module, exports: module.exports });
const done = module.exports.retirarCajaConvertida(local, receipt);
assert.equal(done.cajas.length, 0); assert.equal(done.movimientos.length, 0); assert.equal(done.conversiones[box.id].digest, receipt.digest);
const transactions = [{ id: 10, type: "expense", amount: 100, internalTransfer: "box", internalTransferSpaceId: box.id, internalTransferLink: row.id, internalTransferSettled: true },
  { id: 11, amount: 5, internalTransfer: "box", internalTransferSpaceId: "otra", internalTransferLink: "otro" }];
const repaired = module.exports.enlacesCajaConvertida(transactions, receipt);
assert.equal(repaired.length, 1); assert.equal(repaired[0].amount, 100); assert.equal(repaired[0].internalTransferSettled, true);
assert.equal(repaired[0].internalTransferSpaceId, receipt.targetId);
assert.equal(module.exports.enlacesCajaConvertida(repaired, receipt).length, 0, "reintento no vuelve a modificar ni sumar dinero");
// Ejecuta la acción real de pantalla: Invitar puede fallar después de compartir,
// pero no deja la Caja privada visible ni pierde los enlaces a Personal.
const screen = fs.readFileSync("screens/Cajas.tsx", "utf8");
const screenTree = ts.createSourceFile("Cajas.tsx", screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let action;
function find(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "compartirCaja") action = node.getText(screenTree); ts.forEachChild(node, find); }
find(screenTree); assert.ok(action);
function harness() {
  const events = [], dataRef = { current: local };
  const scope = { Error, auth: { currentUser: { uid: "a" } }, caja: box, movimientos: [row], compartiendo: false,
    Platform: { OS: "android" }, privateBoxLinksMatch: linksModule.exports.privateBoxLinksMatch,
    guardandoRef: { current: false }, repairBlocked: false,
    conversionEnCurso: { current: false },
    isPremium: true, accountUid: "a", ready: true, userName: "A", userCurrency: "PEN", active: true,
    cuentaActual: () => scope.active, hasUnreadableLocalData: () => false, datosActuales: dataRef,
    transactions: transactions.map(row => ({ ...row, internalTransferSettled: false })), enlacesCajaConvertida: module.exports.enlacesCajaConvertida, retirarCajaConvertida: module.exports.retirarCajaConvertida,
    t: key => key, reportSyncError: () => events.push("conflict"), showToast: key => events.push(key),
    captureAccountTask: () => ({ current: () => scope.active, wait: async work => { assert.ok(scope.active); const value = await work(); assert.ok(scope.active); return value; } }),
    compartirCajaExistente: async () => ({ id: receipt.targetId, nombre: receipt.name, conversion: receipt }),
    huellaCaja: async (_box, rows) => rows[0].monto === 100 ? receipt.digest : "b".repeat(64),
    repairLinkedTransferTransactions: rows => events.push(["repair", rows]), setCompartiendo: value => events.push(["busy", value]),
    setDatos: work => { dataRef.current = work(dataRef.current); events.push("retired"); }, setCajaId: () => {}, setLista: () => {},
    guardarCambioCaja: async (next, upserts = []) => { if (upserts.length) scope.repairLinkedTransferTransactions(upserts); dataRef.current = next; events.push(next.cajas.some(row => row.id === box.id) ? "pending" : "retired"); return true; },
    nuevoIntentoCaja: () => "prueba-intento-0001",
    crearInvitacionCaja: async () => { events.push("invite"); throw new Error("network"); },
    irUnaVez: params => events.push(["open", params]), spaceErrorKey: () => "network" };
  vm.runInNewContext(ts.transpile(`${action}\nglobalThis.run = compartirCaja;`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), scope);
  return { scope, events, dataRef };
}
{
  const h = harness(); await h.scope.run();
  assert.ok(h.events.indexOf("retired") < h.events.indexOf("invite"), "la invitación no decide si se retira una copia ya confirmada");
  assert.equal(h.dataRef.current.cajas.length, 0); assert.ok(h.events.includes("boxes.invitationRetry"));
  assert.equal(h.events.find(item => Array.isArray(item) && item[0] === "open")[1].params.boxId, receipt.targetId);
}
{
  const h = harness(); h.scope.compartirCajaExistente = async () => {
    h.dataRef.current = { ...local, movimientos: [{ ...row, monto: 120 }] };
    return { id: receipt.targetId, nombre: receipt.name, conversion: receipt };
  };
  await h.scope.run(); assert.ok(h.events.includes("conflict")); assert.equal(h.dataRef.current.movimientos[0].monto, 120);
  assert.equal(h.events.includes("retired"), false, "una edición local durante la espera no se retira por una confirmación anterior");
}
{
  const h = harness(); h.scope.compartirCajaExistente = async () => { throw new Error("cajas-sharing-unconfirmed"); };
  await h.scope.run(); assert.ok(h.events.includes("conflict")); assert.equal(h.dataRef.current.cajas.length, 1);
  assert.equal(h.dataRef.current.cajas[0].sharingPending, true, "la señal se conserva para el próximo arranque");
}
{
  const h = harness(); h.scope.Platform.OS = "ios";
  h.scope.compartirCajaExistente = async () => { throw new Error("NO_SERVER_WRITE_ALLOWED"); };
  await h.scope.run(); assert.ok(h.events.includes("boxes.atomicAndroidOnly")); assert.equal(h.dataRef.current.cajas.length, 1);
}
console.log("Conversión de Caja: copia atrasada preservada, confirmación y enlaces sin duplicación comprobados.");

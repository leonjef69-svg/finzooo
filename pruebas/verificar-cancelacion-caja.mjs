import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const tree = ts.createSourceFile("Cajas.tsx", read("screens/Cajas.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let action;
function find(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "cancelarCompartirCaja") action = node.getText(tree); ts.forEachChild(node, find); }
find(tree); assert.ok(action, "debe existir la acción real de cancelar sin renovar Pro");
const box = { id: "caja-a", nombre: "A", creadaEn: 1, sharingPending: true, sharingAttempt: "prueba-intento-0001" };
const row = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-05", creadoEn: 2, personalTransactionId: 10 };
const initial = { cajas: [box], movimientos: [row], cajasBorradas: [], movimientosBorrados: [] };
const receipt = { uid: "a", sourceId: box.id, targetId: "a_caja-a", name: "A", currency: "PEN", createdAt: 1, digest: "a".repeat(64), completedAt: 3, links: [{ personalId: 10, movementId: row.id }] };
const migrationTree = ts.createSourceFile("boxMigration.ts", read("utils/boxMigration.ts"), ts.ScriptTarget.Latest, true);
const actual = migrationTree.statements.filter(node => ts.isFunctionDeclaration(node) && ["retirarCajaConvertida", "enlacesCajaConvertida"].includes(node.name?.text)).map(node => node.getText(migrationTree)).join("\n");
const module = { exports: {} }; vm.runInNewContext(ts.transpile(actual, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), { module, exports: module.exports });
function harness() {
  const events = [], ref = { current: initial };
  const scope = { Error, auth: { currentUser: { uid: "a" } }, caja: box, compartiendo: false, guardandoRef: { current: false }, cargandoUnion: false,
    isPremium: false, active: true, accountUid: "a", cuentaActual: () => scope.active, ready: true, hasUnreadableLocalData: () => false,
    conversionEnCurso: { current: false },
    datosActuales: ref, userCurrency: "PEN", transactions: [{ id: 10, amount: 100, type: "expense", internalTransfer: "box", internalTransferSpaceId: box.id, internalTransferLink: row.id }],
    captureAccountTask: () => ({ current: () => scope.active, wait: async work => { assert.ok(scope.active); const value = await work(); assert.ok(scope.active); return value; } }),
    cancelarConversionCaja: async () => null,
    ...module.exports, privateBoxLinksMatch: () => true,
    guardarCambioCaja: async (next, upserts = []) => { ref.current = next; events.push(["saved", upserts]); return true; },
    setCompartiendo: value => events.push(["busy", value]), setCajaId: () => {}, setLista: () => {},
    t: key => key, showToast: key => events.push(key), irUnaVez: params => events.push(["open", params]),
    setSyncIssue: value => events.push(["issue", value]), setRefreshVersion: () => events.push("refresh") };
  vm.runInNewContext(ts.transpile(`${action}\nglobalThis.run = cancelarCompartirCaja;`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), scope);
  return { scope, ref, events };
}
{
  const h = harness(); await h.scope.run(); assert.equal(h.ref.current.cajas[0].sharingPending, undefined); assert.equal(h.ref.current.cajas[0].sharingAttempt, undefined);
  assert.equal(h.ref.current.movimientos, initial.movimientos); assert.equal(h.events.find(item => item[0] === "saved")[1].length, 0, "cancelar no devuelve dinero a Personal");
  assert.ok(h.events.includes("boxes.sharingCancelled"));
}
{
  const h = harness(); h.scope.cancelarConversionCaja = async () => receipt; await h.scope.run();
  assert.equal(h.ref.current.cajas.length, 0); assert.equal(h.events.find(item => item[0] === "saved")[1][0].internalTransferSpaceId, receipt.targetId);
  assert.equal(h.events.find(item => item[0] === "saved")[1][0].amount, 100); assert.ok(h.events.includes("boxes.alreadyShared"));
}
for (const kind of ["network", "save", "account", "changed", "links", "busy"]) {
  const h = harness();
  if (kind === "network") h.scope.cancelarConversionCaja = async () => { throw new Error("network"); };
  if (kind === "save") h.scope.guardarCambioCaja = async () => false;
  if (kind === "account") h.scope.cancelarConversionCaja = async () => { h.scope.active = false; return null; };
  if (kind === "changed") h.scope.cancelarConversionCaja = async () => { h.ref.current = { ...initial, movimientos: [{ ...row, monto: 120 }] }; return null; };
  if (kind === "links") { h.scope.cancelarConversionCaja = async () => receipt; h.scope.privateBoxLinksMatch = () => false; }
  if (kind === "busy") h.scope.guardandoRef.current = true;
  await h.scope.run(); assert.equal(h.ref.current.cajas[0].sharingPending, true, kind);
  assert.equal(h.events.some(item => item[0] === "saved"), false, kind); assert.equal(h.events.some(item => item[0] === "open"), false, kind);
}
{
  const h = harness(); let calls = 0, release;
  h.scope.cancelarConversionCaja = async () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const first = h.scope.run(), second = h.scope.run(); assert.equal(calls, 1); release(null); await Promise.all([first, second]);
  assert.equal(h.events.filter(item => item[0] === "saved").length, 1, "dos toques antes de repintar no inician dos acciones");
}
// Ejecuta el cliente real de cancelación; un simple complete:false no permite
// desbloquear, ni una respuesta perteneciente a otro UID/intento/huella.
const clientAction = migrationTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "cancelarConversionCaja").getText(migrationTree);
const proof = { complete: false, cancelled: true, uid: "a", sourceId: box.id, digest: receipt.digest, currency: "PEN", attemptId: box.sharingAttempt };
const client = { Error, exports: {}, response: proof, functions: {},
  captureAccountTask: () => ({ wait: async work => work() }), huellaCaja: async () => receipt.digest,
  httpsCallable: () => async () => ({ data: client.response }), validarCajas: () => {} };
vm.runInNewContext(ts.transpile(clientAction, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), client);
assert.equal(await client.exports.cancelarConversionCaja("a", box, [row], "PEN"), null);
for (const bad of [{ complete: false }, { ...proof, uid: "otro" }, { ...proof, attemptId: "intento-otro-0001" }, { ...proof, digest: "b".repeat(64) }, { ...proof, currency: "USD" }]) {
  client.response = bad; await assert.rejects(client.exports.cancelarConversionCaja("a", box, [row], "PEN"), /cajas-sync-conflict/);
}
console.log("Cancelación: Gratis, copia confirmada, respuestas inválidas, disco/red/sesión y dinero preservado comprobados.");

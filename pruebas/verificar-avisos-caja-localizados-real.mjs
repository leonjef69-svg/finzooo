import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_TEST_BOX_NOTICE_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const file = "screens/Cajas.tsx", source = read(file);
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate, currentTree = tree) {
  let found;
  function visit(node) { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); }
  visit(currentTree); return found;
}
const evaluate = (node, scope, currentTree = tree) => {
  assert.ok(node, "La expresión original debe existir");
  const js = ts.transpile(`(${node.getText(currentTree)})`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None });
  return vm.runInNewContext(js, scope);
};
const hj = { id: "caja-hj", nombre: "hj" }, healthy = { id: "caja-sana", nombre: "Sana" };
const records = [11, 12].map(id => ({ id: `m${id}`, cajaId: hj.id, tipo: "ingreso", monto: 10, personalTransactionId: id }));
records.push({ id: "m13", cajaId: hj.id, tipo: "gasto", monto: 10, personalTransactionId: 13, personalReturnAmount: 10 });
records.push({ id: "externo", cajaId: hj.id, tipo: "ingreso", monto: 10 });
const data = { cajas: [hj, healthy], movimientos: records, cajasBorradas: [], movimientosBorrados: [] };
const conflicts = records.slice(0, 3).map(row => ({ reason: "deleted", boxId: hj.id, movementId: row.id, personalId: row.personalTransactionId }));
const deleted = [11, 12, 13], rows = [], before = JSON.stringify({ data, deleted, rows });
const dialogs = [], toasts = []; let opened = false, archived = 0;
const scope = { repairPlan: { conflicts }, cloudReady: true, repairBlocked: false, t: key => key,
  Alert: { alert: (...args) => dialogs.push(args) }, showToast: key => toasts.push(key),
  setRepairReviewVisible: value => { opened = value; }, confirmarArchivoCaja: () => archived++,
  caja: hj, cajaId: hj.id, datosActuales: { current: data }, movimientos: records, ready: true,
  personalActuales: { current: rows }, borradosActuales: { current: deleted }, accountUid: "A",
  canPreserveDeletedPrivateBoxHistory: () => false, // caso que aún requiere revisión, no habilita dinero ambiguo
};
const aviso = handlerOriginal(file, "avisarRevisionNecesaria", scope, source);
aviso();
assert.equal(dialogs.length, 0, "Una incidencia antigua no debe abrir un diálogo técnico durante una acción normal");
assert.equal(toasts.length, 0); assert.equal(opened, false);
scope.cajaNecesitaRevision = handlerOriginal(file, "cajaNecesitaRevision", scope, source);
assert.equal(scope.cajaNecesitaRevision(hj.id), true);
assert.equal(scope.cajaNecesitaRevision(healthy.id), false, "la otra caja no hereda la revisión de hj");
scope.avisarRevisionNecesaria = aviso;
handlerOriginal(file, "cerrarCajaActual", scope, source)();
handlerOriginal(file, "confirmarBorrarTodo", scope, source)();
await handlerOriginal(file, "borrarSeleccionados", scope, source)(records.map(row => row.id));
assert.equal(archived, 0, "Cerrar/Borrar no se convierten en Archivar");
assert.equal(dialogs.length, 0); assert.equal(toasts.length, 0);
assert.equal(JSON.stringify({ data, deleted, rows }), before, "no borrar, reconstruir ni cambiar ningún importe");
const attr = (node, name) => node.attributes.properties.find(prop => prop.name?.text === name)?.initializer?.expression;
const button = label => find(node => ts.isJsxOpeningElement(node) && node.tagName.getText(tree) === "TouchableOpacity"
  && attr(node, "accessibilityLabel")?.getText(tree) === `t("${label}")`);
const invite = button("boxes.inviteAccessibility");
for (const box of [hj, healthy]) {
  const cajaEnRevision = scope.cajaNecesitaRevision(box.id);
  const state = { caja: box, cajaEnRevision, operacionCajaBloqueada: false, compartiendo: false, guardando: false, ready: true };
  assert.equal(evaluate(attr(invite, "disabled"), state), box === hj, "solo la caja pendiente desactiva Invitar");
  assert.equal(evaluate(attr(button("boxes.close"), "disabled"), state), false, "un historial preservable no desactiva Cerrar; se valida saldo al tocar");
}
assert.equal(evaluate(attr(invite, "disabled"), { caja: { ...hj, sharingPending: true }, cajaEnRevision: true, compartiendo: false, guardando: false }), false,
  "un intento incierto conserva su recuperación verificada; no se abandona su copia");
const manual = button("boxes.repairReview");
evaluate(attr(manual, "onPress"), { setRepairReviewVisible: value => { opened = value; } })();
assert.equal(opened, true, "los detalles solo se abren al tocar explícitamente Revisar");
assert.doesNotMatch(source, /confirmarArchivoCaja|t\("boxes\.archiveAction"\)/, "no hay opción de archivar cajas");

// Invitar y guardar un ingreso/gasto de Familia no consultan los casos de Caja.
const familyFile = "screens/Family.tsx", familySource = read(familyFile);
const familyTree = ts.createSourceFile(familyFile, familySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const wait = Object.assign(work => work(), { reload: async () => {} });
const writes = []; let invitation;
const family = { ...scope, auth: { currentUser: { uid: "A" } }, familia: { id: "familia-sana", nombre: "Familia", currency: "PEN" },
  owner: true, isPremium: true, ejecutar: action => action(wait), userCurrency: "PEN", pendingDebit: { current: null },
  crearInvitacionFamilia: async (uid, id) => { writes.push(["invitar", uid, id]); return "ABCD2345"; }, setInvitacion: code => { invitation = code; },
  amountInputError: () => null, parseAmountInput: Number, validSpaceDate: () => true, canSpendFromSpace: () => true,
  tipo: "ingreso", monto: "5", movementDate: "2026-10-15", editandoAporteId: null, origenDinero: "externo",
  descripcion: "Ejemplo aislado", category: "otros", notes: "", method: "cash", fechaHoy: () => "2026-10-15",
  hayMovimientoCompartidoPendiente: async () => false,
  nuevaOperacionMovimientoCompartido: () => ({ id: "synthetic-operation", currency: "PEN" }),
  confirmarMovimientoCompartido: async () => true,
  guardarMovimientoFamilia: async (...args) => { writes.push(["guardar", ...args]); return "family-movement"; },
  setMonto() {}, setDescripcion() {}, setNotes() {}, setMovementDate() {}, setOrigenDinero() {}, setTipo() {},
  setEditandoNombreFamilia() {}, setSeleccionando() {}, setInvitacionVisible() {}, setPreparandoInvitacion() {},
};
family.captureAccountTask = handlerOriginal("utils/accountTask.ts", "captureAccountTask", { auth: family.auth, getAccountStorageSession: () => 1 });
function familyAction(name) {
  const node = find(node => ts.isVariableDeclaration(node) && node.name.getText(familyTree) === name, familyTree);
  return evaluate(node.initializer, family, familyTree);
}
await familyAction("invitar")(); assert.equal(invitation, "ABCD2345");
for (const tipo of ["ingreso", "gasto"]) { family.tipo = tipo; await familyAction("guardar")(); }
assert.equal(writes.length, 3);
assert.ok(writes.every(row => row.includes("familia-sana")));
assert.equal(JSON.stringify({ data, deleted, rows }), before);
console.log("Acciones originales: hj sin avisos automáticos ni Archivar, revisión voluntaria, otras cajas habilitadas y Familia invita/guarda sin tocar los tres casos antiguos.");

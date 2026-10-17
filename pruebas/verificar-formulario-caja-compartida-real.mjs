import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { familyMutationOriginal } from "./helpers/family-mutation-original.mjs";

const baseline = process.env.FINO_TEST_SHARED_FORM_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
function original(file, name) {
  const source = read(file), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(tree).replace(/^export\s+/, "");
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) result = `const ${node.getText(tree)};`;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(result, `Acción original ${name}`); return result;
}
const run = (code, scope) => vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }), scope);
const plain = value => JSON.parse(JSON.stringify(value));
function boxForm() {
  const writes = [], debits = [], notices = [];
  const s = {
    uid: "A", caja: { id: "shared", nombre: "Caja", currency: "PEN" }, owner: true, moneda: "PEN", userCurrency: "PEN",
    modo: "gasto", monto: "7", nombre: " Almuerzo ", method: "debit", category: "comida", notes: " Nota ", movementDate: "2026-10-14", origenDinero: "externo",
    pendingDebit: { current: null }, editandoAporteId: null, movimientos: [], transactions: [],
    ejecutar: action => action(async work => work()), amountInputError: () => null, parseAmountInput: Number,
    canSpendFromSpace: () => true, saldoPersonalEn: () => 100, nextId: () => 42, horaDe: () => "10:00",
    guardarMovimientoCajaCompartida: async (id, uid, movement) => { writes.push({ id, uid, movement }); return "confirmed-movement"; },
    repairLinkedTransferTransactions: async rows => { debits.push(...rows); return !s.rejectLocal; },
    limpiar: () => { s.cleaned = (s.cleaned || 0) + 1; }, showToast: message => notices.push(message), t: key => key,
    setEditandoAporteId() {},
  };
  run(`${original("components/SpaceMovementFields.tsx", "validSpaceDate")}\n${original("screens/SharedBoxes.tsx", "guardar")}\nglobalThis.save=guardar;`, s);
  return { s, writes, debits, notices };
}
{
  const { s, writes } = boxForm(); await s.save();
  assert.deepEqual(plain(writes[0]), { id: "shared", uid: "A", movement: {
    tipo: "gasto", monto: 7, descripcion: "Almuerzo", fecha: "2026-10-14", category: "comida", notes: "Nota", method: "debit",
  } }, "La hoja actual conserva fecha, categoría, nota y método también DESPUÉS de invitar");
}
{
  const { s, writes, debits } = boxForm();
  Object.assign(s, { modo: "ingreso", origenDinero: "personal", rejectLocal: true });
  await assert.rejects(s.save(), /personal-save-failed/);
  assert.equal(s.cleaned, undefined); assert.ok(s.pendingDebit.current);
  assert.equal(writes.length, 1); assert.equal(writes[0].movement.personalTransactionId, 42);
  assert.equal(writes[0].movement.personalOwnerUid, "A"); assert.equal(writes[0].movement.method, "transfer");
  assert.equal(writes[0].movement.category, undefined, "un aporte sigue siendo transferencia, no ingreso ordinario");
  assert.equal(debits[0].internalTransfer, "box"); assert.equal(debits[0].internalTransferLink, "confirmed-movement");
  assert.equal(debits[0].amount, 7); assert.equal(debits[0].date, "2026-10-14"); assert.equal(debits[0].notes, "Nota");
  s.rejectLocal = false; await s.save();
  assert.equal(writes.length, 1, "reintentar un guardado Personal no crea otro movimiento en Caja");
  assert.equal(debits.length, 2); assert.deepEqual(plain(debits[1]), plain(debits[0]));
  assert.equal(s.pendingDebit.current, null); assert.equal(s.cleaned, 1);
}
for (const change of [{ movementDate: "2026-02-30" }, { modo: "ingreso", origenDinero: "personal", monto: "101" },
  { modo: "ingreso", origenDinero: "personal", moneda: "USD" }]) {
  const { s, writes, notices } = boxForm(); Object.assign(s, change); await s.save();
  assert.equal(writes.length, 0, "fecha inválida, saldo insuficiente o moneda ajena no envían dinero"); assert.equal(notices.length, 1);
}
{
  const { s, writes, debits } = boxForm(); Object.assign(s, { modo: "ingreso", owner: false, origenDinero: "personal" });
  await s.save(); assert.equal(writes[0].movement.personalTransactionId, undefined); assert.equal(debits.length, 0, "el invitado conserva sus permisos anteriores");
}
// Invitar Familia no es una operación de dinero: conserva la consulta y las filas.
{
  let finish; const pending = new Promise(resolve => { finish = resolve; });
  const s = { ...familyMutationOriginal(), accountUid: "A", accountSession: 1, mounted: { current: true }, actionLock: { current: false },
    getAccountStorageSession: () => 1, auth: { currentUser: { uid: "A" } }, familia: { id: "family" }, owner: true, isPremium: true,
    reloadId: { current: 8 }, cierresPendientes: { current: new Set() }, synchronized: true, reloads: 0, calls: 0,
    captureAccountTask: (_uid, current) => ({ current, wait: async work => { assert.ok(current()); const result = await work(); assert.ok(current()); return result; } }),
    recargar: async () => { s.reloads++; }, setFamiliasSincronizadas: value => { s.synchronized = value; }, setOcupado() {},
    setTipo() {}, setEditandoNombreFamilia() {}, setSeleccionando() {},
    setInvitacion: value => { s.code = value; }, setInvitacionVisible: value => { s.visible = value; }, setPreparandoInvitacion: value => { s.preparing = value; },
    crearInvitacionFamilia: () => { s.calls++; return pending; }, showToast: message => { throw Error(message); }, t: key => key,
  };
  run(`${original("screens/Family.tsx", "ejecutar")}\n${original("screens/Family.tsx", "invitar")}\nglobalThis.invite=invitar; globalThis.work=ejecutar;`, s);
  const action = s.invite(); await s.invite();
  assert.equal(s.visible, true); assert.equal(s.preparing, true); assert.equal(s.code, ""); assert.equal(s.calls, 1);
  assert.equal(s.reloadId.current, 8); assert.equal(s.synchronized, true);
  // Cerrar durante la espera no debe reabrir la hoja cuando responde la nube.
  s.visible = false; finish("ABCD2345"); await action;
  assert.equal(s.visible, false); assert.equal(s.code, "ABCD2345"); assert.equal(s.preparing, false);
  assert.equal(s.reloads, 0, "Invitar no recarga Familia ni todos sus movimientos");
  await s.work(wait => wait(async () => {}));
  assert.equal(s.reloads, 1); assert.equal(s.synchronized, false, "las acciones de dinero mantienen sus comprobaciones");
}
console.log("Formulario compartido original: metadatos, aporte Personal/reintento único y validaciones; invitación Familia inmediata sin recarga financiera. Sin cuentas ni dinero reales.");

import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
function arrow(file, name, context) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found, `${name} original`);
  vm.runInNewContext(ts.transpile(`globalThis.run = ${found.getText(tree)}`, { target: ts.ScriptTarget.ES2022 }), context);
  return context.run;
}
{
  let remote = 0, saved = false, commits = 0, announced = 0;
  const wait = action => action(); wait.reload = async () => {};
  const context = {
    pendingDebit: { current: null }, auth: { currentUser: { uid: "A" } }, familia: { id: "family", nombre: "Casa", currency: "PEN" },
    owner: true, userCurrency: "PEN", origenDinero: "personal", tipo: "ingreso", monto: "10", movimientos: [], transactions: [],
    editandoAporteId: null, movementDate: "2026-10-15", descripcion: "Aporte", category: "otros", notes: "", method: "transfer",
    amountInputError: () => null, parseAmountInput: Number, validSpaceDate: () => true, saldoPersonalEn: () => 100,
    nextId: () => 101, ejecutar: action => action(wait), guardarMovimientoFamilia: async () => { remote++; return "remote-original"; },
    repairLinkedTransferTransactions: async rows => { commits++; assert.equal(rows[0].internalTransferLink, "remote-original"); return saved; },
    addOrUpdateTransaction: () => true, t: key => key, showToast: () => { announced++; }, horaDe: () => "10:00", fechaHoy: () => "2026-10-15",
    Date, setMonto() {}, setDescripcion() {}, setNotes() {}, setMovementDate() {}, setOrigenDinero() {}, setTipo() {},
  };
  context.captureAccountTask = handlerOriginal("utils/accountTask.ts", "captureAccountTask", { auth: context.auth, getAccountStorageSession: () => 1 });
  const save = arrow("screens/Family.tsx", "guardar", context);
  await assert.rejects(save(), /personal-save-failed/, "no anuncia éxito antes del guardado confirmado de Personal");
  assert.equal(remote, 1); assert.equal(announced, 0); assert.equal(commits, 1);
  saved = true; await save();
  assert.equal(remote, 1, "reintenta la misma mitad local, sin duplicar el aporte remoto");
  assert.equal(commits, 2); assert.equal(context.pendingDebit.current, null);
}
{
  const uid = "A";
  let failCode = "unavailable";
  const deps = { db: {}, collection: (...parts) => parts, doc: (...parts) => parts,
    getDocs: async () => ({ docs: [{ id: "good" }, { id: "unreadable" }] }),
    getDoc: async ref => {
      if (ref.at(-1) === "unreadable") throw Object.assign(new Error("network"), { code: failCode });
      return { id: "good", exists: () => true, data: () => ({ ownerUid: uid, nombre: "Caja", creadaEn: 1 }) };
    }, desdeDocumento: (id, data) => ({ id, ...data }),
  };
  const list = handlerOriginal("utils/cloudCajasCompartidas.ts", "listarCajasCompartidas", deps, read("utils/cloudCajasCompartidas.ts"));
  await assert.rejects(list(uid), error => error.code === "unavailable", "una caída de red no se transforma en una Caja desaparecida");
  failCode = "permission-denied";
  assert.equal((await list(uid)).length, 1, "un enlace sin permiso no oculta las otras Cajas");
}
{
  let writes = 0;
  const fn = handlerOriginal("utils/cloudFamilia.ts", "renombrarFamilia", {
    assertSharedContentAccepted: async () => {}, db: {}, doc: () => ({}), updateDoc: async () => { writes++; },
  }, read("utils/cloudFamilia.ts"));
  await assert.rejects(fn("family", "   "), /invalid-name/);
  assert.equal(writes, 0, "no envía un nombre vacío a Firebase");
}
{
  const errorKey = handlerOriginal("utils/spaceErrors.ts", "spaceErrorKey", {}, read("utils/spaceErrors.ts"));
  assert.equal(errorKey({ details: { reason: "shared-insufficient-balance" } }), "spaces.balanceChanged");
  assert.equal(errorKey({ details: { reason: "shared-premium-required" } }), "spaces.proRequired");
  assert.equal(errorKey({ code: "functions/not-found" }), "spaces.backendNotUpdated");
}
{
  const auth = { currentUser: { uid: "A" } }, calls = [];
  let generated = 0, offline = true;
  const task = handlerOriginal("utils/accountTask.ts", "captureAccountTask", { auth, getAccountStorageSession: () => 1 });
  const module = { exports: {} };
  vm.runInNewContext(ts.transpile(read("utils/sharedMovements.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
    module, exports: module.exports, require: name => {
      if (name === "@/utils/firebase") return { auth, db: {}, functions: {} };
      if (name === "@/utils/accountTask") return { captureAccountTask: task };
      if (name === "@/utils/storage") return { getAccountStorageSession: () => 1 };
      if (name === "firebase/firestore") return { collection: () => ({}), doc: () => ({ id: `operation-${++generated}` }) };
      if (name === "firebase/functions") return { httpsCallable: () => async input => {
        calls.push(input.movementId);
        if (offline) throw Object.assign(new Error("lost-response"), { code: "functions/unavailable" });
        return { data: { movementId: input.movementId, createdAt: 100 } };
      } };
      throw new Error(name);
    },
  });
  const payload = { tipo: "gasto", monto: 10, descripcion: "Demo", fecha: "2026-10-15" };
  await assert.rejects(module.exports.guardarMovimientoCompartido("box", "demo", "A", payload), /lost-response/);
  offline = false;
  assert.equal(await module.exports.guardarMovimientoCompartido("box", "demo", "A", payload), "operation-1");
  assert.deepEqual(calls, ["operation-1", "operation-1"]);
  assert.equal(generated, 1, "la misma sesión reintenta el ID original, no otro gasto");
}
console.log("Originales Familia/Cajas: guardado confirmado, reintento sin duplicar aporte, fallo de red no oculta Cajas y nombre vacío rechazado; sin datos reales.");

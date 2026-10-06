import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere hash Git.");
const source = baseline ? execFileSync("git", ["show", `${baseline}:utils/cloudCajasCompartidas.ts`], { encoding: "utf8" }) : fs.readFileSync("utils/cloudCajasCompartidas.ts", "utf8");
const tree = ts.createSourceFile("Cajas.ts", source, ts.ScriptTarget.Latest, true);
const actions = tree.statements.filter(node => ts.isFunctionDeclaration(node) && ["validarBorradoCajasCompartidasDeCuenta", "borrarCajasCompartidasDeCuenta"].includes(node.name?.text)).map(node => node.getText(tree)).join("\n");
function harness() {
  const events = [], root = { ownerUid: "a", migrationComplete: false, migrationProtocol: 2 };
  const scope = { Error, exports: {}, db: {},
    collection: (_db, ...path) => path.join("/"), doc: (_db, ...path) => path.join("/"),
    getDocs: async path => ({ docs: path === "boxUsers/a/spaces" ? [{ id: "a_caja", ref: "boxUsers/a/spaces/a_caja" }] : [] }),
    getDoc: async () => ({ exists: () => true, data: () => root }),
    listarMovimientosCajaCompartida: async () => { events.push("clone-money-read"); return [{ tipo: "ingreso", monto: 100, personalTransactionId: 10 }]; },
    canCloseLinkedSpace: () => false, hasUnreturnedPersonalContribution: () => true,
    prepararBorradoConversionesCaja: async (_uid, action) => { events.push(action); if (action === "discard") root.migrationDeletionPending = true; },
    salirEspacioCompartido: async () => { throw new Error("NO_LEAVE_PENDING"); },
    deleteDoc: async () => { throw new Error("NO_SDK_ORPHAN_DELETE"); },
    prepararBorradoEspacioCompartido: async () => { throw new Error("NO_REAL_MONEY_DELETE"); } };
  vm.runInNewContext(ts.transpile(actions, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), scope);
  return { scope, events, root };
}
{
  const h = harness(); await h.scope.exports.validarBorradoCajasCompartidasDeCuenta("a");
  assert.deepEqual(h.events, ["inspect"], "la comprobación previa no borra nada ni trata clones como dinero compartido");
  assert.equal(h.root.migrationDeletionPending, undefined);
  await h.scope.exports.borrarCajasCompartidasDeCuenta("a"); assert.deepEqual(h.events, ["inspect", "discard"]);
}
{
  const h = harness(); h.root.migrationComplete = true;
  await assert.rejects(h.scope.exports.validarBorradoCajasCompartidasDeCuenta("a"), /unsettled-personal-contributions/);
  assert.deepEqual(h.events, ["inspect", "clone-money-read"], "una Caja publicada con saldo sigue protegida");
}
{
  const h = harness(); h.scope.prepararBorradoConversionesCaja = async () => { throw new Error("unconfirmed"); };
  await assert.rejects(h.scope.exports.borrarCajasCompartidasDeCuenta("a"), /unconfirmed/);
  assert.equal(h.events.length, 0, "no inicia borrados SDK tras fallar la comprobación administrativa");
}
// Cliente/guardia reales: la respuesta mínima debe ser propia, confirmada y
// de la misma generación, incluso A → B → A. No se copia la lógica de guardia.
let generation = 1, finish;
const auth = { currentUser: { uid: "a" } }, guard = { exports: {} };
vm.runInNewContext(ts.transpile(fs.readFileSync("utils/accountTask.ts", "utf8"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
  exports: guard.exports, Error, require: name => name === "@/utils/firebase" ? { auth } : { getAccountStorageSession: () => generation },
});
const client = { exports: {}, Error, require: name => {
  if (name === "@/utils/firebase") return { functions: {} };
  if (name === "@/utils/accountTask") return guard.exports;
  if (name === "firebase/functions") return { httpsCallable: (_functions, name, options) => payload => {
    assert.equal(name, "prepareIncompleteBoxDeletion"); assert.equal(options.timeout, 550_000); assert.equal(payload.action, "inspect");
    return new Promise(resolve => { finish = resolve; });
  } };
  throw new Error(name);
} };
vm.runInNewContext(ts.transpile(fs.readFileSync("utils/incompleteBoxDeletion.ts", "utf8"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), client);
const request = () => client.exports.prepararBorradoConversionesCaja("a", "inspect");
const confirmed = request(); finish({ data: { ok: true, uid: "a" } }); await confirmed;
for (const bad of [{ ok: false, uid: "a" }, { ok: true, uid: "b" }, { uid: "a" }]) {
  const promise = request(), rejected = assert.rejects(promise, /incomplete-box-invalid-response/); finish({ data: bad }); await rejected;
}
const obsolete = request(), rejected = assert.rejects(obsolete, /account-task-obsolete/); generation += 2;
finish({ data: { ok: true, uid: "a" } }); await rejected;
console.log("Borrado de Caja incompleta: preflight sin mutaciones, clones sin devolución ficticia, saldo real, respuesta y sesión protegidos.");

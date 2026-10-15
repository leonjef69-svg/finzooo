import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { withImmediateRemoval } from "./helpers/immediate-removal-original.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_TEST_IMMEDIATE_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
const gate = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function action(file, name, scope) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name || ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found);
  const code = ts.isVariableDeclaration(found) ? `const ${found.getText(tree)};` : found.getText(tree);
  vm.runInNewContext(ts.transpile(`${code}\nglobalThis.action = ${name};`, { target: ts.ScriptTarget.ES2022 }), scope);
  return scope.action;
}
function scopeFor(kind) {
  const remote = gate(), item = { id: "movement", tipo: "ingreso", monto: 10, creadoPor: "A" };
  const data = { cajas: [{ id: "box" }], movimientos: [item], cajasBorradas: [], movimientosBorrados: [] };
  const s = { withImmediateRemoval, mounted: { current: true }, accountSession: 1, getAccountStorageSession: () => 1,
    auth: { currentUser: { uid: "A" } }, accountUid: "A", uid: "A", owner: true, familia: { id: "family" }, caja: data.cajas[0],
    movimientos: [item], seleccionados: [item.id], hidden: new Set(), current: true, confirmed: 0, libro: data,
    cuentaActual: () => s.current, datosActuales: { current: data }, datos: data,
    ready: true, compartiendo: false, guardandoRef: { current: false }, syncIssue: null, cajaId: "box", cajaNecesitaRevision: () => false,
    planSpaceMovementDeletion: () => ({ ok: true, items: [item] }), balanceOfSpace: () => 100,
    borrarMovimientoFamilia: () => remote.promise, borrarMovimientoCajaCompartida: () => remote.promise,
    borrarAportePersonal: () => remote.promise, deleteLinkedTransferTransaction: async () => true,
    borradosConfirmados: { current: new Map() },
    ejecutar: fn => { const wait = work => work(); wait.reload = async () => {}; return fn(wait); },
    retirarMovimientoConfirmado: id => { s.confirmed++; s.movimientos = s.movimientos.filter(row => row.id !== id); },
    setMovimientos: update => { s.movimientos = update(s.movimientos); }, setSeleccionados() {}, setSeleccionando() {},
    setMovimientosOcultos: update => { s.hidden = update(s.hidden); },
    guardarCambioCaja: async next => {
      const result = await remote.promise; if (result !== false) { s.confirmed++; s.libro = next; } return result !== false;
    },
  };
  const file = kind === "family" ? "screens/Family.tsx" : kind === "private" ? "screens/Cajas.tsx" : "screens/SharedBoxes.tsx";
  return { s, remote, item, run: action(file, kind === "shared" ? "borrar" : "borrarSeleccionados", s) };
}

for (const kind of ["family", "private", "shared"]) for (const result of ["ok", "reject"]) {
  const { s, remote, item, run } = scopeFor(kind);
  const before = plain(s.libro);
  const pending = kind === "shared" ? run(item) : run();
  assert.equal(s.hidden.has(item.id), true, `${kind}: se oculta en el mismo toque, antes de recibir la confirmación`);
  assert.equal(s.movimientos.length, 1, "el libro confirmado sigue intacto mientras espera");
  assert.equal(s.confirmed, 0); assert.deepEqual(plain(s.libro), before);
  if (result === "reject") { remote.reject(Error("offline")); await assert.rejects(pending, /offline/); }
  else { remote.resolve(true); await pending; }
  assert.equal(s.hidden.size, 0, "éxito limpia la máscara; error vuelve a mostrar el original");
  if (result === "reject") { assert.equal(s.movimientos.length, 1); assert.deepEqual(plain(s.libro), before); }
  else assert.equal(kind === "private" ? s.libro.movimientos.length : s.movimientos.length, 0);
}
{
  const { s, remote, run } = scopeFor("private"); const pending = run();
  remote.resolve(false); await pending; assert.equal(s.hidden.size, 0); assert.equal(s.libro.movimientos.length, 1);
}
{
  let current = true, publications = 0; const remote = gate();
  const pending = withImmediateRemoval(["one"], () => { publications++; }, () => current, () => remote.promise);
  current = false; remote.resolve(); await pending; assert.equal(publications, 1, "no publica la finalización en otra sesión/pantalla");
}

// La inspección nueva solo consulta: ni dinero, ni marcas, ni datos son escritos.
{
  const data = { cajas: [{ id: "hj" }], movimientos: [] }, rows = [], deleted = [1, 2, 3];
  const remote = gate(), state = { value: null, busy: false, messages: [] };
  const s = { cuentaActual: () => true, consultaRespaldoEnCurso: { current: false }, hasUnreadableLocalData: () => false,
    premiumForSync: { current: true }, datosActuales: { current: data }, personalActuales: { current: rows }, borradosActuales: { current: deleted },
    accountUid: "A", planPrivateBoxRepair: () => ({ conflicts: deleted.map(id => ({ personalId: id, reason: "deleted" })) }),
    captureAccountTask: (_uid, current) => ({ current, wait: async work => { const result = await work(); if (!current()) throw Error("stale"); return result; } }),
    loadPrivateBoxRepairCloud: async (_uid, ids) => { assert.deepEqual(plain(ids), deleted); return remote.promise; },
    setConsultandoRespaldo: value => { state.busy = value; }, setRespaldoRevisado: value => { state.value = value; },
    showToast: value => state.messages.push(value), t: key => key,
  };
  const inspect = handlerOriginal("screens/Cajas.tsx", "consultarRespaldoTransferencias", s);
  const pending = inspect(); remote.resolve({ deletedIds: [1], transactions: [{ id: 2 }] }); await pending;
  assert.deepEqual(plain(state.value.states), { 1: "deleted", 2: "present", 3: "missing" });
  assert.equal(state.busy, false); assert.deepEqual(deleted, [1, 2, 3]); assert.equal(rows.length, 0); assert.equal(data.movimientos.length, 0);
  state.value = null; s.premiumForSync.current = false; await inspect(); assert.equal(state.value, null);
}
console.log("Acción visual inmediata original en Familia/Cajas privadas/compartidas: libros intactos hasta ACK, rechazo/false restauran, sesión aislada y comprobación de copia solo lectura.");

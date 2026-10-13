import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const baseline = process.env.FINO_TEST_INDEPENDENT_BOX_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere un hash de Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = source => ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
const nodeRequire = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  vm.runInNewContext(js(read(file)), { module, exports: module.exports, Error, require: name => name.startsWith("@/")
    ? load(name.slice(2) + ".ts") : nodeRequire(name === "./utf8" ? "./utf8.ts" : name) });
  cache.set(file, module.exports); return module.exports;
}
const cajas = load("utils/cajas.ts"), repairs = load("utils/privateBoxRepair.ts"), personal = load("utils/privateBoxPersonal.ts");
const tree = ts.createSourceFile("Cajas.tsx", read("screens/Cajas.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) {
  let result;
  function visit(node) { if (!result && predicate(node)) result = node; if (!result) ts.forEachChild(node, visit); }
  visit(tree); return result;
}
const declaration = name => find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)?.getText(tree) || "";
const blocked = find(node => ts.isVariableDeclaration(node) && node.name.getText(tree) === "repairBlocked").initializer.getText(tree);
const oldBox = { id: "caja-antigua", nombre: "hj", creadaEn: 1 };
const oldMoves = [11, 12, 13].map(id => ({ id: `mov-${id}`, cajaId: oldBox.id, tipo: "ingreso", monto: 10,
  descripcion: "Aporte antiguo", fecha: "2026-10-02", creadoEn: id, personalTransactionId: id }));
const source = { cajas: [oldBox], movimientos: oldMoves, cajasBorradas: [], movimientosBorrados: [] };
const runCase = process.env.FINO_TEST_INDEPENDENT_BOX_CASE;

function screen(origin) {
  let id = 1000, saved = 0;
  const events = [], original = plain(source), rows = [], deleted = [11, 12, 13];
  const s = { datos: original, datosActuales: { current: original }, transactions: rows, deletedTransactionIds: deleted,
    repairPlan: repairs.planPrivateBoxRepair(original, rows, deleted, "A"), personalReady: true, hasOnboarded: true, ready: true, cloudReady: true,
    isPremium: true, cuentaActual: () => true, compartiendo: false, cargandoUnion: false, syncIssue: null,
    guardandoRef: { current: false }, accionLocalEnCurso: { current: false }, cajaId: oldBox.id, caja: original.cajas[0],
    origenDinero: origin, nuevoNombre: "Nueva", montoInicial: "25", userCurrency: "PEN",
    amountInputError: () => null, parseAmountInput: Number, saldoPersonalEn: () => 1000,
    nuevoIdCaja: prefix => `${prefix}-${++id}`, nextId: () => ++id, fechaLocal: () => "2026-10-12", horaDe: () => "12:00",
    setTimeout: work => { work(); return 0; }, t: key => key, showToast: key => events.push(key),
    avisarRevisionNecesaria: () => events.push("review"), setNuevoNombre() {}, setMontoInicial() {}, setOrigenDinero() {}, setCreando() {}, setVerArchivadas() {},
    setCajaId: value => { s.cajaId = value; s.caja = s.datos.cajas.find(row => row.id === value); }, setLista() {},
    guardarCambioCaja: async (next, upserts = [], deleteIds = []) => {
      personal.validatePrivateBoxPatch(s.datos, next, s.transactions, upserts, deleteIds, "A");
      const patch = personal.patchPrivateBoxPersonal(s.transactions, s.deletedTransactionIds, upserts, deleteIds, 100);
      s.datos = plain(next); s.datosActuales.current = s.datos; s.transactions = plain(patch.transactions); s.deletedTransactionIds = plain(patch.deletedIds);
      saved++; return true;
    } };
  vm.runInNewContext(js(`globalThis.repairBlocked = (${blocked});\n${["cajaNecesitaRevision", "tomarAccionLocal", "sacarDePersonal", "crearCaja"].map(declaration).join("\n")}`), s);
  return { s, events, saved: () => saved, recompute: () => vm.runInNewContext(js(`repairBlocked = (${blocked});`), s) };
}

if (!runCase || runCase === "screen") {
  for (const origin of ["externo", "personal"]) {
    const h = screen(origin); await h.s.crearCaja();
    assert.equal(h.saved(), 1, `${origin}: los restos de hj no impiden crear una Caja nueva`);
    assert.equal(h.s.datos.cajas.length, 2); assert.equal(h.s.datos.movimientos.at(-1).monto, 25);
    assert.deepEqual(h.s.datos.movimientos.slice(0, 3), source.movimientos, "conserva completos los tres registros dudosos");
    assert.deepEqual(h.s.deletedTransactionIds, [11, 12, 13], "no retira ni revive sus marcas de borrado");
    assert.equal(h.s.transactions.length, origin === "personal" ? 1 : 0);
    if (origin === "personal") {
      assert.equal(h.s.transactions[0].amount, 25); assert.equal(h.s.transactions[0].internalTransferSpaceId, h.s.cajaId);
      assert.equal(h.s.transactions[0].id, h.s.datos.movimientos.at(-1).personalTransactionId, "la Caja nueva conserva su par exacto");
    }
    h.s.repairPlan = repairs.planPrivateBoxRepair(h.s.datos, h.s.transactions, h.s.deletedTransactionIds, "A"); h.recompute();
    assert.equal(h.s.tomarAccionLocal(), true, "se puede usar la Caja nueva aunque hj siga pendiente");
    assert.equal(h.s.tomarAccionLocal(oldBox.id), false, "la Caja antigua continúa protegida");
    assert.ok(h.events.includes("review")); assert.ok(h.events.includes("boxes.saved"));
  }
  for (const reason of ["invalid", "missing"]) {
    const h = screen("personal"); h.s.repairPlan = { data: h.s.datos, upserts: [], conflicts: [{ reason }] }; h.recompute();
    await h.s.crearCaja(); assert.equal(h.saved(), 0, "un problema sin Caja identificable sigue deteniendo la operación");
  }
  for (const readyField of ["personalReady", "hasOnboarded", "cloudReady"]) {
    const h = screen("personal"); h.s[readyField] = false; h.recompute(); await h.s.crearCaja(); assert.equal(h.saved(), 0);
  }
  const h = screen("personal"); h.s.datos.revisionesImporte = [{ estado: "pendiente" }]; h.recompute();
  await h.s.crearCaja(); assert.equal(h.saved(), 0, "una elección monetaria pendiente mantiene su protección completa");
}

if (!runCase || runCase === "duplicate") {
  const duplicated = { ...source, movimientos: oldMoves.map(row => ({ ...row, personalTransactionId: 11 })) };
  const newBox = { id: "caja-nueva", nombre: "Nueva", creadaEn: 20 };
  const next = { ...duplicated, cajas: [...duplicated.cajas, newBox] };
  assert.doesNotThrow(() => personal.validatePrivateBoxPatch(duplicated, next, [], [], [], "A"), "un ID antiguo repetido no bloquea una Caja sin relación");
  assert.throws(() => personal.validatePrivateBoxPatch(duplicated, { ...next, movimientos: next.movimientos.slice(1) }, [], [], [], "A"), /id-conflict/);
  assert.throws(() => personal.validatePrivateBoxPatch(duplicated, { ...next, movimientos: next.movimientos.map((row, index) => index ? row : { ...row, monto: 9 }) }, [], [], [], "A"), /id-conflict/);
  assert.throws(() => personal.validatePrivateBoxPatch(duplicated, next, [], [], [11], "A"), /id-conflict/);
}

if (!runCase || runCase === "cloud") {
  const newBox = { id: "caja-nueva", nombre: "Nueva", creadaEn: 20 };
  const newMove = { id: "mov-nuevo", cajaId: newBox.id, tipo: "ingreso", monto: 25, descripcion: "Externo", fecha: "2026-10-12", creadoEn: 20 };
  const local = { ...source, cajas: [...source.cajas, newBox], movimientos: [...oldMoves, newMove] };
  let remote = { ...plain(source), movimientos: oldMoves.map(row => ({ ...row, monto: 20, updatedAt: 50 })) }, written, confirmed;
  const module = { exports: {} };
  vm.runInNewContext(js(read("utils/cloudCajas.ts")), { module, exports: module.exports, Error, require: name => {
    if (name === "@/utils/cajas") return cajas;
    if (name === "@/utils/firebase") return { db: {} };
    if (name === "@/utils/storage") return { hasUnreadableLocalData: () => false };
    if (name === "@/utils/accountTask") return { captureAccountTask: () => ({ current: () => true, wait: work => work() }) };
    if (name === "@/utils/privateBoxSync") return { withPrivateBoxCloudOperation: async (_uid, work) => work({ assertCurrent() {}, remember: value => value }) };
    if (name === "firebase/firestore") return { doc: () => ({}), runTransaction: async (_db, work) => work({
      get: async () => ({ exists: () => true, data: () => plain(remote) }), set: (_ref, value) => { written = plain(value); } }) };
    throw Error(name);
  } });
  const upload = async () => { written = undefined; confirmed = undefined;
    return module.exports.subirCajas("A", local, undefined, value => { confirmed = plain(value); }, [oldBox.id]); };
  const initial = plain({ local, remote });
  assert.equal(await upload(), true);
  assert.deepEqual(written.movimientos.filter(row => row.cajaId === oldBox.id), remote.movimientos, "el servidor conserva su fuente antigua, incluso si cambió mientras se guardaba");
  assert.deepEqual(confirmed.movimientos.filter(row => row.cajaId === oldBox.id), local.movimientos.filter(row => row.cajaId === oldBox.id), "la confirmación no reemplaza la fuente dudosa del teléfono");
  assert.ok(written.movimientos.some(row => row.id === newMove.id)); assert.ok(confirmed.movimientos.some(row => row.id === newMove.id));
  assert.deepEqual(plain({ local, remote }), initial, "planificar/enviar no modifica las fuentes originales");
  remote = { cajas: [], movimientos: [], cajasBorradas: [oldBox.id], movimientosBorrados: oldMoves.map(row => row.id) };
  assert.equal(await upload(), true);
  assert.equal(written.cajas.some(row => row.id === oldBox.id), false, "no vuelve a publicar una Caja borrada en la nube");
  assert.deepEqual(written.cajasBorradas, [oldBox.id]); assert.deepEqual(written.movimientosBorrados, oldMoves.map(row => row.id));
  assert.equal(confirmed.cajas.some(row => row.id === oldBox.id), true, "la limpieza incierta del teléfono sigue pendiente, sin descartarla por ausencia");
  remote = { ...plain(source), movimientos: [{ ...oldMoves[0], personalTransactionId: 999 }] };
  local.movimientos[3] = { ...newMove, personalTransactionId: 999 };
  assert.equal(await upload(), false, "un enlace de Personal que cruza con la Caja protegida se rechaza"); assert.equal(written, undefined);
  local.movimientos[3] = newMove;
  const expense = { ...newMove, tipo: "gasto", monto: 20 };
  local.movimientos.push({ ...expense, id: "gasto-a" });
  remote = { ...plain(source), cajas: [...source.cajas, newBox], movimientos: [...oldMoves, newMove, { ...expense, id: "gasto-b" }] };
  assert.equal(await upload(), false, "dos gastos concurrentes de una Caja sana no se confirman si exceden su saldo"); assert.equal(written, undefined);
}
console.log("Cajas independientes: creación Personal/externa, protección localizada, conservación de fuentes y nube concurrente comprobadas.");

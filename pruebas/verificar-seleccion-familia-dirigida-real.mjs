import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

// FINO_TEST_BASELINE=1955c268: abrir una de ocho Familias descargaba ocho
// historiales. Ejecuta el botón y la recarga originales, sin reescribirlos.
const read = createSourceReader();
const js = code => ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
function original(file, dependencies = {}) {
  const entry = { exports: {} };
  vm.runInNewContext(js(read(file)), { module: entry, exports: entry.exports, require: name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  } });
  return entry.exports;
}
const file = "screens/Family.tsx", source = read(file);
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map(), effects = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.set(node.name.getText(tree), node);
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect") effects.push(node.arguments[0]);
  ts.forEachChild(node, visit);
}
visit(tree);
const callback = name => declarations.get(name).initializer.arguments[0].getText(tree);
const reconciliation = effects.find(node => node.getText(tree).includes("const todosLosMovimientos")).getText(tree);
function harness() {
  const account = { uid: "A", session: 1 }, auth = { get currentUser() { return { uid: account.uid }; } };
  const getAccountStorageSession = () => account.session;
  const rows = Array.from({ length: 8 }, (_, id) => ({ id: `f${id}`, nombre: `Familia ${id}`, ownerUid: "A", currency: "PEN" }));
  const remote = Object.fromEntries(rows.map((family, i) => [family.id, [{ id: `aporte-${i}`, tipo: "ingreso", monto: 100,
    personalTransactionId: i + 1, personalOwnerUid: "A", creadoEn: 1, creadoPor: "A", fecha: "2026-10-24", descripcion: "Aporte" }]]));
  const network = { lists: 0, movements: [], members: [], holdList: null, holdHistory: new Map(), fail: false };
  const visual = { familia: rows[0], familias: rows, saldosFamilias: Object.fromEntries(rows.map(item => [item.id, 100])),
    movimientosFamilias: plain(remote), movimientos: remote.f0, miembros: [{ uid: "old" }], actualizadaEn: 0 };
  const memory = new Map([["A", visual]]), repairs = [], messages = [];
  const scope = { ...original("utils/familyMutation.ts"), ...original("utils/spaceRead.ts"), ...original("utils/linkedTransfers.ts"),
    ...original("utils/accountTask.ts", { "@/utils/firebase": { auth }, "@/utils/storage": { getAccountStorageSession } }),
    auth, accountUid: "A", accountSession: 1, getAccountStorageSession, familiaEnMemoria: memory,
    mounted: { current: true }, reloadId: { current: 0 }, confirmedReload: { current: 0 }, familiaConfirmada: { current: null },
    familiaElegida: { current: "f0" }, listaFamiliasVisible: { current: true }, actionLock: { current: false },
    cierresPendientes: { current: new Set() }, legacyRepairIds: { current: new Set() }, pendingDebit: { current: null },
    VENTANA_CAMBIO_RAPIDO_MS: 2000, familia: rows[0], familias: rows, movimientosFamilias: plain(remote), movimientos: remote.f0,
    miembros: [{ uid: "old" }], transactions: rows.map((family, i) => ({ id: i + 1, type: "expense", amount: 100,
      internalTransfer: "family", internalTransferSpaceId: family.id, internalTransferSpaceName: family.nombre, internalTransferLink: `aporte-${i}` })),
    cargando: false, familiasSincronizadas: false, t: (key, values = {}) => `${key}:${values.name || ""}`,
    tRef: { current: key => key }, toastRef: { current: key => messages.push(key) }, showToast: key => messages.push(key),
    horaDe: () => "", nextId: () => 100,
    listarFamilias: async () => { network.lists++; return network.holdList ? network.holdList.promise : rows; },
    listarMovimientosFamilia: async id => { network.movements.push(id); if (network.fail) throw Error("unconfirmed");
      return network.holdHistory.has(id) ? network.holdHistory.get(id).promise : remote[id]; },
    listarMiembrosFamilia: async id => { network.members.push(id); return [{ uid: `member-${id}` }]; },
    repairLinkedTransferTransactions: (upserts, deleted) => { repairs.push(plain({ upserts, deleted })); return true; },
    vincularMovimientoPersonalFamilia() { throw Error("No hay legado que migrar"); },
  };
  for (const name of ["Familias", "Familia", "SaldosFamilias", "MovimientosFamilias", "Miembros", "Movimientos", "FamiliasSincronizadas",
    "Cargando", "Actualizando", "ErrorCarga", "VerTodas", "Tipo", "Invitacion", "Filter", "Seleccionados", "Seleccionando"]) {
    const key = name[0].toLowerCase() + name.slice(1);
    scope[`set${name}`] = value => { scope[key] = typeof value === "function" ? value(scope[key]) : value; };
  }
  scope.recargar = vm.runInNewContext(js(`(${callback("recargar")})`), scope);
  scope.open = handlerOriginal(file, "abrirFamilia", scope, source);
  scope.reconcile = vm.runInNewContext(js(`(${reconciliation})`), scope);
  return { scope, account, rows, remote, memory, network, repairs, messages };
}

{
  const h = harness();
  // Simula una copia visual incompleta de otra Familia: no es prueba de borrado.
  h.memory.get("A").movimientosFamilias.f7 = []; h.scope.movimientosFamilias.f7 = [];
  h.scope.open(h.rows[1]); await tick();
  assert.equal(h.network.lists, 1, "se verifica el catálogo y la pertenencia de nuevo");
  assert.deepEqual(h.network.movements, ["f1"], "abrir una Familia no descarga los otros siete historiales");
  assert.deepEqual(h.network.members, ["f1"]);
  assert.equal(h.scope.familia.id, "f1"); assert.deepEqual(plain(h.scope.movimientos), h.remote.f1);
  assert.equal(h.scope.familiasSincronizadas, true); assert.equal(h.scope.familiaConfirmada.current, "f1");
  assert.equal(h.memory.get("A").actualizadaEn, 0, "no convierte el resto de copias en confirmadas");
  h.scope.reconcile(); assert.deepEqual(h.repairs, [], "no borra el aporte de f7 por su copia visual incompleta");
}

// La selección dirigida no se hereda por foco, actualización o alta/unión.
// Primera entrada global: la activa se muestra ANTES de pedir las otras siete,
// pero el dinero de Personal no se concilia hasta confirmar las ocho.
{
  const h = harness(), active = deferred(), last = deferred();
  h.network.holdHistory.set("f0", active); h.network.holdHistory.set("f7", last);
  h.scope.movimientos = [];
  const work = h.scope.recargar(undefined, true); await tick();
  assert.deepEqual(h.network.movements, ["f0"], "los siete historiales no compiten con la primera entrada");
  active.resolve(h.remote.f0); await work; await tick();
  assert.deepEqual(plain(h.scope.movimientos), h.remote.f0);
  assert.equal(h.network.movements.length, 8, "después se inicia la confirmación global completa");
  assert.equal(h.scope.familiasSincronizadas, false); h.scope.reconcile(); assert.deepEqual(h.repairs, []);
  last.resolve(h.remote.f7); await tick();
  assert.equal(h.scope.familiasSincronizadas, true); assert.equal(h.scope.familiaConfirmada.current, null);
}

for (const preferred of [undefined, "f0"]) {
  const h = harness(); await h.scope.recargar(preferred, true); await tick();
  assert.equal(h.network.lists, 1); assert.equal(h.network.movements.length, 8);
  assert.equal(h.scope.familiaConfirmada.current, null); assert.ok(h.memory.get("A").actualizadaEn > 0);
}

// La consulta anticipada no publica dinero si el catálogo revoca la selección.
{
  const h = harness(); h.network.holdList = deferred(); h.scope.open(h.rows[1]); await tick();
  h.network.holdList.resolve(h.rows.filter(item => item.id !== "f1")); await tick();
  assert.equal(h.scope.familia, null); assert.deepEqual(plain(h.scope.movimientos), []);
  assert.equal(h.scope.familiaConfirmada.current, null); h.scope.reconcile();
  assert.deepEqual(h.repairs, [], "la respuesta anticipada no concilia la Familia revocada");
}

// La comprobación de pertenencia y el historial elegido arrancan juntos.
// Aun con el historial listo, Personal espera la lista confirmada.
{
  const h = harness(), list = deferred(), history = deferred();
  h.network.holdList = list; h.network.holdHistory.set("f1", history);
  h.scope.open(h.rows[1]); await tick();
  assert.deepEqual(h.network.movements, ["f1"], "la lectura elegida no espera otro viaje del catálogo");
  assert.deepEqual(h.network.members, ["f1"]);
  history.resolve(h.remote.f1); await tick();
  assert.equal(h.scope.familiasSincronizadas, false); h.scope.reconcile(); assert.deepEqual(h.repairs, []);
  list.resolve(h.rows); await tick();
  assert.equal(h.scope.familiaConfirmada.current, "f1"); assert.equal(h.scope.familiasSincronizadas, true);
}

// Error o cambio de cuenta/sesión: no confirma la foto ni concilia Personal.
for (const reason of ["network", "uid", "session", "mutation"]) {
  const h = harness(), slow = deferred(); h.network.holdHistory.set("f1", slow);
  h.scope.open(h.rows[1]); await tick();
  if (reason === "network") slow.reject(Error("offline"));
  else {
    if (reason === "uid") h.account.uid = "B";
    if (reason === "session") h.account.session++;
    if (reason === "mutation") h.scope.beginFamilyMutation("A", 1);
    slow.resolve(h.remote.f1);
  }
  await tick(); h.scope.reconcile();
  assert.equal(h.scope.familiasSincronizadas, false, reason); assert.deepEqual(h.repairs, [], reason);
  assert.equal(h.memory.get("A").familia.id, "f0", "la copia confirmada anterior no se reemplaza");
}

// Una respuesta de la elección anterior no sobrepone la segunda.
{
  const h = harness(), slow = deferred(); h.network.holdHistory.set("f1", slow);
  h.scope.open(h.rows[1]); await tick(); h.scope.open(h.rows[2]); await tick();
  slow.resolve(h.remote.f1); await tick();
  assert.equal(h.scope.familia.id, "f2"); assert.equal(h.scope.familiaConfirmada.current, "f2");
  assert.deepEqual(plain(h.scope.movimientos), h.remote.f2); assert.equal(h.memory.get("A").familia.id, "f2");
}

// La protección de formularios aplica a todos los campos iniciales reales.
for (const name of ["screens/Family.tsx", "screens/Cajas.tsx"]) {
  const ast = ts.createSourceFile(name, read(name), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inputs = [];
  function walk(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(ast) === "TextInput"
      && node.attributes.properties.some(prop => prop.name?.getText(ast) === "value" && prop.initializer?.getText(ast) === "{montoInicial}")) inputs.push(node);
    ts.forEachChild(node, walk);
  }
  walk(ast); assert.equal(inputs.length, name.endsWith("Family.tsx") ? 2 : 1);
  for (const node of inputs) {
    const attributes = new Map(node.attributes.properties.map(prop => [prop.name?.getText(ast), prop.initializer?.getText(ast)]));
    assert.equal(attributes.get("autoComplete"), '"off"'); assert.equal(attributes.get("importantForAutofill"), '"no"');
  }
}
console.log("Familia original: selección 8→1 historiales; primera entrada activa antes de otras siete, catálogo vigente y conciliación global posterior completa. Fallos/sesión/concurrencia seguros. Autorrelleno desactivado en importes iniciales.");

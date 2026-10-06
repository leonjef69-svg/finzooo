import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const worker = process.argv[2] === "--crash-worker";
if (worker) {
  const db = new DatabaseSync(process.argv[3]);
  db.exec("BEGIN IMMEDIATE");
  db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run("personal", "nuevo-personal");
  if (process.argv[4] === "between") process.exit(20);
  db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run("cajas", "nueva-caja");
  db.exec("COMMIT"); process.exit(0);
}
const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere hash de Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = source => ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const temp = fs.mkdtempSync(path.join(process.cwd(), ".tmp", "private-box-atomic-"));
const instances = [];
function harness() {
  const db = new DatabaseSync(":memory:"); instances.push(db); db.exec("CREATE TABLE store (key TEXT PRIMARY KEY, value TEXT)");
  const h = { db, gate: null, encryptGate: null, failure: null, batches: 0 };
  const get = key => db.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
  const put = (key, value) => db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value);
  const adapter = { getItem: async key => get(key), setItem: async (key, value) => { put(key, value); },
    multiGet: async keys => keys.map(key => [key, get(key)]),
    multiSet: async entries => {
      h.batches++; if (h.gate) await h.gate.promise;
      db.exec("BEGIN IMMEDIATE");
      try { for (const [key, value] of entries) { put(key, value); if (h.failure === "rollback") throw new Error("native-write-failed"); } db.exec("COMMIT"); }
      catch (error) { db.exec("ROLLBACK"); throw error; }
      if (h.failure === "lost-ack") throw new Error("lost-native-response");
    },
    multiRemove: async keys => { for (const key of keys) db.prepare("DELETE FROM store WHERE key=?").run(key); },
    getAllKeys: async () => db.prepare("SELECT key FROM store").all().map(row => row.key),
  };
  const module = { exports: {} };
  const scope = { module, exports: module.exports, Error, setTimeout, clearTimeout,
    require: name => name.includes("async-storage") ? { default: adapter } : {
      encryptText: async text => { if (h.encryptGate && text.includes("slow-old")) await h.encryptGate.promise; return `v2:${text}`; },
      decryptText: async text => text.slice(3),
    } };
  vm.runInNewContext(js(read("utils/storage.ts")), scope);
  h.api = module.exports; h.api.setAccountStorageAvailable(true); h.adapter = adapter; h.get = get;
  return h;
}
function loadPure(file) {
  const module = { exports: {} }; vm.runInNewContext(js(read(file)), { module, exports: module.exports, Error }); return module.exports;
}
function declaration(file, name) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let result;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(tree); ts.forEachChild(node, visit); }
  visit(tree); assert.ok(result, name); return result;
}
try {
  {
    const h = harness(); h.encryptGate = deferred();
    const older = h.api.saveJSONNow("finzo:transactions", ["slow-old"]);
    await tick(); const newer = h.api.saveJSONNow("finzo:transactions", ["latest"]);
    await tick(); h.encryptGate.resolve(); await Promise.all([older, newer]);
    assert.equal(h.get("finzo:transactions"), 'v2:["latest"]', "una escritura antigua no puede terminar encima de una nueva");
  }
  const boxes = loadPure("utils/cajas.ts"), personal = loadPure("utils/privateBoxPersonal.ts");
  const box = { id: "caja-a", nombre: "A", creadaEn: 1 };
  const move = { id: "mov-a", cajaId: box.id, tipo: "ingreso", monto: 100, descripcion: "Aporte", fecha: "2026-10-05", creadoEn: 2, personalTransactionId: 10 };
  const data = { cajas: [box], movimientos: [move], cajasBorradas: [], movimientosBorrados: [] };
  const transfer = { id: 10, type: "expense", amount: 100, internalTransfer: "box", internalTransferLink: move.id, internalTransferSpaceId: box.id };
  {
    const h = harness(), keys = ["finzo:transactions", "finzo:cajasDinero"];
    h.gate = deferred(); let committed = false;
    const batch = h.api.saveJSONBatchNow(keys, () => ({ entries: [[keys[0], [transfer]], [keys[1], data]], stillValid: () => true, committed: () => { committed = true; } }));
    await tick(); assert.equal(committed, false); assert.equal(h.get(keys[0]), null);
    const stale = h.api.saveJSONNow(keys[0], []); h.api.saveJSON(keys[1], { cajas: [], movimientos: [] });
    h.gate.resolve(); assert.equal(await batch, true); assert.equal(await stale, false); await h.api.flushPendingSaves();
    assert.equal(committed, true); assert.equal(JSON.parse(h.get(keys[0]).slice(3))[0].amount, 100);
    assert.equal(JSON.parse(h.get(keys[1]).slice(3)).movimientos[0].monto, 100);
  }
  for (const failure of ["rollback", "lost-ack"]) {
    const h = harness(); h.failure = failure; let committed = false;
    const ok = await h.api.saveJSONBatchNow(["finzo:transactions", "finzo:cajasDinero"], () => ({
      entries: [["finzo:transactions", [transfer]], ["finzo:cajasDinero", data]], stillValid: () => true, committed: () => { committed = true; } }));
    assert.equal(ok, failure === "lost-ack"); assert.equal(committed, ok);
    assert.equal(h.get("finzo:transactions") === null, failure === "rollback");
    assert.equal(h.get("finzo:cajasDinero") === null, failure === "rollback");
  }
  {
    const h = harness(); h.encryptGate = deferred(); let committed = false;
    const batch = h.api.saveJSONBatchNow(["finzo:transactions", "finzo:cajasDinero"], () => ({
      entries: [["finzo:transactions", ["slow-old"]], ["finzo:cajasDinero", data]], stillValid: () => true, committed: () => { committed = true; } }));
    await tick(); h.api.setAccountStorageAvailable(false); h.api.setAccountStorageAvailable(true); h.encryptGate.resolve();
    assert.equal(await batch, false); assert.equal(h.batches, 0); assert.equal(committed, false);
  }
  {
    const h = harness(); h.api.saveJSON("finzo:transactions", [{ id: 8, amount: 20 }]);
    assert.equal(await h.api.saveJSONBatchNow(["finzo:transactions", "finzo:cajasDinero"], () => { throw new Error("private-box-source-changed"); }), false);
    await h.api.flushPendingSaves(); assert.equal(JSON.parse(h.get("finzo:transactions").slice(3))[0].id, 8, "un intento rechazado no cancela cambios anteriores pendientes");
  }
  // La acción del contexto es la original; solo se sustituyen React y la sesión.
  for (const failure of [null, "rollback"]) {
    const h = harness(); h.failure = failure; const events = [];
    const scope = { ready: true, hasOnboarded: true, Platform: { OS: "android" },
      auth: { currentUser: { uid: "a" } }, localSessionVersion: { current: 1 },
      transactionsLive: { current: [] }, deletedTransactionIdsRef: { current: [] }, returnReceipt: { current: null },
      captureAccountTask: () => ({ current: () => true }), withLocalAccountOperation: work => work(),
      hasUnreadableLocalData: h.api.hasUnreadableLocalData, saveJSONBatchNow: h.api.saveJSONBatchNow, STORAGE_KEYS: h.api.STORAGE_KEYS,
      validarCajas: boxes.validarCajas, fusionarCajas: boxes.fusionarCajas, CAJAS_VACIAS: boxes.CAJAS_VACIAS,
      patchPrivateBoxPersonal: personal.patchPrivateBoxPersonal, validatePrivateBoxPatch: personal.validatePrivateBoxPatch,
      guardarCajasEnMemoria: () => events.push("cache"), setTransactions: rows => { scope.transactionsLive.current = rows; events.push("personal"); },
      setDeletedTransactionIds: ids => { scope.deletedTransactionIdsRef.current = ids; }, Error };
    vm.runInNewContext(js(declaration("contexts/AppDataContext.tsx", "commitPrivateBoxData") + "\nglobalThis.commit=commitPrivateBoxData;"), scope);
    const ok = await scope.commit(boxes.CAJAS_VACIAS, data, [transfer], [], () => true, () => events.push("box"));
    assert.equal(ok, failure === null); assert.equal(scope.transactionsLive.current.length, ok ? 1 : 0);
    assert.equal(events.includes("box"), ok); assert.equal(events.includes("personal"), ok);
  }
  const settled = personal.patchPrivateBoxPersonal([{ ...transfer, extra: "keep", internalTransferSettled: true, internalTransferConsumedAmount: 100 }], [], [transfer], []);
  assert.equal(settled.transactions[0].extra, "keep"); assert.equal(settled.transactions[0].internalTransferConsumedAmount, 100);
  assert.throws(() => personal.patchPrivateBoxPersonal([{ ...transfer, internalTransfer: "family" }], [], [transfer], []), /id-conflict/);
  assert.throws(() => personal.validatePrivateBoxPatch(data, { ...data, movimientos: [] }, [{ ...transfer, internalTransferSpaceId: "otra" }], [], [10], "a"), /id-conflict/);
  assert.throws(() => personal.validatePrivateBoxPatch(boxes.CAJAS_VACIAS, data, [], [], [], "a"), /invalid-patch/, "no permite guardar solo la Caja si falta preparar Personal");
  // Ejecuta también las acciones reales de pantalla con el contexto y el
  // almacén reales. Traducción, teclado y React son las únicas piezas simuladas.
  const linked = loadPure("utils/linkedTransfers.ts");
  function screenHarness(before, rows = []) {
    const h = harness(), events = [];
    const ctx = { ready: true, hasOnboarded: true, Platform: { OS: "android" }, auth: { currentUser: { uid: "a" } },
      localSessionVersion: { current: 1 }, transactionsLive: { current: rows }, deletedTransactionIdsRef: { current: [] }, returnReceipt: { current: null },
      captureAccountTask: () => ({ current: () => true }), withLocalAccountOperation: work => work(),
      hasUnreadableLocalData: h.api.hasUnreadableLocalData, saveJSONBatchNow: h.api.saveJSONBatchNow, STORAGE_KEYS: h.api.STORAGE_KEYS,
      validarCajas: boxes.validarCajas, fusionarCajas: boxes.fusionarCajas, CAJAS_VACIAS: boxes.CAJAS_VACIAS,
      patchPrivateBoxPersonal: personal.patchPrivateBoxPersonal, validatePrivateBoxPatch: personal.validatePrivateBoxPatch,
      guardarCajasEnMemoria: () => {}, setTransactions: value => { ctx.transactionsLive.current = value; },
      setDeletedTransactionIds: value => { ctx.deletedTransactionIdsRef.current = value; }, Error };
    vm.runInNewContext(js(declaration("contexts/AppDataContext.tsx", "commitPrivateBoxData") + "\nglobalThis.commit=commitPrivateBoxData;"), ctx);
    let id = 1000;
    const s = { ...linked, ctx, h, events, accountUid: "a", auth: ctx.auth, userCurrency: "PEN", userName: "A", isPremium: true,
      guardandoRef: { current: false }, guardando: false, syncIssue: null, ready: true, cloudReady: true, compartiendo: false, cargandoUnion: false,
      cuentaActual: () => true, hasUnreadableLocalData: h.api.hasUnreadableLocalData, datosActuales: { current: before }, datos: before,
      movimientos: before.movimientos, transactions: rows, caja: before.cajas[0], disponible: 500,
      nuevoNombre: "Viaje", montoInicial: "100", origenDinero: "personal", monto: "20", anotando: "ingreso", descripcion: "Aporte",
      category: "otros", method: "transfer", notes: "", movementDate: "2026-10-05", editandoAporteId: null, seleccionados: [], cajasSeleccionadas: [],
      t: key => key, showToast: key => events.push(key), amountInputError: () => null, parseAmountInput: Number, validSpaceDate: () => true,
      fechaLocal: () => "2026-10-05", horaDe: () => "12:00", nextId: () => ++id, nuevoIdCaja: prefix => `${prefix}-${++id}`,
      tomarAccionLocal: () => !s.guardandoRef.current, siguienteVersionCaja: boxes.siguienteVersionCaja,
      commitPrivateBoxData: ctx.commit, setGuardando: value => { s.guardando = value; },
      setDatos: value => { s.datosActuales.current = value; s.datos = value; },
      setNuevoNombre() {}, setMontoInicial() {}, setOrigenDinero() {}, setCreando() {}, setCajaId() {}, setLista() {}, setMonto() {}, setDescripcion() {},
      setEditandoAporteId() {}, setAnotando() {}, setNotes() {}, setMovementDate() {}, setSeleccionados() {}, setSeleccionando() {}, setCajasSeleccionadas() {}, setSeleccionandoCajas() {},
      Error };
    const names = ["guardarCambioCaja", "sacarDePersonal", "crearCaja", "guardarMovimiento", "borrarSeleccionados", "borrarCajas", "devolverAPersonal"];
    vm.runInNewContext(js(names.map(name => declaration("screens/Cajas.tsx", name)).join("\n") + "\nglobalThis.actions={crearCaja,guardarMovimiento,borrarSeleccionados,borrarCajas,devolverAPersonal};"), s);
    return s;
  }
  {
    const s = screenHarness(boxes.CAJAS_VACIAS); await s.actions.crearCaja();
    assert.equal(s.ctx.transactionsLive.current[0].amount, 100); assert.equal(s.datosActuales.current.movimientos[0].monto, 100);
    assert.equal(s.events.includes("boxes.saved"), true);
  }
  {
    const s = screenHarness({ ...data, movimientos: [] }); await s.actions.guardarMovimiento();
    assert.equal(s.ctx.transactionsLive.current[0].amount, 20); assert.equal(s.datosActuales.current.movimientos[0].monto, 20);
  }
  {
    const s = screenHarness(data, [transfer]); s.editandoAporteId = move.id; s.monto = "80"; await s.actions.guardarMovimiento();
    assert.equal(s.ctx.transactionsLive.current[0].amount, 80); assert.equal(s.datosActuales.current.movimientos[0].monto, 80);
  }
  {
    const s = screenHarness(data, [transfer]); s.seleccionados = [move.id]; await s.actions.borrarSeleccionados();
    assert.equal(s.ctx.transactionsLive.current.length, 0); assert.equal(s.datosActuales.current.movimientos.length, 0);
    assert.ok(s.ctx.deletedTransactionIdsRef.current.includes(10));
  }
  const spent = { id: "mov-spent", cajaId: box.id, tipo: "gasto", monto: 60, descripcion: "Compras", fecha: "2026-10-05", creadoEn: 3 };
  {
    const s = screenHarness({ ...data, movimientos: [move, spent] }, [transfer]); s.devolvibleAPersonal = 40; await s.actions.devolverAPersonal();
    assert.equal(s.ctx.transactionsLive.current.find(row => row.type === "income").amount, 40);
    assert.equal(boxes.saldoCaja(box.id, s.datosActuales.current.movimientos), 0);
  }
  {
    const returned = { ...move, id: "mov-return", tipo: "gasto", monto: 40, personalReturnAmount: 40, personalTransactionId: 11 };
    const s = screenHarness({ ...data, movimientos: [move, spent, returned] }, [transfer, { ...transfer, id: 11, type: "income", amount: 40, internalTransferLink: returned.id }]);
    s.cajasSeleccionadas = [box.id]; assert.equal(await s.actions.borrarCajas(), true);
    assert.equal(s.datosActuales.current.cajas.length, 0); assert.ok(s.ctx.transactionsLive.current.every(row => row.internalTransferSettled));
    assert.equal(s.ctx.transactionsLive.current.find(row => row.id === 10).internalTransferConsumedAmount, 60);
  }
  {
    const s = screenHarness(boxes.CAJAS_VACIAS); s.h.failure = "rollback"; await s.actions.crearCaja();
    assert.equal(s.ctx.transactionsLive.current.length, 0); assert.equal(s.datosActuales.current.cajas.length, 0);
    assert.ok(s.events.includes("toast.localSaveFailed")); assert.equal(s.events.includes("boxes.saved"), false);
  }
  {
    const s = screenHarness(boxes.CAJAS_VACIAS); s.ctx.Platform.OS = "ios"; await s.actions.crearCaja();
    assert.ok(s.events.includes("boxes.atomicAndroidOnly")); assert.equal(s.h.batches, 0);
    s.origenDinero = "externo"; await s.actions.crearCaja();
    assert.equal(s.ctx.transactionsLive.current.length, 0); assert.equal(s.datosActuales.current.cajas.length, 1);
  }
  {
    const s = screenHarness(data, [transfer]); s.syncIssue = "boxes.syncConflict"; s.seleccionados = [move.id];
    await s.actions.borrarSeleccionados(); assert.equal(s.h.batches, 0); assert.equal(s.datosActuales.current.movimientos.length, 1);
  }
  {
    const pending = { ...data, cajas: [{ ...box, sharingPending: true }] };
    assert.equal(boxes.fusionarCajas(pending, data).cajas[0].sharingPending, true, "una copia de la nube no borra el aviso local pendiente");
    assert.equal(boxes.copiaPrivadaCoincide(pending.cajas[0], [move], data), true, "la señal local no cambia el contenido financiero copiado");
    const s = screenHarness(pending, [transfer]); s.seleccionados = [move.id]; await s.actions.borrarSeleccionados();
    assert.equal(s.h.batches, 0); assert.ok(s.events.includes("boxes.sharingPending"));
  }
  // SQLite real y proceso que termina ENTRE los dos INSERT. No es una prueba
  // física del módulo Java/Kotlin, pero sí de la garantía del lote utilizado.
  for (const when of ["between", "after"]) {
    const file = path.join(temp, `${when}.sqlite`), db = new DatabaseSync(file);
    db.exec("CREATE TABLE store (key TEXT PRIMARY KEY, value TEXT)");
    db.prepare("INSERT INTO store VALUES (?,?)").run("personal", "viejo-personal"); db.prepare("INSERT INTO store VALUES (?,?)").run("cajas", "vieja-caja"); db.close();
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--crash-worker", file, when], { stdio: "pipe" });
    assert.equal(result.status, when === "between" ? 20 : 0, result.stderr?.toString());
    const reopened = new DatabaseSync(file); const rows = Object.fromEntries(reopened.prepare("SELECT * FROM store").all().map(row => [row.key, row.value])); reopened.close();
    assert.equal(rows.personal, when === "between" ? "viejo-personal" : "nuevo-personal"); assert.equal(rows.cajas, when === "between" ? "vieja-caja" : "nueva-caja");
  }
  const native = fs.readFileSync("node_modules/@react-native-async-storage/async-storage/android/src/main/java/com/reactnativecommunity/asyncstorage/AsyncStorageModule.java", "utf8");
  const body = native.slice(native.indexOf("public void multiSet"), native.indexOf("public void multiRemove"));
  assert.ok(body.indexOf("beginTransaction()") < body.indexOf("statement.execute()"));
  assert.ok(body.indexOf("statement.execute()") < body.indexOf("setTransactionSuccessful()")); assert.ok(body.includes("endTransaction()"));
  const room = fs.readFileSync("node_modules/@react-native-async-storage/async-storage/android/src/main/java/com/reactnativecommunity/asyncstorage/next/StorageSupplier.kt", "utf8");
  assert.match(room, /@Transaction\s+@Insert[^\n]*\n\s+suspend fun setValues/);
  console.log("Personal/Cajas: escrituras ordenadas, lote indivisible, respuesta perdida, cuenta y cierre de proceso con SQLite real comprobados.");
} finally {
  for (const db of instances) db.close();
  // Solo los archivos generados por esta prueba, nunca rutas de usuario.
  for (const file of fs.readdirSync(temp)) fs.unlinkSync(path.join(temp, file)); fs.rmdirSync(temp);
}

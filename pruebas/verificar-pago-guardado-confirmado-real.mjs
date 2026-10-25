import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { recordOriginOriginal } from "./helpers/record-origin-original.mjs";

// Android/React adaptados, SQLite y cuerpos de las funciones originales.
// Todo el dinero es ficticio. FINO_TEST_BASELINE=1955c268 demuestra el fallo.
const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const compiled = new Map();
const js = code => {
  if (!compiled.has(code)) compiled.set(code, ts.transpile(code, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }));
  return compiled.get(code);
};
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const requireCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const financial = recordOriginOriginal(), databases = [];
function load(file, dependencies) {
  const entry = { exports: {} };
  vm.runInNewContext(js(read(file)), { module: entry, exports: entry.exports, Error, Promise, setTimeout, clearTimeout,
    require: name => dependencies?.(name) ?? (name.startsWith("@/") ? load(`${name.slice(2)}.ts`, dependencies) : requireCore(name)) });
  return entry.exports;
}
const sourceDeclarations = new Map();
function declaration(file, name, required = true) {
  if (!sourceDeclarations.has(file)) {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), declarations = new Map();
    function visit(node) {
      if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(ast));
      if (ts.isVariableDeclaration(node) && node.initializer?.expression?.getText(ast) === "useCallback") {
        declarations.set(node.name.getText(ast), `const ${node.name.getText(ast)} = (${node.initializer.arguments[0].getText(ast)});`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast); sourceDeclarations.set(file, declarations);
  }
  const found = sourceDeclarations.get(file).get(name) ?? "";
  if (required) assert.ok(found, name); return found;
}
const fields = load("utils/cloudFieldMerge.ts"), reservation = load("utils/privateBoxMoneyLocalWrite.ts");
const amounts = load("utils/amount.ts"), calendar = load("utils/calendarioPagos.ts", name => name.endsWith("iconosFavoritos") ? { esFoto: value => value?.startsWith("data:") } : undefined);
const queue = declaration("utils/localAccountVault.ts", "withLocalAccountOperation").replace(/^export\s+/, "");
const payment = { id: "payment-fixture", nombre: "Luz ficticia", tipo: "pago", monto: 25, dia: 15, repite: "mensual",
  avisoDiasAntes: 0, avisoHora: "09:00", pagados: [], creado: 1, categoria: "servicios", icono: "Zap" };
const row = { id: 1, creationId: "fixture-existing", type: "income", amount: 100, category: "otros", date: "2026-10-01", description: "Ficticio", updatedAt: 1 };
const emptyBoxes = { cajas: [], movimientos: [], cajasBorradas: [], movimientosBorrados: [] };
function harness(file = ":memory:", initialPayments = [payment], initialRows = [row]) {
  const db = new DatabaseSync(file); databases.push(db);
  db.exec("CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)");
  const h = { db, failure: null, gate: null, encryptGate: null, batches: [], toasts: [], uid: "A", version: 1, crash: null };
  const get = key => db.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
  const put = (key, value) => db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value);
  const adapter = {
    getItem: async key => get(key), setItem: async (key, value) => put(key, value),
    multiGet: async keys => { if (h.failure === "unconfirmed" && h.batches.length) throw Error("read-failed"); return keys.map(key => [key, get(key)]); },
    multiSet: async entries => {
      h.batches.push(entries.map(([key]) => key)); if (h.gate) await h.gate.promise;
      db.exec("BEGIN IMMEDIATE");
      try {
        for (let i = 0; i < entries.length; i++) {
          put(...entries[i]);
          if (h.crash === "between" && i === 0) process.exit(20);
          if (h.failure === "rollback") throw Error("disk-full");
        }
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      if (h.crash === "after") process.exit(21);
      if (h.failure === "lost-ack") throw Error("native-ack-lost");
    },
    multiRemove: async keys => { for (const key of keys) db.prepare("DELETE FROM store WHERE key=?").run(key); },
    getAllKeys: async () => db.prepare("SELECT key FROM store").all().map(item => item.key),
  };
  h.storage = load("utils/storage.ts", name => name.includes("async-storage") ? { default: adapter } : name.endsWith("encryption") ? {
    encryptText: async value => { if (h.encryptGate) await h.encryptGate.promise; return `v2:${value}`; }, decryptText: async value => value.slice(3),
  } : undefined);
  h.storage.setAccountStorageAvailable(true); h.get = get; h.put = put;
  const auth = { get currentUser() { return h.uid ? { uid: h.uid } : null; } };
  const task = load("utils/accountTask.ts", name => name.endsWith("firebase") ? { auth } : name.endsWith("storage") ? h.storage : undefined);
  const data = { userName: "Ficticio", userPhoto: null, userCurrency: "PEN", userLanguage: "es", hasOnboarded: true,
    transactions: plain(initialRows), goals: [], budgets: {}, categoryBudgets: {}, pagosProgramados: plain(initialPayments), syncUpdatedAt: {} };
  let sequence = 1000;
  const ctx = { ...financial, ...fields, ...reservation, ...calendar, ...amounts, ...h.storage, ...task,
    auth, ready: true, hasOnboarded: true, Platform: { OS: "android" }, localSessionVersion: { current: 1 },
    transactionsLive: { current: plain(initialRows) }, deletedTransactionIdsRef: { current: [] },
    pagosProgramadosLive: { current: plain(initialPayments) }, paymentWriteReserved: { current: null }, paymentWritePublishing: { current: false },
    pagosEnCurso: { current: new Set() }, solicitarPermisoDePagos: { current: false }, cloudFieldsRef: { current: data }, cloudSyncMetaRef: { current: {} },
    CAJAS_VACIAS: emptyBoxes, leerCajasEnMemoria: () => null, currencyForReturn: { current: "PEN" }, merchantLearned: {},
    canonical: JSON.stringify, randomUUID, nextId: () => ++sequence, issuedCreationId: id => `issued-${id}`,
    datosParaLaNube: () => ctx.cloudFieldsRef.current, suggestCategory: () => "otros", showToast: text => h.toasts.push(text), t: key => key,
    Date, Error, Promise, setTimeout, clearTimeout };
  Object.defineProperty(ctx, "pagosProgramados", { get: () => ctx.pagosProgramadosLive.current });
  Object.defineProperty(ctx, "transactions", { get: () => ctx.transactionsLive.current });
  ctx.setPagosProgramados = value => {
    ctx.pagosProgramadosLive.current = typeof value === "function" ? value(ctx.pagosProgramadosLive.current) : value;
    h.storage.saveJSON(h.storage.STORAGE_KEYS.pagosProgramados, ctx.pagosProgramadosLive.current);
  };
  ctx.setTransactions = value => { ctx.transactionsLive.current = value; h.storage.saveJSON(h.storage.STORAGE_KEYS.transactions, value); };
  ctx.setDeletedTransactionIds = value => { ctx.deletedTransactionIdsRef.current = value; h.storage.saveJSON(h.storage.STORAGE_KEYS.deletedTransactionIds, value); };
  ctx.setRenderedTransactions = value => h.storage.saveJSON(h.storage.STORAGE_KEYS.transactions, value);
  ctx.setRenderedDeletedTransactionIds = value => h.storage.saveJSON(h.storage.STORAGE_KEYS.deletedTransactionIds, value);
  ctx.setRenderedPagosProgramados = value => h.storage.saveJSON(h.storage.STORAGE_KEYS.pagosProgramados, value);
  ctx.setCloudSyncMeta = value => h.storage.saveJSON(h.storage.STORAGE_KEYS.cloudSyncMeta, value);
  const fileContext = "contexts/AppDataContext.tsx";
  const setters = ["setTransactions", "setDeletedTransactionIds", "setPagosProgramados"].map(name => declaration(fileContext, name, false)).join("\n");
  vm.runInNewContext(js(`let operation = Promise.resolve();\n${queue}\n${setters}\n${["markCloudGroup", "guardarPagoProgramado", "quitarPagoProgramado", "marcarPagoDelMes"].map(name => declaration(fileContext, name)).join("\n")}\nObject.assign(globalThis, { setPagosProgramados, setTransactions, setDeletedTransactionIds });`), ctx);
  // La versión antigua guardaba la marca primero y delegaba el gasto: la
  // adaptación conserva ese camino y reproduce un fallo de ese guardado.
  ctx.addOrUpdateTransaction = () => false;
  h.ctx = ctx;
  h.seed = async () => {
    const k = h.storage.STORAGE_KEYS;
    for (const [key, value] of [[k.pagosProgramados, initialPayments], [k.transactions, initialRows], [k.deletedTransactionIds, []], [k.cloudSyncMeta, {}], [k.cajasDinero, emptyBoxes]]) {
      assert.equal(await h.storage.saveJSONNow(key, value), true);
    }
  };
  h.restart = async () => {
    const k = h.storage.STORAGE_KEYS;
    return { payments: await h.storage.loadJSON(k.pagosProgramados, []), transactions: await h.storage.loadJSON(k.transactions, []), metadata: await h.storage.loadJSON(k.cloudSyncMeta, {}) };
  };
  return h;
}

if (process.argv[2] === "crash") {
  const h = harness(process.argv[3]); await h.seed(); h.crash = process.argv[4];
  await h.ctx.marcarPagoDelMes(payment.id, "2026-10", true); process.exit(99);
}
try {
  {
    const h = harness(); await h.seed(); h.gate = deferred();
    const saved = h.ctx.marcarPagoDelMes(payment.id, "2026-10", true); await tick();
    assert.deepEqual(plain(h.ctx.pagosProgramados[0].pagados), [], "no marcar Pagado antes de confirmar SQLite");
    assert.equal(h.ctx.transactions.length, 1); assert.deepEqual(h.toasts, []);
    assert.equal(await h.ctx.marcarPagoDelMes(payment.id, "2026-10", true), false, "doble toque bloqueado hasta confirmar");
    h.gate.resolve(); assert.equal(await saved, true);
    const restored = await h.restart(); assert.deepEqual(plain(restored.payments[0].pagados), ["2026-10"]);
    assert.equal(restored.transactions.length, 2); assert.equal(restored.payments[0].movimientos["2026-10"], restored.transactions.find(tx => tx.id !== 1).id);
  }
  for (const failure of ["rollback", "lost-ack"]) {
    const h = harness(); await h.seed(); h.failure = failure;
    const saved = await h.ctx.marcarPagoDelMes(payment.id, "2026-10", true);
    assert.equal(saved, failure === "lost-ack"); assert.equal(h.ctx.pagosProgramados[0].pagados.includes("2026-10"), saved);
    assert.equal((await h.restart()).transactions.length, saved ? 2 : 1);
    h.failure = null; assert.equal(await h.ctx.marcarPagoDelMes(payment.id, "2026-10", true), true);
    assert.equal((await h.restart()).transactions.length, 2, "reintentar no duplica el gasto confirmado");
  }
  {
    const edited = { ...row, id: 50, amount: 30, type: "expense", category: "comida", notes: "Edición propia", icono: "Home" };
    const linked = { ...payment, pagados: ["2026-10"], movimientos: { "2026-10": 50 } };
    const h = harness(":memory:", [linked], [row, edited]); await h.seed();
    assert.equal(await h.ctx.marcarPagoDelMes(payment.id, "2026-10", false), true);
    assert.equal(await h.ctx.marcarPagoDelMes(payment.id, "2026-10", true), true);
    assert.deepEqual(plain(h.ctx.transactions.find(tx => tx.id === 50)), edited, "desmarcar y marcar conserva notas, categoría y monto editados");
    assert.equal(h.ctx.transactions.length, 2);
  }
  {
    const h = harness(":memory:", [{ ...payment, tipo: "recordatorio", monto: undefined }]); await h.seed();
    assert.equal(await h.ctx.marcarPagoDelMes(payment.id, "2026-10", true), true);
    assert.equal(h.ctx.transactions.length, 1, "un recordatorio no crea dinero");
    assert.equal((await h.restart()).payments[0].pagados[0], "2026-10");
  }
  for (const reason of ["uid", "version", "storage"]) {
    const h = harness(); await h.seed(); h.encryptGate = deferred();
    const saving = h.ctx.marcarPagoDelMes(payment.id, "2026-10", true); await tick();
    if (reason === "uid") h.uid = "B";
    if (reason === "version") h.ctx.localSessionVersion.current++;
    if (reason === "storage") h.storage.setAccountStorageAvailable(false);
    h.encryptGate.resolve(); assert.equal(await saving, false);
    assert.equal(h.ctx.pagosProgramados[0].pagados.length, 0); assert.equal(h.ctx.transactions.length, 1);
  }
  {
    const h = harness(); await h.seed(); h.gate = deferred();
    const saving = h.ctx.marcarPagoDelMes(payment.id, "2026-10", true); await tick();
    h.ctx.guardarPagoProgramado({ ...payment, nombre: "Nombre editado" });
    h.gate.resolve(); assert.equal(await saving, true); await tick();
    assert.equal(h.ctx.pagosProgramados[0].nombre, "Nombre editado");
    assert.deepEqual(plain(h.ctx.pagosProgramados[0].pagados), ["2026-10"], "la edición en cola conserva el pago recién confirmado");
    assert.equal(h.ctx.transactions.length, 2);
  }
  {
    const h = harness(); await h.seed(); h.gate = deferred();
    const saving = h.ctx.marcarPagoDelMes(payment.id, "2026-10", true); await tick();
    const before = plain([h.ctx.cloudFieldsRef.current, h.ctx.cloudSyncMetaRef.current, h.ctx.pagosProgramados]);
    assert.throws(() => h.ctx.setPagosProgramados([]), /payment-write-reserved/);
    assert.throws(() => h.ctx.markCloudGroup("payments", h.ctx.pagosProgramados, () => []), /payment-write-reserved/);
    assert.deepEqual(plain([h.ctx.cloudFieldsRef.current, h.ctx.cloudSyncMetaRef.current, h.ctx.pagosProgramados]), before,
      "la reserva rechaza antes de cambiar pagos, copia o metadatos");
    Object.assign(h.ctx, { privateBoxCloudResponseCurrent: () => true, goalsLive: { current: [] }, deletedGoalIdsRef: { current: [] },
      goalWriteReserved: { current: false }, setRespaldoFallo: value => h.toasts.push(value), getFavoritos: () => [], userCountry: "PE", userEmail: "fixture@example.test" });
    for (const name of ["setUserName", "setUserPhoto", "setUserCurrency", "setUserLanguage", "setBudgets", "setCategoryBudgets", "setMerchantLearned",
      "saveOverrides", "setCategoryOverridesState", "savePropias", "setCategoriasPropiasState", "setCarryoverCleared", "saveFavoritos", "setIconosFavoritosState", "setGoals", "setDeletedGoalIds"]) h.ctx[name] = () => {};
    vm.runInNewContext(js(`${declaration("contexts/AppDataContext.tsx", "applyNewerCloudFields")}\nglobalThis.receive = applyNewerCloudFields;`), h.ctx);
    const incoming = { ...h.ctx.cloudFieldsRef.current, pagosProgramados: [{ ...payment, nombre: "Edición remota" }],
      syncUpdatedAt: fields.recordCloudGroupChange({}, "payments", [payment], [{ ...payment, nombre: "Edición remota" }], Date.now() + 1000) };
    assert.equal(h.ctx.receive(incoming), false, "una respuesta remota no pisa el lote reservado");
    assert.deepEqual(plain([h.ctx.cloudFieldsRef.current, h.ctx.cloudSyncMetaRef.current, h.ctx.pagosProgramados]), before,
      "tampoco cambia parcialmente los datos antes de rechazar la copia remota");
    assert.ok(!h.toasts.includes("datos-nube-invalidos"), "una reserva temporal no diagnostica una copia dañada");
    h.gate.resolve(); assert.equal(await saving, true);
    assert.equal(h.ctx.receive(incoming), true, "la misma ruta válida funciona una vez terminada la reserva");
    assert.equal(h.ctx.pagosProgramados[0].nombre, "Edición remota");
    assert.ok(h.ctx.pagosProgramados[0].pagados.includes("2026-10")); assert.equal(h.ctx.transactions.length, 2);
  }
  {
    const h = harness(); await h.seed(); h.encryptGate = deferred();
    const saving = h.ctx.marcarPagoDelMes(payment.id, "2026-10", true); await tick();
    h.ctx.quitarPagoProgramado(payment.id); h.encryptGate.resolve();
    assert.equal(await saving, false, "borrar antes de reservar invalida el lote preparado");
    assert.equal(h.ctx.pagosProgramados.length, 0); assert.equal(h.ctx.transactions.length, 1);
  }
  for (const crash of ["between", "after"]) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "fino-payment-proof-")), file = path.join(folder, "proof.sqlite");
    try {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "crash", file, crash], { encoding: "utf8" });
      assert.equal(child.status, crash === "between" ? 20 : 21, child.stderr);
      const h = harness(file); const restored = await h.restart(), committed = crash === "after";
      assert.equal(restored.payments[0].pagados.includes("2026-10"), committed);
      assert.equal(restored.transactions.length, committed ? 2 : 1, "interrupción conserva ambas mitades o ninguna");
      h.ctx.pagosProgramadosLive.current = restored.payments; h.ctx.transactionsLive.current = restored.transactions;
      h.ctx.cloudSyncMetaRef.current = restored.metadata; h.ctx.cloudFieldsRef.current.pagosProgramados = restored.payments;
      assert.equal(await h.ctx.marcarPagoDelMes(payment.id, "2026-10", true), true);
      assert.equal((await h.restart()).transactions.length, 2, "reabrir y reintentar conserva un único gasto");
      await h.storage.flushPendingSaves(); h.db.close(); databases.splice(databases.indexOf(h.db), 1);
    } finally {
      assert.equal(path.dirname(path.resolve(folder)), path.resolve(os.tmpdir()));
      assert.ok(path.basename(folder).startsWith("fino-payment-proof-"));
      fs.rmSync(folder, { recursive: true, force: true });
    }
  }
  for (const [file, name] of [["screens/CalendarioPagos.tsx", "pagar"], ["screens/Home.tsx", "confirmarAvisoCalendario"]]) {
    for (const outcome of [false, true, "throw"]) {
      const pending = deferred(), notices = [], closed = [];
      const ctx = { pagosProgramados: [payment], avisoCalendarioSeleccionado: { pago: payment, mes: "2026-10" },
        marcarPagoDelMes: async () => { await pending.promise; if (outcome === "throw") throw Error("disk-full"); return outcome; },
        showToast: value => notices.push(value), t: key => key, fmt: String, setAvisoCalendarioSeleccionado: value => closed.push(value), Error };
      vm.runInNewContext(js(`${declaration(file, name)}\nglobalThis.action = ${name};`), ctx);
      const result = name === "pagar" ? ctx.action(payment.id, "2026-10") : ctx.action(); await tick();
      assert.deepEqual(notices, [], "la pantalla no anuncia éxito antes de confirmar el lote");
      pending.resolve(); await result;
      assert.equal(notices.some(value => value.includes("Done") || value.includes("pagadoAviso")), outcome === true);
      if (name !== "pagar") assert.equal(closed.length, outcome === true ? 1 : 0);
    }
  }
  console.log("Pagos originales con SQLite: marca/enlace/gasto atómicos, fallos y ACK perdido, doble toque, reintento y reinicio reales sin duplicar; recordatorio y edición preservados; Home/Calendario solo avisan tras confirmar. Datos ficticios, no Android.");
} finally {
  for (const db of databases) { try { db.close(); } catch { /* ya cerrado */ } }
}

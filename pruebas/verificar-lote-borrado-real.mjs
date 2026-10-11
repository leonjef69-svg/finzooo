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

// Ejecuta acciones y almacén originales. Solo React, Auth y el puente Android
// se adaptan; multiSet usa una transacción SQLite real y datos ficticios.
const baseline = process.env.FINO_TEST_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Se requiere hash de Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const js = source => ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const requireCore = createRequire(new URL("../utils/cajas.ts", import.meta.url));
const financial = recordOriginOriginal();
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(js(read(file)), { module, exports: module.exports, Error, Promise, setTimeout, clearTimeout,
    require: name => dependencies?.(name) ?? (name.startsWith("@/") ? load(`${name.slice(2)}.ts`, dependencies) : requireCore(name)) });
  return module.exports;
}
function declaration(file, name, required = true) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found = "";
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree); if (required) assert.ok(found, name); return found;
}
function setterCallback(name) {
  const file = "contexts/AppDataContext.tsx", tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found = "";
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(tree) === "useCallback") found = node.initializer.arguments[0].getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree); return found;
}
const reservation = load("utils/privateBoxMoneyLocalWrite.ts");
const merges = load("utils/mergeTransactions.ts", name => name.endsWith("recordOrigin") || name.endsWith("goalFunding") ? financial : undefined);
const originalQueue = declaration("utils/localAccountVault.ts", "withLocalAccountOperation").replace(/^export\s+/, "");
const row = { id: 10, creationId: "movement-a", type: "expense", amount: 100, category: "otros", description: "Dato ficticio", date: "2026-10-10", updatedAt: 1 };
const goal = { id: 20, creationId: "goal-a", name: "Meta ficticia", saved: 0, target: 100, completed: false, deadline: "2026-12-31" };
const emptyBoxes = { cajas: [], movimientos: [], cajasBorradas: [], movimientosBorrados: [] };
const databases = [];

function harness(file = ":memory:", initialRows = [row], initialGoals = [goal]) {
  const db = new DatabaseSync(file); databases.push(db);
  db.exec("CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value TEXT)");
  const h = { db, failure: null, gate: null, encryptGate: null, batches: [], writes: 0, uid: "a", toasts: [], crash: null };
  const get = key => db.prepare("SELECT value FROM store WHERE key=?").get(key)?.value ?? null;
  const put = (key, value) => db.prepare("INSERT OR REPLACE INTO store VALUES (?,?)").run(key, value);
  const adapter = {
    getItem: async key => get(key),
    setItem: async (key, value) => { if (h.failure === "rollback") throw new Error("disk-full"); h.writes++; put(key, value); },
    multiGet: async keys => {
      if (h.failure === "unconfirmed" && h.batches.length) throw new Error("read-after-commit-failed");
      return keys.map(key => [key, get(key)]);
    },
    multiSet: async entries => {
      h.batches.push(entries.map(([key]) => key));
      if (h.gate) await h.gate.promise;
      db.exec("BEGIN IMMEDIATE");
      try {
        for (let index = 0; index < entries.length; index++) {
          put(...entries[index]);
          if (h.crash === "between" && index === 0) process.exit(20);
          if (h.failure === "rollback") throw new Error("disk-full");
        }
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      if (h.crash === "after") process.exit(21);
      if (h.failure === "lost-ack") throw new Error("native-ack-lost");
    },
    multiRemove: async keys => { for (const key of keys) db.prepare("DELETE FROM store WHERE key=?").run(key); },
    getAllKeys: async () => db.prepare("SELECT key FROM store").all().map(item => item.key),
  };
  h.storage = load("utils/storage.ts", name => name.includes("async-storage") ? { default: adapter } : name.endsWith("encryption") ? {
    encryptText: async text => { if (h.encryptGate) await h.encryptGate.promise; return `v2:${text}`; },
    decryptText: async text => text.slice(3),
  } : undefined);
  h.storage.setAccountStorageAvailable(true);
  h.get = get; h.put = put;
  const auth = { get currentUser() { return h.uid ? { uid: h.uid } : null; } };
  const task = load("utils/accountTask.ts", name => name.endsWith("firebase") ? { auth } : name.endsWith("storage") ? h.storage : undefined);
  const ctx = { ...financial, ...merges, ...reservation, ...h.storage, ...task, ready: true, hasOnboarded: true, isPremium: true,
    auth, Platform: { OS: "android" }, localSessionVersion: { current: 1 },
    transactionsLive: { current: plain(initialRows) }, goalsLive: { current: plain(initialGoals) },
    deletedTransactionIdsRef: { current: [] }, deletedGoalIdsRef: { current: [] }, cloudSyncMetaRef: { current: { profile: 5 } },
    goalWriteReserved: { current: false }, goalWritePublishing: { current: false }, pendingTransactionDeletes: { current: new Set() },
    currencyForReturn: { current: "PEN" }, returnReceipt: { current: null }, randomUUID, issuedCreationId: () => undefined,
    CAJAS_VACIAS: emptyBoxes, leerCajasEnMemoria: () => null, canonical: JSON.stringify,
    unlinkCreditPaymentsForHomeTransactions: async () => {}, showToast: value => h.toasts.push(value), t: key => key,
    setTransactions: value => {
      const next = typeof value === "function" ? value(ctx.transactionsLive.current) : value;
      reservation.assertPrivateBoxMoneyLocalMutation("transactions", next); ctx.transactionsLive.current = next;
      h.storage.saveJSON(h.storage.STORAGE_KEYS.transactions, next);
    },
    setDeletedTransactionIds: value => {
      const next = typeof value === "function" ? value(ctx.deletedTransactionIdsRef.current) : value;
      reservation.assertPrivateBoxMoneyLocalMutation("deletedIds", next); ctx.deletedTransactionIdsRef.current = next;
      h.storage.saveJSON(h.storage.STORAGE_KEYS.deletedTransactionIds, next);
    },
    setGoals: value => {
      if (ctx.goalWriteReserved.current && !ctx.goalWritePublishing.current) throw new Error("goal-write-reserved");
      ctx.goalsLive.current = typeof value === "function" ? value(ctx.goalsLive.current) : value;
      h.storage.saveJSON(h.storage.STORAGE_KEYS.goals, ctx.goalsLive.current);
    },
    setDeletedGoalIds: value => {
      ctx.deletedGoalIdsRef.current = typeof value === "function" ? value(ctx.deletedGoalIdsRef.current) : value;
      h.storage.saveJSON(h.storage.STORAGE_KEYS.deletedGoalIds, ctx.deletedGoalIdsRef.current);
    },
    setCloudSyncMeta: value => h.storage.saveJSON(h.storage.STORAGE_KEYS.cloudSyncMeta, value),
    Date, Error, Promise, setTimeout, clearTimeout };
  Object.defineProperty(ctx, "transactions", { get: () => ctx.transactionsLive.current });
  Object.defineProperty(ctx, "deletedGoalIds", { get: () => ctx.deletedGoalIdsRef.current });
  ctx.setRenderedTransactions = value => h.storage.saveJSON(h.storage.STORAGE_KEYS.transactions, value);
  ctx.setRenderedDeletedTransactionIds = value => h.storage.saveJSON(h.storage.STORAGE_KEYS.deletedTransactionIds, value);
  ctx.setRenderedGoals = value => h.storage.saveJSON(h.storage.STORAGE_KEYS.goals, value);
  ctx.setRenderedDeletedGoalIds = value => h.storage.saveJSON(h.storage.STORAGE_KEYS.deletedGoalIds, value);
  const setters = ["setTransactions", "setDeletedTransactionIds", "setGoals", "setDeletedGoalIds"].map(name => {
    const original = setterCallback(name); return original ? `globalThis.${name} = (${original});` : "";
  }).join("\n");
  const names = ["commitTransactionMutation", "removeTransactions", "deleteTransaction", "repairLinkedTransferTransactions", "deleteGoal", "withdrawMoneyFromGoal"];
  vm.runInNewContext(js("let operation = Promise.resolve();\n" + originalQueue + "\n" + setters + "\n" + names.map(name => declaration("contexts/AppDataContext.tsx", name, name !== "commitTransactionMutation")).join("\n")), ctx);
  h.ctx = ctx;
  h.restartLists = async () => {
    const k = h.storage.STORAGE_KEYS;
    const transactions = await h.storage.loadJSON(k.transactions, []), deleted = await h.storage.loadJSON(k.deletedTransactionIds, []), metadata = await h.storage.loadJSON(k.cloudSyncMeta, {});
    const goals = await h.storage.loadJSON(k.goals, []), deletedGoals = await h.storage.loadJSON(k.deletedGoalIds, []);
    return { records: financial.mergeTransactionCopies(transactions, [], deleted, [], metadata, {}),
      goals: financial.mergeGoalCopies(goals, [], deletedGoals, [], metadata, {}) };
  };
  h.seed = async () => {
    const k = h.storage.STORAGE_KEYS;
    for (const [key, value] of [[k.transactions, initialRows], [k.deletedTransactionIds, []], [k.goals, initialGoals], [k.deletedGoalIds, []], [k.cloudSyncMeta, { profile: 5 }], [k.cajasDinero, emptyBoxes]]) {
      assert.equal(await h.storage.saveJSONNow(key, value), true);
    }
  };
  return h;
}

if (process.argv[2] === "--crash-worker") {
  const h = harness(process.argv[3]); h.crash = process.argv[4];
  await h.ctx.deleteTransaction(row.id); await h.storage.flushPendingSaves(); process.exit(0);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fino-delete-batch-"));
try {
  // Este caso también ejecuta el manejador anterior: allí se borra de memoria
  // y anuncia éxito aunque el disco rechace el guardado. No depende de API nueva.
  for (const kind of ["transaction", "goal"]) {
    const h = harness(); await h.seed(); const before = h.db.prepare("SELECT * FROM store ORDER BY key").all(); h.failure = "rollback";
    await h.ctx[kind === "goal" ? "deleteGoal" : "deleteTransaction"](kind === "goal" ? goal.id : row.id);
    await h.storage.flushPendingSaves();
    assert.equal((kind === "goal" ? h.ctx.goalsLive : h.ctx.transactionsLive).current.length, 1,
      `${kind}: no desaparece en pantalla si el disco rechaza el borrado`);
    assert.deepEqual(h.db.prepare("SELECT * FROM store ORDER BY key").all(), before);
    assert.equal(h.toasts.includes(kind === "goal" ? "toast.goalDeleted" : "toast.transactionDeleted"), false);
    assert.equal(h.ctx.pendingTransactionDeletes.current.size, 0); assert.equal(h.ctx.goalWriteReserved.current, false);
  }
  for (const kind of ["transaction", "goal"]) for (const failure of [null, "lost-ack"]) {
    const h = harness(); await h.seed(); h.failure = failure;
    assert.equal(await h.ctx[kind === "goal" ? "deleteGoal" : "deleteTransaction"](kind === "goal" ? goal.id : row.id), true);
    assert.equal(h.batches.length, 1, "un ACK perdido se comprueba leyendo, no repitiendo la escritura");
    const k = h.storage.STORAGE_KEYS;
    assert.deepEqual(Array.from(h.batches[0]), kind === "goal" ? [k.goals, k.deletedGoalIds, k.cloudSyncMeta] : [k.transactions, k.deletedTransactionIds, k.cloudSyncMeta]);
    await h.storage.flushPendingSaves();
    const restored = await h.restartLists(), list = kind === "goal" ? restored.goals : restored.records;
    assert.deepEqual(Array.from(list.deletedIds), [kind === "goal" ? goal.id : row.id]);
    assert.equal((kind === "goal" ? list.goals : list.transactions).length, 0);
    assert.equal(financial.mutationInfo(list.metadata, kind).get(kind === "goal" ? goal.id : row.id).deleted, true);
    assert.equal(list.metadata.profile, 5, "se conserva metadata ajena al borrado");
  }
  {
    const h = harness(); await h.seed(); await h.ctx.deleteTransaction(row.id);
    assert.equal(await h.ctx.repairLinkedTransferTransactions([row]), true);
    await h.storage.flushPendingSaves(); const restored = (await h.restartLists()).records;
    assert.equal(restored.transactions.length, 1); assert.ok(restored.transactions[0].restorationId);
    assert.deepEqual(Array.from(restored.deletedIds), []);
    const stale = financial.rememberTransactionDeletion({}, [row]);
    assert.equal(financial.mergeTransactionCopies(restored.transactions, [], [], [row.id], restored.metadata, stale).transactions.length, 1,
      "reiniciar y recibir el borrado de una generación vieja no vuelve a ocultar lo recuperado");
  }
  for (const kind of ["transaction", "goal"]) {
    const h = harness(); await h.seed(); h.encryptGate = deferred();
    const promise = h.ctx[kind === "goal" ? "deleteGoal" : "deleteTransaction"](kind === "goal" ? goal.id : row.id);
    await tick(); h.uid = "b"; h.ctx.localSessionVersion.current++;
    h.storage.setAccountStorageAvailable(false); h.storage.setAccountStorageAvailable(true);
    h.uid = "a"; h.ctx.localSessionVersion.current++; h.encryptGate.resolve();
    assert.equal(await promise, false, "A → B → A no habilita un borrado de la sesión anterior");
    assert.equal(h.batches.length, 0);
    assert.equal((kind === "goal" ? h.ctx.goalsLive : h.ctx.transactionsLive).current.length, 1);
  }
  for (const kind of ["transaction", "goal"]) {
    const h = harness(); await h.seed(); h.gate = deferred();
    const promise = h.ctx[kind === "goal" ? "deleteGoal" : "deleteTransaction"](kind === "goal" ? goal.id : row.id);
    await tick(); assert.equal(h.batches.length, 1);
    h.ctx.cloudSyncMetaRef.current = { ...h.ctx.cloudSyncMetaRef.current, profile: 10 };
    h.storage.saveJSON(h.storage.STORAGE_KEYS.cloudSyncMeta, h.ctx.cloudSyncMetaRef.current);
    h.gate.resolve(); assert.equal(await promise, true); await h.storage.flushPendingSaves();
    const metadata = await h.storage.loadJSON(h.storage.STORAGE_KEYS.cloudSyncMeta, {});
    assert.equal(metadata.profile, 10, "el ACK no cancela una edición de perfil llegada durante SQLite");
    assert.equal(financial.mutationInfo(metadata, kind).get(kind === "goal" ? goal.id : row.id).deleted, true,
      "la metadata nueva conserva también la prueba de borrado del lote");
  }
  {
    const h = harness(); await h.seed(); h.gate = deferred();
    const promise = h.ctx.deleteTransaction(row.id); await tick();
    assert.equal(h.batches.length, 1); assert.equal(h.ctx.transactionsLive.current.length, 1, "no publica antes del COMMIT y la comprobación");
    assert.throws(() => h.ctx.setTransactions([]), /private-box-source-changed/, "la reserva no deja pisar el lote en mitad del guardado");
    h.gate.resolve(); assert.equal(await promise, true);
    assert.doesNotThrow(() => reservation.assertPrivateBoxMoneyLocalIdle());
  }
  {
    const fundedGoal = { ...goal, saved: 50 }, h = harness(":memory:", [row], [fundedGoal]);
    await h.seed(); h.gate = deferred();
    const promise = h.ctx.deleteGoal(goal.id); await tick();
    assert.equal(h.ctx.goalWriteReserved.current, true);
    const beforeToasts = h.toasts.length;
    assert.doesNotThrow(() => h.ctx.withdrawMoneyFromGoal(goal.id, 10),
      "un retiro tocado durante el borrado confirmado se ignora sin lanzar una excepción de pantalla");
    assert.equal(h.ctx.goalsLive.current[0].saved, 50, "no retira ahorros dentro de una reserva de borrado");
    assert.equal(h.toasts.length, beforeToasts, "no anuncia un retiro que no se guardó");
    h.gate.resolve(); assert.equal(await promise, true); assert.equal(h.ctx.goalWriteReserved.current, false);
  }
  {
    const h = harness(); await h.seed(); h.failure = "unconfirmed";
    assert.equal(await h.ctx.deleteTransaction(row.id), false);
    assert.equal(h.storage.hasUnreadableLocalData(), true, "una comprobación imposible conserva disco y bloquea cambios posteriores");
    assert.equal(h.ctx.transactionsLive.current.length, 1);
    assert.equal(await h.ctx.deleteTransaction(row.id), false); assert.equal(h.batches.length, 1);
  }
  for (const crash of ["between", "after"]) {
    const file = path.join(temp, `${crash}.sqlite`), h = harness(file); await h.seed(); h.db.close();
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--crash-worker", file, crash], { encoding: "utf8" });
    assert.equal(result.status, crash === "between" ? 20 : 21, result.stderr);
    const restarted = harness(file), lists = (await restarted.restartLists()).records;
    assert.equal(lists.transactions.length, crash === "between" ? 1 : 0, "un cierre entre escrituras conserva el lote completo anterior; tras COMMIT conserva el nuevo");
    assert.deepEqual(Array.from(lists.deletedIds), crash === "between" ? [] : [row.id]);
    assert.equal(financial.mutationInfo(lists.metadata, "transaction").has(row.id), crash === "after");
  }
  console.log("Borrado original con SQLite: listas/marcas/journal juntos, disco lleno, ACK perdido, reinicio, sesión A→B→A y reserva comprobados. No equivale a Android físico.");
} finally {
  for (const db of databases) { try { db.close(); } catch {} }
  // El directorio temporal de esta prueba se conserva para diagnóstico; no
  // se borra ninguna carpeta del usuario ni contenido de la app.
}

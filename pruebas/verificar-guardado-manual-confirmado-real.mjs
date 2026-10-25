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

// Guardados manuales/importados originales, con SQLite real y datos ficticios.
// El puente Android y React se adaptan; no usa la cuenta ni la app habitual.
const baseline = process.env.FINO_TEST_BASELINE;
const savingsDeleteBaseline = process.env.FINO_SAVINGS_DELETE_BASELINE;
if (savingsDeleteBaseline && !/^[a-f0-9]{7,40}$/.test(savingsDeleteBaseline)) throw new Error("Hash de borrado inválido.");
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
  const contents = savingsDeleteBaseline && name === "commitTransactionMutation"
    ? execFileSync("git", ["show", `${savingsDeleteBaseline}:${file}`], { encoding: "utf8" }) : read(file);
  const tree = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found = "";
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
const savings = baseline ? {} : load("utils/savingsActions.ts", name => name.endsWith("recordOrigin") || name.endsWith("goalFunding") ? financial : undefined);
const history = baseline ? {} : load("utils/personalHistory.ts", name => name.endsWith("recordOrigin") ? financial : undefined);
const balances = load("utils/finances.ts");
const summary = load("utils/savingsSummary.ts");
const imports = load("utils/importCommit.ts", name => name.endsWith("recordOrigin") || name.endsWith("goalFunding") ? financial : undefined);
const amounts = load("utils/amount.ts");
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
  let savingsSequence = 1000;
  const ctx = { ...financial, ...merges, ...reservation, ...h.storage, ...task, ...savings, ...history, ...balances, ...imports, ...amounts, ready: true, hasOnboarded: true, isPremium: true,
    budgets: { "2026-10": 500 }, carryoverCleared: [], cloudFieldsRef: { current: null }, fechaLocalISO: () => "2026-10-16", horaDe: () => "10:00 a.m.", nextId: () => ++savingsSequence,
    auth, Platform: { OS: "android" }, localSessionVersion: { current: 1 },
    transactionsLive: { current: plain(initialRows) }, goalsLive: { current: plain(initialGoals) },
    deletedTransactionIdsRef: { current: [] }, deletedGoalIdsRef: { current: [] }, cloudSyncMetaRef: { current: { profile: 5 } },
    goalWriteReserved: { current: false }, goalWritePublishing: { current: false }, pendingTransactionDeletes: { current: new Set() },
    currencyForReturn: { current: "PEN" }, returnReceipt: { current: null }, randomUUID, issuedCreationId: id => id > 1000 ? `issued-${id}` : undefined,
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
  const names = ["commitTransactionMutation", "addOrUpdateTransaction", "commitImport"];

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

const added = { ...row, id: 2000, creationId: "new-fake", amount: 25 };
try {
  {
    const h = harness(); await h.seed(); h.gate = deferred();
    const result = h.ctx.addOrUpdateTransaction(added);
    await tick();
    assert.equal(h.ctx.transactionsLive.current.length, 1, "el alta no aparece antes de confirmar su guardado");
    assert.deepEqual(h.toasts, [], "no decir Guardado antes de SQLite");
    h.gate.resolve(); assert.equal(await result, true);
    assert.equal(h.ctx.transactionsLive.current.length, 2);
    assert.equal((await h.restartLists()).records.transactions.length, 2, "reiniciar conserva el alta");
  }
  for (const failure of ["rollback", "lost-ack"]) {
    const h = harness(); await h.seed(); h.failure = failure;
    const saved = await h.ctx.addOrUpdateTransaction(added);
    assert.equal(saved, failure === "lost-ack");
    assert.equal(h.ctx.transactionsLive.current.length, saved ? 2 : 1);
    assert.equal((await h.restartLists()).records.transactions.length, saved ? 2 : 1);
    assert.equal(h.toasts.includes("toast.transactionSaved"), saved);
    if (!saved) {
      h.failure = null;
      assert.equal(await h.ctx.addOrUpdateTransaction(added), true);
      assert.equal(h.ctx.transactionsLive.current.filter(tx => tx.id === added.id).length, 1, "reintentar guarda una sola fila");
    }
  }
  for (const failure of [null, "rollback", "lost-ack"]) {
    const h = harness(); await h.seed(); h.failure = failure;
    const replacement = { ...row, amount: 80 };
    const rows = [added, { ...added, id: 2001, creationId: "second-fake", amount: 15 }];
    if (failure === "rollback") await assert.rejects(async () => h.ctx.commitImport(rows, [replacement]), /local-save-failed/);
    else assert.equal(await h.ctx.commitImport(rows, [replacement]), 3);
    const restored = (await h.restartLists()).records.transactions;
    assert.equal(restored.length, failure === "rollback" ? 1 : 3);
    assert.equal(restored.find(tx => tx.id === row.id).amount, failure === "rollback" ? 100 : 80);
  }
  {
    const h = harness(); await h.seed(); h.failure = "rollback";
    const rows = [added, { ...added, id: 2002, creationId: "voice-second", amount: 5 }];
    assert.equal(await h.ctx.addOrUpdateTransaction(rows), false);
    assert.equal(h.ctx.transactionsLive.current.length, 1);
    h.failure = null; assert.equal(await h.ctx.addOrUpdateTransaction(rows), true);
    assert.equal(h.ctx.transactionsLive.current.length, 3);
    assert.equal(h.batches.length, 2, "un lote por intento, sin altas a medias");
  }
  {
    const h = harness(); await h.seed(); h.encryptGate = deferred();
    const saving = h.ctx.addOrUpdateTransaction({ ...row, amount: 90 }, false, true);
    await tick();
    h.ctx.transactionsLive.current = [];
    h.ctx.deletedTransactionIdsRef.current = [row.id];
    h.encryptGate.resolve(); assert.equal(await saving, false);
    assert.equal(h.ctx.transactionsLive.current.length, 0, "la edición en espera no revive un movimiento borrado");
  }
  {
    const h = harness(); await h.seed(); h.encryptGate = deferred();
    const saving = h.ctx.addOrUpdateTransaction({ ...row, amount: 90 }, false, true);
    await tick();
    h.ctx.transactionsLive.current = [{ ...row, amount: 70, updatedAt: 2 }];
    h.encryptGate.resolve(); assert.equal(await saving, false);
    assert.equal(h.ctx.transactionsLive.current[0].amount, 70, "el formulario atrasado no pisa una edición más reciente");
  }
  {
    const h = harness(); await h.seed(); h.encryptGate = deferred();
    const saving = h.ctx.addOrUpdateTransaction(added); await tick();
    h.ctx.localSessionVersion.current++; h.uid = "b";
    h.encryptGate.resolve(); assert.equal(await saving, false);
    assert.equal(h.ctx.transactionsLive.current.length, 1);
    assert.deepEqual(h.toasts, [], "la nueva sesión no recibe avisos del guardado anterior");
  }
  console.log("Guardados manuales e importados: confirmación real, fallo sin éxito falso, reintento único, lotes indivisibles y sesión/borrado concurrentes comprobados con SQLite.");
} finally { for (const db of databases) db.close(); }

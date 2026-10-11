import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), module = { exports: {} };
const compiled = buildSync({ stdin: { contents: 'export * from "./utils/recordMerge"; export * from "./utils/recordOrigin";',
  sourcefile: "original-record-cycle.ts", resolveDir: process.cwd(), loader: "ts" },
  alias: { "@": process.cwd() }, bundle: true, write: false, platform: "node", format: "cjs" });
new Function("module", "exports", "require", compiled.outputFiles[0].text)(module, module.exports, require);
const api = module.exports;
const original = { id: 1, creationId: "original-A", type: "expense", amount: 100, category: "otros", date: "2026-10-10",
  method: "transfer", description: "Aporte", notes: "", internalTransfer: "box", internalTransferLink: "contribution-A", internalTransferSpaceId: "box-A" };
const source = JSON.stringify(original);
const deleted = api.rememberTransactionDeletion({}, [original]);
const afterDelete = api.mergeTransactionCopies([], [original], [1], [], deleted, {});
assert.deepEqual(afterDelete.transactions, []); assert.deepEqual(afterDelete.deletedIds, [1]);
assert.throws(() => api.mergeTransactionCopies([], [{ ...original, creationId: "independent-B" }], [1], [], deleted, {}), /record-origin-conflict/);
assert.throws(() => api.mergeTransactionCopies([], [original], [1], [], {}, deleted), /record-origin-conflict/, "no tomar prestada la prueba del otro dispositivo");
assert.throws(() => api.mergeTransactionCopies([], [original], [1], [], {}, {}), /record-origin-conflict/);
const restored = api.restoreKnownTransaction(deleted, { ...original, creationId: undefined }, "restore-1");
assert.equal(restored.record.creationId, original.creationId);
assert.equal(restored.record.restorationParent, "");
for (const [a, b, da, db, ma, mb] of [
  [[restored.record], [], [], [1], restored.metadata, deleted],
  [[], [restored.record], [1], [], deleted, restored.metadata],
  [[original], [restored.record], [], [], {}, restored.metadata],
]) {
  const result = api.mergeTransactionCopies(a, b, da, db, ma, mb);
  assert.equal(result.transactions[0].restorationId, "restore-1"); assert.deepEqual(result.deletedIds, []);
}
const repeatedOldDelete = api.rememberDeletion(deleted, "transaction", [original], api.recordOriginOf, 8_000_000_000_000);
assert.equal(api.mergeTransactionCopies([restored.record], [], [], [1], restored.metadata, repeatedOldDelete).transactions[0].restorationId, "restore-1",
  "un reloj muy adelantado en una generación antigua no borra la recuperación posterior");
const deletedAgain = api.rememberTransactionDeletion(restored.metadata, [restored.record]);
assert.deepEqual(api.mergeTransactionCopies([], [restored.record], [1], [], deletedAgain, restored.metadata).transactions, []);
const restoredAgain = api.restoreKnownTransaction(deletedAgain, restored.record, "restore-2");
assert.equal(restoredAgain.record.restorationParent, "restore-1");
assert.equal(api.mergeTransactionCopies([restoredAgain.record], [restored.record], [], [1], restoredAgain.metadata, deletedAgain).transactions[0].restorationId, "restore-2");
const fork = api.restoreKnownTransaction(deleted, original, "other-restore");
assert.throws(() => api.mergeTransactionCopies([restored.record], [fork.record], [], [], restored.metadata, fork.metadata), /record-origin-conflict/);
assert.throws(() => api.mergeTransactionCopies([restored.record], [], [], [], {}, {}), /record-origin-conflict/);
assert.throws(() => api.mergeTransactionCopies([], [original], [], [], restored.metadata, {}), /record-origin-conflict/, "no sustituir una recuperación sin datos por su original viejo");
assert.throws(() => api.restoreKnownTransaction(deleted, { ...original, internalTransferSpaceId: "other-box" }, "bad"), /record-origin-conflict/);
const unknown = { ["record-future:transaction:test"]: 1 };
assert.throws(() => api.mergeTransactionCopies([], [], [], [], unknown, {}), /record-origin-conflict/);
const goal = { id: 7, creationId: "goal-A", name: "Viaje", target: 100, saved: 10, createdDate: "2026-10-10", completed: false };
const goalDeleted = api.rememberDeletion({}, "goal", [goal], api.recordOriginOf, 100);
assert.deepEqual(api.mergeGoalCopies([], [goal], [7], [], goalDeleted, {}).goals, []);
assert.throws(() => api.mergeGoalCopies([], [{ ...goal, creationId: "goal-B" }], [7], [], goalDeleted, {}), /record-origin-conflict/);
assert.equal(JSON.stringify(original), source);
assert.equal(JSON.stringify(deleted).includes("contribution-A"), false, "la marca guarda una huella, no descripción o referencia en claro");
assert.equal(JSON.stringify(deleted).includes("Aporte"), false);
console.log("Originales: borrado/recuperación/nuevo borrado/segunda recuperación, copias atrasadas y relojes adelantados; orígenes/forks/datos ausentes rechazados. No Android ni datos reales.");

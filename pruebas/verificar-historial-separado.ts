import assert from "node:assert/strict";
import fs from "node:fs";
import type { Transaction } from "@/types";
import {
  assertLegacyHistoryFormat,
  historyBatches,
  historyDocumentId,
  mergeHistoryEntries,
  missingFromShadow,
  stageHistoryShadow,
  stageLegacyHistory,
} from "@/utils/cloudHistoryMigration";
import { firebaseErrorMessage } from "@/utils/firebaseErrors";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";

assert.doesNotThrow(() => assertLegacyHistoryFormat(null));
assert.doesNotThrow(() => assertLegacyHistoryFormat({}));
assert.doesNotThrow(() => assertLegacyHistoryFormat({ historyFormat: 1 }));
assert.throws(() => assertLegacyHistoryFormat({ historyFormat: 2 }), /historial-formato-no-compatible/);
assert.throws(() => assertLegacyHistoryFormat({ historyFormat: "desconocido" }), /historial-formato-no-compatible/);
let incompatible: unknown;
try { assertLegacyHistoryFormat({ historyFormat: 2 }); } catch (error) { incompatible = error; }
assert.equal((incompatible as { code?: string })?.code, "cloud/history-format-unsupported");
assert.match(firebaseErrorMessage("cloud/history-format-unsupported"), /actualiz/i);
assert.match(googleSignInErrorMessage(incompatible), /actualiz/i);
const cloudSync = fs.readFileSync("utils/cloudSync.ts", "utf8");
assert.ok((cloudSync.match(/assertLegacyHistoryFormat\(/g) ?? []).length >= 2,
  "la lectura y la escritura deben rechazar un formato futuro");
assert.match(cloudSync, /error instanceof UnsupportedHistoryFormatError\) throw error/,
  "el lector debe conservar el motivo específico hasta la pantalla de acceso");
assert.match(fs.readFileSync("screens/VerifyEmail.tsx", "utf8"),
  /firebaseErrorMessage\(code\)/,
  "la verificación de correo debe explicar cuándo hace falta actualizar");
const rules = fs.readFileSync("firestore.rules", "utf8");
assert.match(rules, /resource\.data\.get\('historyFormat', 1\) == 1/,
  "las reglas deben bloquear a una app vieja tras el corte");

const movement = (id: number, updatedAt = id): Transaction => ({
  id,
  updatedAt,
  type: "expense",
  amount: 10,
  category: "otros",
  date: "2026-09-27",
  method: "cash",
  description: `Movimiento ${id}`,
  notes: "",
});

const legacy = Array.from({ length: 10_000 }, (_, index) => movement(index + 1));
const staged = stageLegacyHistory(legacy, [5, 9_999, 10_001]);
assert.equal(staged.length, 10_001, "los borrados antiguos también viajan");
assert.deepEqual(staged.find((entry) => entry.id === 5), { id: 5, deleted: true });
assert.equal(staged.find((entry) => entry.id === 10_001)?.deleted, true);
assert.equal(historyDocumentId(legacy[0].id), "1");
assert.throws(() => historyDocumentId(Number.MAX_SAFE_INTEGER + 1));

const batches = historyBatches(staged);
assert.deepEqual(batches.flat(), staged, "ningún movimiento desaparece al preparar los lotes");
assert.ok(batches.every((batch) => batch.length > 0 && batch.length <= 200));
assert.deepEqual(missingFromShadow(staged, staged), []);
assert.deepEqual(missingFromShadow(staged, staged.filter((entry) => entry.id !== 9_999)), [9_999]);

const original = stageLegacyHistory([movement(1, 10)], []);
const edited = stageLegacyHistory([{ ...movement(1, 20), amount: 50 }], []);
assert.equal(mergeHistoryEntries(original, edited)[0].transaction?.amount, 50);
assert.equal(mergeHistoryEntries(edited, original)[0].transaction?.amount, 50);
assert.throws(
  () => mergeHistoryEntries(edited, stageLegacyHistory([{ ...movement(1, 20), amount: 20 }], [])),
  /historial-edicion-en-conflicto/,
  "dos ediciones distintas con el mismo momento no se eligen al azar",
);
assert.equal(mergeHistoryEntries(edited, [{ id: 1, deleted: true }])[0].deleted, true);
assert.equal(mergeHistoryEntries([{ id: 1, deleted: true }], edited)[0].deleted, true);
assert.deepEqual(missingFromShadow(edited, original), [1], "una edición vieja no confirma la migración");
assert.deepEqual(
  missingFromShadow(edited, stageLegacyHistory([{ ...movement(1, 20), amount: 20 }], [])),
  [1],
  "una edición distinta con la misma hora tampoco confirma la migración",
);
assert.deepEqual(missingFromShadow(edited, [{ id: 1, deleted: true }]), [], "una eliminación nueva no resucita");
assert.throws(() => historyBatches(stageLegacyHistory([{ ...movement(2), notes: "x".repeat(900_000) }], [])));

const root = { revision: "1", transactions: legacy.slice(0, 425), deletedIds: [5] };
let shadow = [] as ReturnType<typeof stageLegacyHistory>;
let writes = 0;
let interrupt = true;
const store = {
  readLegacy: async () => ({ ...root, transactions: [...root.transactions], deletedIds: [...root.deletedIds] }),
  readShadow: async () => [...shadow],
  mergeBatch: async (batch: ReturnType<typeof stageLegacyHistory>) => {
    writes++;
    if (interrupt && writes === 2) throw new Error("sin-internet");
    shadow = mergeHistoryEntries(shadow, batch);
  },
};
await assert.rejects(stageHistoryShadow(store), /sin-internet/);
assert.equal(root.transactions.length, 425, "un corte nunca borra el formato antiguo");
interrupt = false;
assert.deepEqual(await stageHistoryShadow(store), { ready: true, revision: "1", missing: [] });
assert.deepEqual(missingFromShadow(stageLegacyHistory(root.transactions, root.deletedIds), shadow), []);

root.transactions.push(movement(426));
root.revision = "2";
let changeDuringCopy = true;
const concurrentStore = {
  ...store,
  mergeBatch: async (batch: ReturnType<typeof stageLegacyHistory>) => {
    shadow = mergeHistoryEntries(shadow, batch);
    if (changeDuringCopy) {
      changeDuringCopy = false;
      root.transactions.push(movement(427));
      root.revision = "3";
    }
  },
};
assert.deepEqual(await stageHistoryShadow(concurrentStore), { ready: false, reason: "legacy-changed" });
assert.deepEqual(await stageHistoryShadow(concurrentStore), { ready: true, revision: "3", missing: [] });
const incomplete = await stageHistoryShadow({
  readLegacy: async () => ({ revision: "4", transactions: [movement(500)], deletedIds: [] }),
  readShadow: async () => [],
  mergeBatch: async () => undefined,
});
assert.deepEqual(incomplete, { ready: false, reason: "shadow-incomplete", missing: [500] });

console.log("Historial separado: 10.000 movimientos, borrados, ediciones y lotes sin pérdidas");

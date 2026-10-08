import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const require = createRequire(import.meta.url);
const load = file => {
  const stub = name => path.join(process.cwd(), "pruebas/stubs", name);
  const build = buildSync({ entryPoints: [file], bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: { "react-native": stub("rn.ts"), "lucide-react-native": stub("lucide.ts"), "expo-font": stub("font.ts"), "@expo/vector-icons": stub("vectoricons.ts") },
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", build.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
};
const original = { id: 1, type: "expense", amount: 100, category: "comida", date: "2026-10-07", method: "cash", description: "Cena", notes: "propia", updatedAt: 10 };
const transactionsLive = { current: [{ ...original }] };
const deletion = { current: [] };
let applyImportedTransactions;
try { ({ applyImportedTransactions } = load("utils/importCommit.ts")); } catch { /* Antes del arreglo no existe; probar también el manejador antiguo. */ }
const commit = handlerOriginal("contexts/AppDataContext.tsx", "commitImport", {
  applyImportedTransactions, transactionsLive, deletedTransactionIdsRef: deletion,
  // Este caso usa IDs heredados construidos antes del alta; el generador
  // y sus identidades reales se comprueban en verificar-identidad-creacion-real.
  issuedCreationId: () => undefined,
  assertPrivateBoxMoneyLocalIdle() {},
  setTransactions(update) { transactionsLive.current = typeof update === "function" ? update(transactionsLive.current) : update; },
  showToast() {}, t: key => key,
});
const edited = { ...original, amount: 120 };
commit([], [edited]);
assert.ok(transactionsLive.current[0].updatedAt > original.updatedAt, "La importación real debe marcar su edición");
const { mergeTransactions } = load("utils/mergeTransactions.ts");
assert.equal(mergeTransactions([original], transactionsLive.current)[0].amount, 120, "Teléfono atrasado no revierte el importe");
const fresh = { ...original, id: 2 };
commit([fresh, fresh], []);
commit([fresh], []);
assert.equal(transactionsLive.current.filter(tx => tx.id === 2).length, 1, "Lote repetido no duplica IDs");
const before = structuredClone(transactionsLive.current);
assert.throws(() => commit([{ ...fresh, id: 3 }], [edited]), /import-source-changed/);
assert.deepEqual(transactionsLive.current, before, "Conflicto no guarda la mitad del lote");
deletion.current = [4];
commit([{ ...fresh, id: 4 }], []);
assert.ok(!transactionsLive.current.some(tx => tx.id === 4), "No revive ID borrado");
assert.throws(() => commit([], [{ ...fresh, id: 99 }]), /import-source-changed/);
const { scoreMatch } = load("utils/duplicates.ts");
const transfer = { ...original, internalTransfer: "family" };
assert.equal(scoreMatch(transfer, { type: "expense", amount: 100, date: original.date, description: "Cena" }).level, "new", "No fusionar gastos bancarios con aportes enlazados");
console.log("Importación: manejador real marca edición, conserva cambios entre clientes, evita IDs repetidos y rechaza conflictos sin guardar un lote parcial.");

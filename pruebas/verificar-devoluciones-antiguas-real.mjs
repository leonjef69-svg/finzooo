import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
const result = await build({ stdin: { contents: 'export * from "./utils/personalHistory.ts"; export * from "./utils/finances.ts"; export * from "./utils/recordMerge.ts";', resolveDir: process.cwd() },
  bundle: true, write: false, format: "cjs", platform: "node", alias: { "@": process.cwd() },
  plugins: read.revision ? [{ name: "revision-original", setup(builder) { builder.onLoad({ filter: /\.ts$/ }, args => ({ contents: read(args.path.slice(process.cwd().length + 1).replaceAll("\\", "/")), loader: "ts" })); } }] : [] });
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const api = module.exports;
const returned = { id: 42, type: "income", amount: 50, date: "2026-10-15", category: "otros", method: "transfer", description: "Devolución", notes: "",
  internalTransfer: "family", internalTransferSpaceId: "closed-family", internalTransferLink: "return-original", internalTransferSettled: true,
  internalTransferAllocations: [{ transactionId: 40, amount: 50 }] };
// La base conoce la función y falla por bloquear la devolución real, no por
// faltar una API nueva. No atribuir la prueba a Android o Firebase reales.
assert.equal(api.removablePersonalHistoryIds([returned], [40]).has(42), true, "una devolución cerrada con aporte ya eliminado permite borrado real explícito");
assert.equal(api.removableLegacyReturnIds([returned], [40]).has(42), true);
assert.equal(api.removableLegacyReturnIds([{ ...returned, internalTransfer: "box" }], [40]).has(42), true);
for (const row of [
  { ...returned, type: "expense" }, { ...returned, internalTransfer: "goal" }, { ...returned, internalTransferSettled: false },
  { ...returned, internalTransferSpaceId: "" }, { ...returned, internalTransferLink: "" },
  { ...returned, internalTransferAllocations: [] }, { ...returned, amount: 51 }, { ...returned, amount: NaN },
  { ...returned, internalTransferAllocations: [{ transactionId: 40, amount: 25 }, { transactionId: 40, amount: 25 }] },
  { ...returned, internalTransferAllocations: [{ transactionId: 40, amount: -50 }] },
  { ...returned, internalTransferAllocations: [{ transactionId: 40, amount: 25 }, { transactionId: 41, amount: 25 }] },
]) assert.equal(api.removableLegacyReturnIds([row], [40]).size, 0);
assert.equal(api.removableLegacyReturnIds([returned], []).size, 0, "no basta que falte el aporte; debe constar eliminado");
const original = { ...returned, id: 40, type: "expense", date: "2026-09-26", internalTransferLink: "contribution", internalTransferAllocations: undefined };
assert.equal(api.removableLegacyReturnIds([original, returned], [40]).size, 0, "un aporte aún guardado exige conservar el par y sus meses");
assert.throws(() => api.preparePersonalHistoryRemoval([returned], [returned.id]), /history-transfer-not-returned/, "no se disfraza el borrado real como ocultación");
const second = { ...returned, id: 44, amount: 12, internalTransferSpaceId: "other-family", internalTransferLink: "other-return", internalTransferAllocations: [{ transactionId: 43, amount: 12 }] };
const rows = [returned, second], before = JSON.stringify(rows), deleted = [40, 43];
assert.equal(api.disponiblePersonalEnFecha("2026-10-17", { "2026-10": 0 }, rows, ["2026-10"]), 62, "devoluciones no son ingresos pero sí vuelven a disponible");
const removed = api.prepareTransactionMutation(rows, deleted, {}, [], [42, 44], () => "new-operation", () => undefined);
assert.equal(removed.transactions.length, 0); assert.deepEqual(new Set(removed.deletedIds), new Set([40, 43, 42, 44]));
assert.equal(api.disponiblePersonalEnFecha("2026-10-17", { "2026-10": 0 }, removed.transactions, ["2026-10"]), 0);
const merged = api.mergeTransactionCopies(removed.transactions, rows, removed.deletedIds, deleted, removed.metadata, {});
assert.equal(merged.transactions.length, 0, "una copia antigua no vuelve a poner las dos devoluciones borradas");
assert.equal(JSON.stringify(rows), before);
console.log("Devoluciones antiguas originales: cierre y aportes eliminados exigidos, rechazos seguros, borrado real 62→0 y copia atrasada protegida. No escribe en la cuenta del usuario.");

import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const read = createSourceReader({ revision: process.env.FINO_TEST_MOVEMENT_ORIGIN_BASELINE ?? "" });
const root = process.cwd();
const result = await build({ stdin: { contents: `
  export * from "@/utils/mergeTransactions";
  export * from "@/utils/cloudHistoryMigration";
  export * from "@/utils/importCommit";
  export * from "@/utils/cloudFieldMerge";
`, resolveDir: root, sourcefile: "movement-origin-test.ts", loader: "ts" },
  bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": root },
  plugins: [{ name: "original-revision", setup(builder) {
    builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
      const relative = path.relative(root, args.path).replaceAll("\\", "/");
      if (relative.startsWith("../") || relative.startsWith("node_modules/")) return;
      return { contents: read(relative), loader: relative.endsWith(".tsx") ? "tsx" : relative.endsWith(".ts") ? "ts" : "js" };
    });
  } }] });
const module = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
const api = module.exports;
const movement = (extra = {}) => ({ id: 100, updatedAt: 10, type: "expense", amount: 10,
  category: "servicios", date: "2026-10-08", method: "cash", description: "Original", notes: "", ...extra });
const first = movement({ captureId: "aviso-A" });
const second = movement({ captureId: "aviso-B", amount: 20, updatedAt: 20 });
const frozenA = JSON.stringify(first), frozenB = JSON.stringify(second);
const conflict = work => assert.throws(work, /record-origin-conflict/, "dos orígenes inequívocamente distintos no son ediciones del mismo movimiento");
for (const [a, b] of [[first, second], [second, first]]) {
  conflict(() => api.mergeTransactions([a], [b]));
  conflict(() => api.hayNovedades([a], [b]));
  conflict(() => api.mergeHistoryEntries([{ id: 100, deleted: false, transaction: a }], [{ id: 100, deleted: false, transaction: b }]));
  conflict(() => api.planLocalHistoryChanges([b], [], [{ id: 100, deleted: false, transaction: a }]));
  conflict(() => api.missingFromShadow([{ id: 100, deleted: false, transaction: a }], [{ id: 100, deleted: false, transaction: b }]));
  conflict(() => api.applyImportedTransactions([a], [b], [], [], 30));
  conflict(() => api.applyImportedTransactions([a], [], [{ ...b, updatedAt: 100 }], [], 101));
}
conflict(() => api.mergeTransactions([first, second], []));
conflict(() => api.mergeTransactions([], [first, second]));
conflict(() => api.hayNovedades([first], [movement({ id: 101 }), second]));
conflict(() => api.hayNovedades([], [first, second]));
assert.equal(api.hayNovedades([first], [first]), false);
assert.equal(api.hayNovedades([first], [{ ...first, updatedAt: 30 }]), false);
assert.equal(api.hayNovedades([first], [movement({ id: 101 })]), true);
assert.equal(JSON.stringify(first), frozenA);
assert.equal(JSON.stringify(second), frozenB);
assert.equal(api.mergeTransactions([first], [{ ...second, id: 101 }]).length, 2);
const edited = { ...first, updatedAt: 30, amount: 15, description: "Editado" };
assert.equal(api.mergeTransactions([first], [edited])[0].amount, 15);
assert.equal(api.mergeHistoryEntries([{ id: 100, deleted: false, transaction: first }], [{ id: 100, deleted: false, transaction: edited }])[0].transaction.amount, 15);
assert.equal(api.applyImportedTransactions([first], [first], [], []).count, 0, "reintento del mismo original no lo duplica");
assert.equal(api.applyImportedTransactions([first], [], [edited], []).transactions[0].captureId, "aviso-A");
const linked = movement({ internalTransfer: "box", internalTransferLink: "aporte-A", internalTransferSpaceId: "caja-A" });
for (const other of [
  { ...linked, internalTransferLink: "aporte-B", updatedAt: 20 },
  { ...linked, internalTransferSpaceId: "caja-B", updatedAt: 20 },
  { ...linked, internalTransfer: "family", updatedAt: 20 },
]) conflict(() => api.mergeTransactions([linked], [other]));
assert.equal(api.mergeTransactions([linked], [{ ...linked, amount: 5, updatedAt: 20 }])[0].amount, 5,
  "una corrección del mismo aporte sigue permitida, sin renumerarlo");
// Compatibilidad explícita, NO protección probada: los manuales/metas antiguos
// carecen de identidad de creación y FINO-52 sigue abierto para ellos.
assert.equal(api.mergeTransactions([movement()], [movement({ updatedAt: 20, amount: 30 })])[0].amount, 30);
assert.equal(api.mergeHistoryEntries([{ id: 100, deleted: false, transaction: first }], [{ id: 100, deleted: true }])[0].deleted, true);

// Recepción y restauración originales: no aplicar ni perfil/presupuestos
// antes de descubrir que la unión financiera está en conflicto.
const contextFile = "contexts/AppDataContext.tsx", contextText = read(contextFile);
const tree = ts.createSourceFile(contextFile, contextText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let receive;
function findReceive(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "applyNewerCloudFields") receive = node.initializer.arguments[0];
  ts.forEachChild(node, findReceive);
}
findReceive(tree); assert.ok(receive);
const data = transaction => ({ hasOnboarded: true, userName: "Original", userPhoto: null,
  userCurrency: "PEN", userLanguage: "es", budgets: { "2026-10": 100 }, categoryBudgets: {},
  transactions: [transaction], goals: [], isPremium: true });
const local = data(first), incoming = { ...data(second), userName: "NO APLICAR", budgets: { "2026-10": 200 } };
const writes = [], notices = [];
const deps = { ...api, auth: { currentUser: { uid: "A" } },
  privateBoxCloudResponseCurrent: () => true, cloudFieldsRef: { current: local },
  transactionsLive: { current: [first] }, cloudSyncMetaRef: { current: {} },
  localSessionVersion: { current: 0 }, tRef: { current: key => key },
  loadCloudData: async () => incoming, CloudPremiumRequiredError: class extends Error {},
  setRespaldoFallo: reason => notices.push(reason),
  saveJSON: (...args) => writes.push(args), STORAGE_KEYS: { profile: "profile" },
  userEmail: "A@example.com", userCountry: "PE", getFavoritos: () => [],
};
for (const setter of ["setUserName", "setUserPhoto", "setUserCurrency", "setUserLanguage", "setBudgets", "setCategoryBudgets",
  "setPagosProgramados", "setMerchantLearned", "saveOverrides", "setCategoryOverridesState", "savePropias", "setCategoriasPropiasState",
  "setCarryoverCleared", "saveFavoritos", "setIconosFavoritosState", "setCloudSyncMeta"]) deps[setter] = (...args) => writes.push([setter, ...args]);
const apply = new Function(...Object.keys(deps), ts.transpileModule(`return ${receive.getText(tree)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText)(...Object.values(deps));
assert.equal(apply(incoming), false);
assert.deepEqual(writes, [], "no aplicar metadatos ni escribir antes del conflicto");
assert.equal(deps.cloudFieldsRef.current, local);
assert.deepEqual(notices, ["movimientos-en-conflicto"]);
const restore = handlerOriginal(contextFile, "hydrateFromCloud", deps, contextText);
await assert.rejects(restore("A"), /settings.backupMovementConflict/);
assert.deepEqual(writes, [], "restaurar una copia en conflicto también conserva originales");
const reason = handlerOriginal("utils/cloudSync.ts", "motivoLegible", {}, read("utils/cloudSync.ts"));
assert.equal(reason(new Error("record-origin-conflict")), "movimientos-en-conflicto");
// La recogida del disco usa el setter inmediato original (no el diferido
// de React). Verificamos que el conflicto detiene también registro/caja y
// devuelve ok=false para no confirmar un aviso sobre una copia incierta.
const diskWrites = [], active = { current: [first] };
const setterDeps = { transactionsLive: active,
  assertPrivateBoxMoneyLocalIdle: () => {}, assertPrivateBoxMoneyLocalMutation: () => {},
  setRenderedTransactions: next => diskWrites.push(["transactions", next]),
};
let setter;
function findSetter(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "setTransactions") setter = node.initializer.arguments[0];
  ts.forEachChild(node, findSetter);
}
findSetter(tree); assert.ok(setter);
const setTransactions = new Function(...Object.keys(setterDeps), ts.transpileModule(`return ${setter.getText(tree)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText)(...Object.values(setterDeps));
const diskDeps = { ...api, setTransactions, deletedTransactionIdsRef: { current: [] },
  STORAGE_KEYS: { transactions: "transactions", autoCaptureLog: "log", movimientosNegocio: "business" },
  loadJSON: async key => key === "transactions" ? [second] : [],
  setAutoCaptureLog: next => diskWrites.push(["log", next]),
  setDatosNegocio: next => diskWrites.push(["business", next]),
};
const collectDisk = handlerOriginal(contextFile, "recogerDelDisco", diskDeps, contextText);
assert.deepEqual(await collectDisk(), { caja: [], ok: false });
assert.deepEqual(diskWrites, []);
assert.equal(active.current[0], first, "el original en memoria no fue reemplazado");
console.log("Código original: colisiones de avisos/aportes se rechazan sin mutar originales; mismas referencias/editados/reintentos compatibles. Manuales/metas y Android pendientes.");

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const t = key => key;
const handler = (file, name, deps) => handlerOriginal(file, name, deps,
  process.env.FINO_TEST_REVISION ? execFileSync("git", ["show", `${process.env.FINO_TEST_REVISION}:${file}`], { encoding: "utf8" }) : undefined);

// Lote de importación: dos toques del mismo botón anterior al redibujo.
let imports = 0, importedTotal = 0, failed = 0;
const importLock = { current: false };
const importDependencies = {
  mounted: { current: true }, getAccountStorageSession: () => 1,
  candidates: [{ tx: { id: 1 }, match: null }], importLock,
  commitImport() { imports++; return 1; },
  setImportedTotal(value) { importedTotal = value; }, setReviewing() {}, setDone() {},
  setSaving() {},
  mergeTransaction() { throw Error("No se necesita para un movimiento nuevo"); },
  showToast() { failed++; }, t,
};
const apply = handler("screens/ImportSheet.tsx", "applyResolutions", importDependencies);
const importing = apply(new Map()); apply(new Map());
assert.equal(imports, 1, "Importar se ejecuta una sola vez");
await importing;
assert.equal(importedTotal, 1);
importLock.current = false;
let first = true;
const retry = handler("screens/ImportSheet.tsx", "applyResolutions", {
  ...importDependencies, commitImport() { if (first) { first = false; throw Error("fallo"); } imports++; return 1; },
});
await retry(new Map());
assert.equal(importLock.current, false, "Puede reintentar tras error");
await retry(new Map()); assert.equal(imports, 2); assert.equal(failed, 1);

// La misma decisión no salta dos candidatos ni finaliza dos veces.
const decidedIds = { current: new Set() }, resolutions = new Map();
let index = 0, finish = 0, learned = 0;
const review = (id, isLast) => handler("screens/DuplicateReview.tsx", "decide", {
  current: { tx: { id }, raw: { merchant: "Tienda" }, match: { existing: { category: "comida" } } },
  isLast, saving: false, decidedIds, resolutions, onLearn() { learned++; },
  onFinish() { finish++; }, setIndex(update) { index = update(index); },
});
const firstDecision = review(1, false);
firstDecision("merge"); firstDecision("keepBoth");
assert.equal(index, 1); assert.equal(learned, 1); assert.equal(resolutions.get(1), "merge");
const lastDecision = review(2, true);
lastDecision("skip"); lastDecision("skip"); assert.equal(finish, 1);

// Boleta: comprobar creación del movimiento desde el manejador original.
let saved = 0, closed = 0, ids = 0;
const saveLock = { current: false };
const scanDeps = {
  mounted: { current: true }, getAccountStorageSession: () => 1,
  saveLock, amountText: "50", userCurrency: "PEN", parseAmountInput: Number,
  date: "2026-10-07", normalizeDateInput: value => value, isValidISODate: () => true,
  kind: "expense", category: "comida", merchant: "Tienda", read: null,
  nextId() { return ++ids; }, catInfo: () => ({ label: "comida" }), t,
  addOrUpdateTransaction() { saved++; return true; }, onClose() { closed++; }, showToast() {},
};
const save = handler("screens/ScanReceipt.tsx", "save", scanDeps);
const scanning = save(); save(); await scanning; assert.equal(saved, 1); assert.equal(closed, 1); assert.equal(ids, 1);
saveLock.current = false;
const broken = handler("screens/ScanReceipt.tsx", "save", { ...scanDeps, addOrUpdateTransaction() { throw Error("fallo"); } });
await broken(); assert.equal(saveLock.current, false);
await save(); assert.equal(saved, 2);

// Apartar/retirar: el manejador conectado a ambos botones confirma una vez.
let confirmed = 0;
const confirmLock = { current: false };
const moveDeps = { valid: true, confirmLock, amt: 20, onConfirm() { confirmed++; }, setSaving() {}, setConfirming() {}, showToast() {}, t };
const confirm = handler("screens/MoveMoneySheet.tsx", "confirmMove", moveDeps);
const moving = confirm(); confirm(); assert.equal(confirmed, 1); await moving;
confirmLock.current = false;
const moveBroken = handler("screens/MoveMoneySheet.tsx", "confirmMove", { ...moveDeps, onConfirm() { throw Error("fallo"); } });
await moveBroken(); assert.equal(confirmLock.current, false); await confirm(); assert.equal(confirmed, 2);
confirmLock.current = false;
handler("screens/MoveMoneySheet.tsx", "confirmMove", { ...moveDeps, valid: false })();
assert.equal(confirmed, 2);
console.log("Manejadores originales: importar, revisar, guardar boleta y apartar/retirar ejecutan una vez; sus errores permiten reintentar. Android visual pendiente.");

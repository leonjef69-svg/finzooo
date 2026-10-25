import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_TEST_REVISION;
if (revision && !/^[a-f0-9]{7,40}$/.test(revision)) throw Error("Revisión inválida");
const handler = (file, name, dependencies) => handlerOriginal(file, name, dependencies,
  revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : undefined);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const t = key => key;

for (const [file, name] of [["app/transaction/new.tsx", "NewTransactionRoute"], ["app/transaction/[id]/edit.tsx", "EditTransactionRoute"]]) {
  for (const leave of [false, true]) {
    const gate = deferred(), cleanups = []; let navigated = 0;
    const transaction = { id: 1, type: "income", amount: 25, date: "2026-10-24" };
    const route = handler(file, name, {
      React: { createElement: (type, props) => ({ type, props }) }, AddSheet: Symbol("AddSheet"), MissingItem: Symbol("MissingItem"),
      useLocalSearchParams: () => ({ id: "1", type: "income" }), useRedirectIfOrphaned: () => false,
      useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: fn => cleanups.push(fn()),
      useAppData: () => ({ month: { y: 2026, m: 9 }, transactions: [transaction], goals: [], budgets: {}, carryoverCleared: [], addOrUpdateTransaction: () => gate.promise }),
      totalApartado: () => 0, disponiblePersonalEnFecha: () => 50, expenseSavingsNeeded: () => 0,
      safeBack() { navigated++; }, router: { dismissTo() { navigated++; } },
    });
    const form = route(), saving = form.props.onSave(transaction);
    assert.equal(navigated, 0, `${name} espera confirmación`);
    if (leave) cleanups.forEach(fn => fn?.());
    gate.resolve(true); assert.equal(await saving, true);
    assert.equal(navigated, leave ? 0 : 1, "la respuesta no cierra una pantalla distinta si el formulario ya salió");
  }
}

// Un botón pulsado dos veces mientras SQLite espera no cierra ni repite el envío.
{
  const saveLock = { current: false }, gate = deferred(); let calls = 0, closed = 0, id = 0;
  const dependencies = { saveLock, mounted: { current: true }, getAccountStorageSession: () => 1, amountText: "25", userCurrency: "PEN", parseAmountInput: Number,
    date: "2026-10-24", normalizeDateInput: value => value, isValidISODate: () => true,
    kind: "expense", category: "comida", merchant: "Prueba", read: null,
    nextId: () => ++id, catInfo: () => ({ label: "comida" }), t, showToast() {},
    addOrUpdateTransaction() { calls++; return gate.promise; }, onClose() { closed++; } };
  const save = handler("screens/ScanReceipt.tsx", "save", dependencies);
  const pending = save(); await save();
  assert.equal(calls, 1); assert.equal(closed, 0, "la boleta espera confirmación del guardado");
  gate.resolve(false); await pending;
  assert.equal(closed, 0); assert.equal(saveLock.current, false, "un fallo permite reintentar");
  await handler("screens/ScanReceipt.tsx", "save", { ...dependencies, addOrUpdateTransaction: async () => true })();
  assert.equal(closed, 1);
}
{
  const saveLock = { current: false }, gate = deferred(); let calls = 0, closed = 0, id = 100;
  const dependencies = { saveLock, mounted: { current: true }, getAccountStorageSession: () => 1, rows: [{ amount: 10, date: "2026-10-24" }, { amount: 20, date: "2026-10-24" }],
    kinds: ["expense", "income"], categoryOf: () => "otros", nextId: () => ++id,
    catInfo: () => ({ label: "otros" }), horaDe: () => "10:00", t, showToast() {}, onClose() { closed++; },
    addOrUpdateTransaction(batch) { calls++; assert.equal(batch.length, 2, "todo el dictado viaja en un lote"); return gate.promise; } };
  const save = handler("screens/VoiceEntry.tsx", "save", dependencies);
  const pending = save(); await save(); await tick();
  assert.equal(calls, 1); assert.equal(closed, 0);
  gate.resolve(false); await pending;
  assert.equal(closed, 0); assert.equal(saveLock.current, false);
}
{
  const importLock = { current: false }, gate = deferred(); let done = false, total = 0, busy = false;
  const apply = handler("screens/ImportSheet.tsx", "applyResolutions", { importLock, mounted: { current: true }, getAccountStorageSession: () => 1,
    candidates: [{ tx: { id: 1 }, match: null }], commitImport: () => gate.promise,
    setSaving(value) { busy = value; }, setImportedTotal(value) { total = value; }, setDone(value) { done = value; },
    setReviewing() {}, mergeTransaction() {}, showToast() {}, t });
  const pending = apply(new Map()); await tick();
  assert.equal(done, false); assert.equal(total, 0); assert.equal(busy, true);
  gate.resolve(1); assert.equal(await pending, true);
  assert.equal(done, true); assert.equal(total, 1); assert.equal(busy, false);
}
// Un cierre manual/atrás o una cuenta distinta no recibe la respuesta de la
// pantalla anterior: ni una segunda navegación ni avisos de otro propietario.
for (const file of ["screens/ScanReceipt.tsx", "screens/VoiceEntry.tsx"]) {
  for (const leave of ["unmount", "session"]) for (const outcome of [true, false, "reject"]) {
    const gate = deferred(), mounted = { current: true }; let session = 1, closed = 0, notices = 0;
    const deps = { mounted, getAccountStorageSession: () => session, saveLock: { current: false },
      amountText: "25", userCurrency: "PEN", parseAmountInput: Number,
      date: "2026-10-24", normalizeDateInput: value => value, isValidISODate: () => true,
      kind: "expense", category: "comida", merchant: "Prueba", read: null,
      rows: [{ amount: 10, date: "2026-10-24" }, { amount: 20, date: "2026-10-24" }],
      kinds: ["expense", "income"], categoryOf: () => "otros", nextId: () => 100,
      catInfo: () => ({ label: "otros" }), horaDe: () => "10:00", t, showToast() { notices++; },
      addOrUpdateTransaction: () => gate.promise, onClose() { closed++; } };
    const pending = handler(file, "save", deps)();
    if (leave === "unmount") mounted.current = false; else session++;
    gate.resolve(outcome === "reject" ? Promise.reject(Error("synthetic-save-failed")) : outcome);
    await pending;
    assert.equal(closed, 0, `${file}/${leave}/${outcome}: la respuesta no vuelve a salir`);
    assert.equal(notices, 0, `${file}/${leave}/${outcome}: sin avisos tardíos en otra pantalla/cuenta`);
  }
}
for (const leave of ["unmount", "session"]) for (const outcome of [1, "reject"]) {
  const gate = deferred(), mounted = { current: true }; let session = 1, updates = 0, notices = 0;
  const apply = handler("screens/ImportSheet.tsx", "applyResolutions", {
    mounted, getAccountStorageSession: () => session, importLock: { current: false }, candidates: [{ tx: { id: 1 }, match: null }],
    commitImport: () => gate.promise, setSaving() { updates++; }, setImportedTotal() { updates++; },
    setDone() { updates++; }, setReviewing() { updates++; }, mergeTransaction() {}, showToast() { notices++; }, t,
  });
  const pending = apply(new Map()); assert.equal(updates, 1);
  if (leave === "unmount") mounted.current = false; else session++;
  gate.resolve(outcome === "reject" ? Promise.reject(Error("synthetic-import-failed")) : outcome);
  assert.equal(await pending, false); assert.equal(updates, 1, "la respuesta no modifica la revisión ya cerrada");
  assert.equal(notices, 0, "sin error de importación en otra pantalla/cuenta");
}
// Si falla el último paso de revisión, se conserva la decisión y permite reintento.
{
  const decidedIds = { current: new Set() }, resolutions = new Map(); let attempts = 0;
  const decide = handler("screens/DuplicateReview.tsx", "decide", { saving: false,
    current: { tx: { id: 1 }, raw: {}, match: { existing: {} } }, isLast: true, decidedIds, resolutions,
    onLearn() {}, setIndex() {}, onFinish: async () => ++attempts > 1 });
  await decide("skip"); assert.equal(decidedIds.current.has(1), false);
  await decide("skip"); assert.equal(attempts, 2); assert.equal(decidedIds.current.has(1), true);
}
console.log("Formularios originales: boleta/dictado/importación esperan confirmación; fallo conserva revisión y permite reintento sin doble envío. Android se comprueba aparte.");

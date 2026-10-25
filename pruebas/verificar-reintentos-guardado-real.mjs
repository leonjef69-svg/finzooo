import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Cola original, sin copiar la reparación. Android y el cifrado son IO
// sintético; cada caso empieza con una sesión y un disco independientes.
const read = createSourceReader({ revision: process.env.FINO_STORAGE_RETRY_BASELINE ?? "" });
const source = ts.transpile(read("utils/storage.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const KEY = "finzo:transactions", META = "finzo:cloudSyncMeta";
const PREFIX = "v2:synthetic:";
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function phone() {
  const h = { disk: new Map(), fail: new Set(), failRead: false, failBatch: false,
    writes: 0, batches: 0, gate: null, entered: null };
  const adapter = {
    getItem: async key => { if (h.failRead) throw Error("synthetic-read-failed"); return h.disk.get(key) ?? null; },
    setItem: async (key, value) => {
      h.writes++;
      if (h.gate) { const gate = h.gate; h.gate = null; h.entered?.resolve(); await gate.promise; }
      if (h.fail.has(key)) throw Error("synthetic-write-failed");
      h.disk.set(key, value);
    },
    multiGet: async keys => keys.map(key => [key, h.disk.get(key) ?? null]),
    multiSet: async entries => {
      h.batches++; if (h.failBatch) throw Error("synthetic-batch-failed");
      for (const [key, value] of entries) h.disk.set(key, value);
    },
    getAllKeys: async () => [...h.disk.keys()],
    multiRemove: async keys => { for (const key of keys) h.disk.delete(key); },
    removeItem: async key => { h.disk.delete(key); },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, Error, setTimeout, clearTimeout,
    require: name => name.includes("async-storage") ? { default: adapter } : {
      encryptText: async json => PREFIX + json,
      decryptText: async raw => raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : null,
    },
  });
  h.api = module.exports; h.api.setAccountStorageAvailable(true);
  h.stored = key => JSON.parse(h.disk.get(key)?.slice(PREFIX.length) ?? "null");
  h.batch = (rows, committed = () => {}) => h.api.saveJSONBatchNow([KEY, META], () => ({
    entries: [[KEY, rows], [META, { transactions: 100 }]], stillValid: () => true, committed,
  }));
  return h;
}
let passed = 0;
async function check(name, run) {
  const h = phone();
  try { await run(h); passed++; console.log(`OK ${name}`); }
  finally { h.api.discardPendingSaves(); }
}

await check("un guardado agrupado fallido se recupera sin volver a publicar el valor", async h => {
  const rows = [{ id: 1, amount: 7 }]; h.fail.add(KEY); h.api.saveJSON(KEY, rows);
  assert.equal(await h.api.flushPendingSavesChecked(), false); assert.equal(h.writes, 1);
  rows[0].amount = 99; h.fail.clear();
  assert.equal(await h.api.flushPendingSavesChecked(), true);
  assert.deepEqual(h.stored(KEY), [{ id: 1, amount: 7 }], "el reintento conserva lo que falló, sin mutaciones posteriores");
  assert.equal(h.writes, 2);
});
await check("el inmediato sigue devolviendo false y un intento posterior lo repara", async h => {
  h.fail.add(KEY); assert.equal(await h.api.saveJSONNow(KEY, [{ id: 2, amount: 8 }]), false);
  assert.equal(h.disk.has(KEY), false); h.fail.clear();
  assert.equal(await h.api.flushPendingSavesChecked(), true);
  assert.deepEqual(h.stored(KEY), [{ id: 2, amount: 8 }]);
});
await check("un pendiente más reciente sustituye al valor fallido antiguo", async h => {
  h.fail.add(KEY); await h.api.saveJSONNow(KEY, [{ id: 3, amount: 10 }]);
  h.fail.clear(); h.api.saveJSON(KEY, [{ id: 3, amount: 18 }]);
  assert.equal(await h.api.flushPendingSavesChecked(), true);
  assert.deepEqual(h.stored(KEY), [{ id: 3, amount: 18 }]); assert.equal(h.writes, 2);
});
await check("dos fallos sucesivos recuperan únicamente la intención más reciente", async h => {
  h.fail.add(KEY); await h.api.saveJSONNow(KEY, [{ id: 4, amount: 10 }]);
  await h.api.saveJSONNow(KEY, [{ id: 4, amount: 18 }]); h.fail.clear();
  assert.equal(await h.api.flushPendingSavesChecked(), true);
  assert.deepEqual(h.stored(KEY), [{ id: 4, amount: 18 }]); assert.equal(h.writes, 3);
});
await check("un lote confirmado invalida el reintento individual anterior", async h => {
  h.fail.add(KEY); await h.api.saveJSONNow(KEY, [{ id: 5, amount: 10 }]);
  h.fail.clear(); let committed = 0;
  assert.equal(await h.batch([], () => { committed++; }), true);
  assert.equal(await h.api.flushPendingSavesChecked(), true);
  assert.deepEqual(h.stored(KEY), []); assert.equal(h.writes, 1);
  assert.equal(h.batches, 1); assert.equal(committed, 1);
});
await check("un lote fallido jamás se repara por escrituras sueltas", async h => {
  h.failBatch = true; let committed = 0;
  assert.equal(await h.batch([{ id: 6, amount: 20 }], () => { committed++; }), false);
  assert.equal(await h.api.flushPendingSavesChecked(), false);
  assert.equal(h.writes, 0); assert.equal(h.batches, 1); assert.equal(committed, 0);
  h.failBatch = false;
  assert.equal(await h.batch([{ id: 6, amount: 20 }], () => { committed++; }), true);
  assert.equal(await h.api.flushPendingSavesChecked(), true); assert.equal(committed, 1);
  assert.deepEqual(h.stored(KEY), [{ id: 6, amount: 20 }]);
});
await check("cerrar y cambiar de cuenta descarta valores fallidos de la anterior", async h => {
  h.fail.add(KEY); await h.api.saveJSONNow(KEY, [{ id: 7, amount: 30 }]);
  h.api.setAccountStorageAvailable(false); h.api.setAccountStorageAvailable(true); h.fail.clear();
  assert.equal(await h.api.flushPendingSavesChecked(), true); assert.equal(h.disk.has(KEY), false);
  assert.equal(await h.api.saveJSONNow(KEY, [{ id: 8, amount: 40 }]), true);
  assert.deepEqual(h.stored(KEY), [{ id: 8, amount: 40 }]);
});
await check("un fallo tardío de la sesión anterior no deja un reintento en la nueva", async h => {
  h.fail.add(KEY); h.gate = deferred(); const gate = h.gate; h.entered = deferred();
  const saving = h.api.saveJSONNow(KEY, [{ id: 9, amount: 50 }]); await h.entered.promise;
  h.api.setAccountStorageAvailable(false); h.api.setAccountStorageAvailable(true);
  gate.resolve(); assert.equal(await saving, false); h.fail.clear();
  assert.equal(await h.api.flushPendingSavesChecked(), true); assert.equal(h.disk.has(KEY), false);
});
await check("borrar los datos espera al guardado fallido y elimina su reintento", async h => {
  h.fail.add(KEY); h.gate = deferred(); const gate = h.gate; h.entered = deferred();
  const saving = h.api.saveJSONNow(KEY, [{ id: 10, amount: 60 }]); await h.entered.promise;
  const clearing = h.api.clearAccountData(); gate.resolve();
  assert.equal(await saving, false); await clearing; h.fail.clear();
  assert.equal(await h.api.flushPendingSavesChecked(), true); assert.equal(h.disk.has(KEY), false);
});
await check("un dato ilegible sigue protegido aunque exista un reintento", async h => {
  h.fail.add(KEY); await h.api.saveJSONNow(KEY, [{ id: 11, amount: 70 }]);
  const damaged = "v2:synthetic:{broken-json"; h.disk.set(KEY, damaged); h.failRead = true;
  await h.api.loadJSON(KEY, []); h.failRead = false; h.fail.clear();
  assert.equal(h.api.hasUnreadableLocalData(), true);
  assert.equal(await h.api.flushPendingSavesChecked(), false);
  assert.equal(h.disk.get(KEY), damaged); assert.equal(h.writes, 1);
});
await check("un disco que sigue fallando hace un intento por llamada, sin bucles", async h => {
  h.fail.add(KEY); h.api.saveJSON(KEY, [{ id: 12, amount: 80 }]);
  for (let attempts = 1; attempts <= 3; attempts++) {
    assert.equal(await h.api.flushPendingSavesChecked(), false); assert.equal(h.writes, attempts);
  }
});
await check("un valor no serializable no hace reintentos de una intención vieja", async h => {
  h.fail.add(KEY); await h.api.saveJSONNow(KEY, [{ id: 13, amount: 90 }]);
  await h.api.saveJSONNow(KEY, { invalid: 1n }); h.fail.clear();
  assert.equal(await h.api.flushPendingSavesChecked(), false); assert.equal(h.writes, 1);
  assert.equal(await h.api.saveJSONNow(KEY, []), true);
  assert.equal(await h.api.flushPendingSavesChecked(), true); assert.deepEqual(h.stored(KEY), []);
});
console.log(`${passed} escenarios: cola original, recuperación individual y límites de sesión/lote/corrupción; ningún dato real`);

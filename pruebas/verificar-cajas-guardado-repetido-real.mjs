import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Ejecuta la cola original; solo Android y el cifrado se sustituyen para
// contar trabajo, provocar fallos y detener respuestas en puntos concretos.
const read = createSourceReader();
const compiled = ts.transpile(read("utils/storage.ts"), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const key = "finzo:cajasDinero";
const data = { cajas: [{ id: "a", nombre: "Casa" }], movimientos: [] };
const json = JSON.stringify(data);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const instances = [];
function harness(raw = `v2:seed:${json}`) {
  const disk = new Map(raw == null ? [] : [[key, raw]]);
  const h = { disk, encrypts: 0, writes: 0, batches: 0, failWrite: null, failRead: false, readGate: null, encryptGate: null };
  const adapter = {
    getItem: async name => {
      if (h.readGate) { const gate = h.readGate; h.readGate = null; await gate.promise; }
      if (h.failRead) throw Error("read-failed");
      return disk.get(name) ?? null;
    },
    setItem: async (name, value) => {
      h.writes++;
      if (h.failWrite === "before") throw Error("write-failed");
      disk.set(name, value);
      if (h.failWrite === "lost-ack") throw Error("ack-lost");
    },
    multiGet: async names => names.map(name => [name, disk.get(name) ?? null]),
    multiSet: async entries => { h.batches++; for (const [name, value] of entries) disk.set(name, value); },
    multiRemove: async names => { for (const name of names) disk.delete(name); },
    removeItem: async name => { disk.delete(name); },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, setTimeout, clearTimeout, Error,
    require: name => name.includes("async-storage") ? { default: adapter } : {
      encryptText: async value => { h.encrypts++; if (h.encryptGate) await h.encryptGate.promise; return `v2:${h.encrypts}:${value}`; },
      decryptText: async value => value.startsWith("v2:") ? value.slice(value.indexOf(":", 3) + 1) : value.startsWith("v1:") ? value.slice(3) : null,
    },
  });
  h.api = module.exports; h.api.setAccountStorageAvailable(true); instances.push(h);
  h.save = async value => { h.api.saveJSON(key, value); return h.api.flushPendingSavesChecked(); };
  return h;
}
try {
  {
    const h = harness(); const original = h.disk.get(key);
    const loaded = await h.api.loadJSON(key, null);
    assert.equal(await h.save(loaded), true);
    assert.equal(h.encrypts, 0, "volver a Cajas sin cambios no debe repetir el cifrado");
    assert.equal(h.writes, 0, "la copia v2 comprobada e idéntica no debe reescribirse");
    assert.equal(h.disk.get(key), original);
    await h.save({ ...data, movimientos: [{ id: "aporte", monto: 100 }] });
    assert.equal(h.encrypts, 1); assert.equal(h.writes, 1);
    await h.save({ ...data, movimientos: [{ id: "aporte", monto: 100 }] });
    assert.equal(h.writes, 1, "solo se recuerda un guardado que Android confirmó");
    const mutated = { ...data, movimientos: [] };
    h.api.saveJSON(key, mutated); mutated.movimientos.push({ id: "ultimo", monto: 20 });
    await h.api.flushPendingSaves();
    assert.ok(h.disk.get(key).includes('"ultimo"'), "se serializa el valor vigente, no una foto tomada al programarlo");
  }
  {
    const h = harness(); await h.save(data);
    assert.equal(h.writes, 1, "sin lectura autenticada ni confirmación previa, se guarda normalmente");
    assert.equal(await h.api.saveJSONNow(key, data), true);
    assert.equal(h.writes, 2, "el guardado inmediato de dinero nunca se omite");
    const before = h.encrypts; let committed = 0;
    assert.equal(await h.api.saveJSONBatchNow([key, "finzo:transactions"], () => ({
      entries: [[key, data], ["finzo:transactions", []]], stillValid: () => true, committed: () => { committed++; },
    })), true);
    assert.equal(h.encrypts, before + 2); assert.equal(h.batches, 1); assert.equal(committed, 1);
    await h.save(data); assert.equal(h.writes, 3, "el lote invalida la prueba anterior: no se salta su nueva comprobación");
  }
  for (const raw of [`v1:${json}`, json, null]) {
    const h = harness(raw); const loaded = await h.api.loadJSON(key, data);
    await h.save(loaded); assert.equal(h.writes, 1); assert.ok(h.disk.get(key).startsWith("v2:"));
  }
  for (const failure of ["before", "lost-ack"]) {
    const h = harness(); await h.api.loadJSON(key, null);
    h.failWrite = failure; const changed = { ...data, movimientos: [100] };
    assert.equal(await h.save(changed), false); assert.equal(h.writes, 1);
    // Ni siquiera una lectura posterior de los mismos bytes elimina el fallo.
    await h.api.loadJSON(key, null); h.failWrite = null;
    assert.equal(await h.save(changed), true); assert.equal(h.writes, 2);
  }
  for (const replacement of [`v2:other:${json}`, 'v2:other:{"movimientos":[200]}', null]) {
    const h = harness(); await h.api.loadJSON(key, null);
    if (replacement == null) h.disk.delete(key); else h.disk.set(key, replacement);
    await h.save(data); assert.equal(h.writes, 1, "los bytes actuales deben coincidir, no basta recordar el mismo saldo");
  }
  {
    const h = harness(); await h.api.loadJSON(key, null); h.failRead = true;
    assert.equal(await h.save(data), true); assert.equal(h.writes, 1, "si falla la lectura opcional se conserva el guardado original");
    assert.equal(h.api.hasUnreadableLocalData(), false);
    await h.api.loadJSON(key, null);
    assert.equal(h.api.hasUnreadableLocalData(), true, "un fallo al cargar datos reales sí conserva el bloqueo protector");
    await h.save({ changed: true }); assert.equal(h.writes, 1);
  }
  {
    const h = harness(); await h.api.loadJSON(key, null); const gate = deferred(); h.readGate = gate;
    const pending = h.save(data); await tick();
    h.api.setAccountStorageAvailable(false); h.api.setAccountStorageAvailable(true); gate.resolve();
    await pending; assert.equal(h.writes, 0, "una respuesta de la cuenta anterior no debe escribir en la nueva");
    await h.save(data); assert.equal(h.writes, 1, "la nueva sesión no hereda la prueba de la anterior");
  }
  {
    const h = harness(); await h.api.loadJSON(key, null); h.api.discardPendingSaves();
    await h.save(data); assert.equal(h.writes, 1);
    await h.api.clearAccountData(); await h.save(data); assert.equal(h.writes, 2);
  }
  {
    const h = harness(); h.disk.set("finzo:transactions", `v2:seed:${json}`);
    await h.api.loadJSON("finzo:transactions", null);
    for (let i = 0; i < 2; i++) { h.api.saveJSON("finzo:transactions", data); await h.api.flushPendingSaves(); }
    assert.equal(h.writes, 2, "la optimización solo afecta copias repetidas de Cajas");
  }
  {
    const h = harness(); await h.api.loadJSON(key, null); const gate = deferred(); h.encryptGate = gate;
    h.api.saveJSON(key, { ...data, movimientos: ["old"] }); const first = h.api.flushPendingSaves(); await tick();
    h.api.saveJSON(key, { ...data, movimientos: ["latest"] }); const second = h.api.flushPendingSaves();
    gate.resolve(); await Promise.all([first, second]);
    assert.ok(h.disk.get(key).includes('"latest"'), "la cola conserva el orden de cambios reales");
  }
  {
    const large = { ...data, detalle: "x".repeat(600_000) }; const h = harness(`v2:seed:${JSON.stringify(large)}`);
    await h.api.loadJSON(key, null); await h.save(large); await h.save(large);
    assert.equal(h.writes, 2, "no se conserva otra copia grande en memoria para ahorrar cifrado");
  }
  console.log("OK: Cajas evita solo copias v2 idénticas confirmadas; cambios, migración, fallos, lotes y sesiones conservan sus garantías.");
} finally {
  for (const h of instances) h.api.discardPendingSaves();
}

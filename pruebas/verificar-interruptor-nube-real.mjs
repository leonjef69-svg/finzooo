import assert from "node:assert/strict";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

const source = createSourceReader({ revision: process.env.FINO_CLOUD_TOGGLE_BASELINE ?? "" })("contexts/AppDataContext.tsx");
const saved = [], state = [], failures = [];
function operation({ premium = true, save = true } = {}) {
  const deps = {
    isPremium: premium,
    cloudBackupEnabled: true,
    STORAGE_KEYS: { cloudBackupEnabled: "cloudBackupEnabled" },
    tRef: { current: key => key },
    saveJSONNow: async (key, value) => { saved.push([key, value]); return save; },
    setCloudBackupEnabledState: value => state.push(value),
    setRespaldoFallo: value => failures.push(value),
  };
  return handlerOriginal("contexts/AppDataContext.tsx", "changeCloudBackupEnabled", deps, source);
}

await operation()(false);
assert.deepEqual(saved.at(-1), ["cloudBackupEnabled", false], "pausar queda guardado localmente");
assert.equal(state.at(-1), false, "la app refleja la pausa después de guardarla");
await operation()(true);
assert.deepEqual(saved.at(-1), ["cloudBackupEnabled", true], "reactivar también persiste la elección");
assert.equal(state.at(-1), true, "la app refleja la reactivación confirmada");
assert.equal(failures.at(-1), null, "reactivar limpia el error anterior de sincronización");

const before = saved.length;
await assert.rejects(operation({ premium: false })(true), /settings\.backupNeedsPaid/);
assert.equal(saved.length, before, "una cuenta sin acceso de pago no enciende respaldo");

const writesBeforeFailure = saved.length;
const stateBeforeFailure = state.length;
await assert.rejects(operation({ save: false })(false), /toast\.localSaveFailed/);
assert.equal(saved.length, writesBeforeFailure + 1, "se intentó persistir la pausa");
assert.equal(state.length, stateBeforeFailure, "un error de guardado no finge que la pausa quedó persistida");

console.log("Interruptor de nube: pausa/reactivación persisten; acceso de pago y fallos locales respetados.");

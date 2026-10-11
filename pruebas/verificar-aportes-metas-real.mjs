import "./diagnosticos/reproducir-aportes-meta-dos-equipos.mjs";
import assert from "node:assert/strict";
import { recordOriginOriginal } from "./helpers/record-origin-original.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { randomUUID } from "node:crypto";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";

const helper = recordOriginOriginal(), require = createRequire(import.meta.url);
const bundled = buildSync({ entryPoints: ["utils/mergeTransactions.ts"], bundle: true, write: false, platform: "node", format: "cjs",
  alias: { "@": process.cwd() } });
const module = { exports: {} };
new Function("module", "exports", "require", bundled.outputFiles[0].text)(module, module.exports, require);
const { mergeGoals } = module.exports;
const base = { id: 1, creationId: "same-goal", name: "Viaje", target: 30, saved: 0, createdDate: "2026-10-09", completed: false };
const a = helper.goalWithFundingChange(base, 10, "deposit-A"), b = helper.goalWithFundingChange(base, 20, "deposit-B");
const before = JSON.stringify([a, b]);
for (const [left, right] of [[a, b], [b, a]]) {
  const joined = mergeGoals([left], [right])[0];
  assert.equal(joined.saved, 30); assert.equal(joined.completed, true);
  assert.equal(mergeGoals([joined], [left])[0].saved, 30, "un reintento no duplica el aporte");
}
assert.equal(JSON.stringify([a, b]), before);
const joined = mergeGoals([a], [b])[0];
const withdrawn = helper.goalWithFundingChange(joined, -5, "withdraw-C");
assert.equal(mergeGoals([withdrawn], [a])[0].saved, 25);
assert.equal(withdrawn.completed, false);
const seed = helper.goalWithFundingChange(base, 100, "original-deposit");
const x = helper.goalWithFundingChange(seed, -80, "withdraw-A"), y = helper.goalWithFundingChange(seed, -80, "withdraw-B");
assert.throws(() => mergeGoals([x], [y]), /record-origin-conflict/, "dos retiros no inventan saldo cero ni pierden el otro retiro");
assert.throws(() => mergeGoals([{ ...base, saved: 10 }], [{ ...base, saved: 20 }]), /record-origin-conflict/,
  "dos cifras antiguas sin operaciones no se suman ni reemplazan a ciegas");
assert.equal(mergeGoals([base], [a])[0].saved, 10, "la base anterior compatible no revierte aportes");
assert.throws(() => mergeGoals([a], [{ ...a, saved: 11 }]), /record-origin-conflict/);
assert.throws(() => mergeGoals([], [{ ...a, funding: { ...a.funding, format: 2 } }]), /record-origin-conflict/);
assert.throws(() => mergeGoals([a], [{ ...a, saved: 15, funding: { ...a.funding, changes: { "deposit-A": 15 } } }]), /record-origin-conflict/,
  "la misma operación no puede valer dos cantidades");
let cents = helper.goalWithFundingChange(base, 0.1, "cents-A"); cents = helper.goalWithFundingChange(cents, 0.2, "cents-B");
assert.equal(cents.saved, 0.3);
for (const delta of [0, NaN, Infinity, 0.0001, -1000, Number.MAX_SAFE_INTEGER]) {
  assert.throws(() => helper.goalWithFundingChange(base, delta, "bad"), /record-origin-conflict/);
}

// Manejadores originales: dos toques secuenciales antes de volver a dibujar
// usan la referencia vigente, no una copia antigua. Edición conserva ahorro.
const live = { current: [base] }, notices = [];
const deps = { ...module.exports, ...helper, randomUUID, goals: [base], goalsLive: live, isPremium: true,
  issuedCreationId: () => undefined, deletedGoalIdsRef: { current: [] }, goalWriteReserved: { current: false }, metaConEstadoActual: value => ({ ...value, completed: value.saved >= value.target }),
  setGoals: update => { live.current = update(live.current); }, t: key => key, showToast: value => notices.push(value),
  setCelebrateGoal() {}, setTimeout: () => 0,
};
const deposit = handlerOriginal("contexts/AppDataContext.tsx", "addMoneyToGoal", deps);
deposit(10, 1); deposit(20, 1);
assert.equal(live.current[0].saved, 30);
const edit = handlerOriginal("contexts/AppDataContext.tsx", "addOrUpdateGoal", deps);
assert.equal(edit({ ...base, name: "Editada", target: 100, saved: 0 }, true), true);
assert.equal(live.current[0].saved, 30, "un formulario abierto antes del aporte no lo borra");
const withdraw = handlerOriginal("contexts/AppDataContext.tsx", "withdrawMoneyFromGoal", deps);
withdraw(1, 5); assert.equal(live.current[0].saved, 25);
withdraw(1, 100); assert.equal(live.current[0].saved, 25);
assert.ok(notices.includes("settings.backupMovementConflict"));
console.log("Metas originales: aportes/reintentos/retiros entre equipos, dinero exacto, formularios atrasados y datos inválidos; copias intactas. Firebase/Android/versiones antiguas pendientes.");

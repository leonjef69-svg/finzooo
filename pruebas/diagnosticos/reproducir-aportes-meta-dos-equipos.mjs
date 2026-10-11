import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "../helpers/source-reader.mjs";
import { handlerOriginal } from "../helpers/handler-original.mjs";
import { recordOriginOriginal } from "../helpers/record-origin-original.mjs";
import { randomUUID } from "node:crypto";

// FINO-62: registros ficticios, sin Firebase, tarjetas, Android ni escritura.
// Conserva la regresión original; ahora también corre desde la suite de metas.
const read = createSourceReader(), modules = new Map();
function original(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file, exports);
  vm.runInNewContext(ts.transpile(read(file), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), {
    exports, require: name => ["@/utils/recordOrigin", "@/utils/goalFunding"].includes(name) ? recordOriginOriginal()
      : original(`${name.slice(2)}.ts`),
  });
  return exports;
}
const goal = { id: 1, creationId: "same-original", name: "Viaje", target: 100,
  saved: 0, createdDate: "2026-10-09", completed: false };
function phone(amount) {
  let rows = [structuredClone(goal)];
  const deps = { ...recordOriginOriginal(), randomUUID, isPremium: true, goalWriteReserved: { current: false }, goals: rows, goalsLive: { current: rows },
    setGoals: update => { rows = update(rows); }, showToast() {}, t: key => key,
    setCelebrateGoal() {}, setTimeout: () => 0,
  };
  handlerOriginal("contexts/AppDataContext.tsx", "addMoneyToGoal", deps, read("contexts/AppDataContext.tsx"))(amount, goal.id);
  return rows;
}
const a = phone(10), b = phone(20), source = JSON.stringify([a, b]);
const merge = original("utils/mergeTransactions.ts");
const forward = merge.mergeGoals(a, b), backward = merge.mergeGoals(b, a);
assert.equal(JSON.stringify([a, b]), source, "la prueba no modifica las copias originales");
console.log(JSON.stringify({ diagnostic: "FINO-62 abierto: aportes independientes a la misma meta", phoneA: a[0].saved,
  phoneB: b[0].saved, expectedCombined: 30, actualAB: forward[0].saved, actualBA: backward[0].saved }, null, 2));
assert.equal(forward[0].saved, 30, "dos aportes reales distintos no deben reemplazarse");
assert.equal(backward[0].saved, 30, "el orden de recepción no cambia el dinero aportado");

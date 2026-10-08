import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { createSourceReader } from "../helpers/source-reader.mjs";

// Reproducción histórica de FINO-52, NO acreditación completa del hallazgo.
// Ahora comprueba el caso del máximo común con bytes nativos adaptados;
// verificar-identidad-creacion-real también fuerza una coincidencia numérica.
// Nunca opera sobre datos reales.
const read = createSourceReader();
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpile(read(file), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }), { exports, ...dependencies });
  return exports;
}
const now = Date.UTC(2026, 9, 8, 12);
class Clock extends Date { static now() { return now; } }
function phone(random) {
  const math = Object.create(Math);
  math.random = () => random;
  return load("utils/id.ts", { Date: Clock, Math: math, require: name => {
    assert.equal(name, "expo-crypto");
    return { randomUUID, getRandomValues: array => { array.fill(Math.floor(random * 255)); return array; } };
  } });
}
const a = phone(0.01), b = phone(0.99);
// El máximo cargado es mayor que ambas propuestas del reloj: puede venir de
// otra sesión/reloj adelantado. No forzamos a los celulares a usar el mismo azar.
const maximum = Math.max(a.idCandidate(now, 4095), b.idCandidate(now, 4095)) + 10_000;
a.reserveIdsAbove(maximum);
b.reserveIdsAbove(maximum);
const idA = a.nextId(), idB = b.nextId();
const order = load("utils/ordenarMovimientos.ts");
const { mergeTransactions, mergeGoals } = load("utils/mergeTransactions.ts", { require: name => {
  assert.equal(name, "@/utils/ordenarMovimientos");
  return order;
} });
const movement = (id, description, amount, updatedAt) => ({ id, type: "expense", amount, updatedAt,
  category: "servicios", date: "2026-10-08", time: "12:00", method: "cash", description, notes: "" });
const merged = mergeTransactions([movement(idA, "Compra A", 10, now)], [movement(idB, "Compra B", 20, now + 1)]);
const goals = mergeGoals([{ id: idA, name: "Meta A", target: 10, saved: 0, createdDate: "2026-10-08", completed: false }],
  [{ id: idB, name: "Meta B", target: 20, saved: 0, createdDate: "2026-10-08", completed: false }]);
console.log(JSON.stringify({ revision: read.revision ?? "carpeta actual", idA, idB,
  movementsBefore: 2, movementsAfter: merged.length, goalsBefore: 2, goalsAfter: goals.length }));
assert.equal(merged.length, 2, "FINO-52 pendiente: juntar dos celulares debe conservar AMBOS movimientos independientes");
assert.equal(goals.length, 2, "FINO-52 pendiente: juntar dos celulares debe conservar AMBAS metas independientes");
console.log("Este caso ya conserva ambos registros; falta comprobar la estrategia completa y su migración.");

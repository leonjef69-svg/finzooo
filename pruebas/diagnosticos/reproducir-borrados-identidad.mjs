import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createSourceReader } from "../helpers/source-reader.mjs";

// Diagnóstico pendiente: se espera ROJO hasta completar identidad de borrados.
// Está fuera del corredor aprobado. Solo registros ficticios en memoria;
// no usa Firebase, credenciales, almacenamiento, tarjetas ni migración real.
const read = createSourceReader();
const cache = new Map();
function load(file, dependencies = {}) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  vm.runInNewContext(ts.transpile(read(file), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }), { exports, require: name => {
    assert.ok(name.startsWith("@/"), "solo dependencias propias originales");
    return load(`${name.slice(2)}.ts`);
  }, ...dependencies });
  return exports;
}
const now = Date.UTC(2026, 9, 9, 12);
class Clock extends Date { static now() { return now; } }
function phone() {
  cache.delete("utils/id.ts");
  return load("utils/id.ts", { Date: Clock, require: name => {
    assert.equal(name, "expo-crypto");
    return { randomUUID, getRandomValues: bytes => { bytes.fill(100); return bytes; } };
  } });
}
const a = phone(), b = phone();
const maximum = a.idCandidate(now, 4095) + 10_000;
a.reserveIdsAbove(maximum); b.reserveIdsAbove(maximum);
const idA = a.nextId(), idB = b.nextId();
assert.equal(idA, idB, "colisión numérica forzada, no azar favorable");
assert.notEqual(a.issuedCreationId(idA), b.issuedCreationId(idB));
const movement = { id: idB, creationId: b.issuedCreationId(idB), updatedAt: now, type: "expense", amount: 20,
  category: "otros", date: "2026-10-09", method: "cash", description: "Compra independiente B", notes: "" };
const before = JSON.stringify(movement);
const history = load("utils/cloudHistoryMigration.ts");
const importer = load("utils/importCommit.ts");
const merge = load("utils/mergeTransactions.ts");
const require = createRequire(import.meta.url);
const admin = require("../../functions/src/personal-history-migration.js");
const erased = { id: idA, deleted: true };
const live = { id: idB, deleted: false, transaction: movement };
const results = [];
function check(name, work, preserves) {
  try {
    const result = work();
    assert.ok(preserves(result), "el borrado A no debe descartar silenciosamente el alta independiente B");
    results.push({ name, passed: true });
  } catch (error) {
    if (/(?:record-origin-conflict|historial-edicion-en-conflicto|HISTORY_ORIGIN_CONFLICT)/.test(error.message)) {
      results.push({ name, passed: true, blockedConflict: true });
    } else results.push({ name, passed: false, reason: error.message });
  }
}
check("historial: unir marca numérica con otro UUID", () => history.mergeHistoryEntries([erased], [live]),
  rows => rows.some(row => !row.deleted && row.transaction.creationId === movement.creationId));
check("historial: planificar alta contra marca remota", () => history.planLocalHistoryChanges([movement], [], [erased]),
  rows => rows.some(row => !row.deleted && row.transaction.creationId === movement.creationId));
check("migración TS: lista viva y marca numérica", () => history.stageLegacyHistory([movement], [idA]),
  rows => rows.some(row => !row.deleted && row.transaction.creationId === movement.creationId));
check("importación: no anuncia cero descartando otro UUID", () => importer.applyImportedTransactions([], [movement], [], [idA]),
  result => result.count === 1 && result.transactions[0]?.creationId === movement.creationId);
check("Admin: unión de marca e identidad independiente", () => admin.chooseEntry(erased, live),
  row => !row.deleted && row.transaction.creationId === movement.creationId);
check("Admin: no considera una marca como copia de otro UUID", () => admin.covers(erased, live), value => value === false);
check("manual antiguo ambiguo: no escoger por número sin revisión", () => merge.mergeTransactions(
  [{ ...movement, creationId: undefined, amount: 10, updatedAt: now - 1 }],
  [{ ...movement, creationId: undefined, amount: 30 }],
), rows => rows.length === 2);
assert.equal(JSON.stringify(movement), before, "ningún módulo cambia los objetos originales");
console.log(JSON.stringify({ diagnostic: "FINO-52 abierto: identidad de borrados/antiguos", results }, null, 2));
assert.ok(results.every(result => result.passed),
  "Diagnóstico ROJO esperado y fuera del conteo aprobado: falta protocolo compatible de borrados y revisión de antiguos ambiguos; NO ejecutar una migración real para ocultarlo.");

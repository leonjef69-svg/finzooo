import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { parseStatement } from "@/utils/importEngine";

const rows = Array.from({ length: 10_000 }, (_, index) => {
  const day = String((index % 28) + 1).padStart(2, "0");
  const type = index % 2 === 0 ? "Gasto" : "Ingreso";
  const category = index % 2 === 0 ? "Alimentación" : "Trabajo";
  return `${day}/09/2026,${index + 1},${type},Movimiento ${index + 1},${category},Transferencia`;
});
const csv = ["Fecha,Monto,Tipo,Descripcion,Categoria,Metodo", ...rows].join("\n");

const start = performance.now();
const parsed = parseStatement(csv, "bcp");
const duration = performance.now() - start;

if (!parsed.ok) assert.fail(`el archivo grande debe reconocerse como tabla: ${parsed.reason}`);
assert.equal(parsed.rows.length, 10_000);
assert.equal(parsed.errorCount, 0);
assert.equal(parsed.rows[0].date, "2026-09-01");
assert.equal(parsed.rows[0].type, "expense");
assert.equal(parsed.rows[0].categoryRaw, "Alimentación");
assert.equal(parsed.rows[9_999].amount, 10_000);
assert.equal(parsed.rows[9_999].type, "income");
assert.equal(parsed.rows[9_999].account, "bcp");
assert.ok(duration < 3_000, `procesar 10.000 filas tardó ${duration.toFixed(0)} ms`);

console.log(`Archivo de 10.000 filas procesado sin pérdidas en ${duration.toFixed(0)} ms.`);

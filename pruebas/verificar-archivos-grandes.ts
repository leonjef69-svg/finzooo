import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import * as XLSX from "xlsx";

import { buildPdfHtml, type PdfTexts, type PdfTx } from "@/utils/exportPdfHtml";
import { extractExcelText } from "@/utils/excelExtract";
import { MAX_IMPORT_BYTES, isImportTooLarge } from "@/utils/importLimits";
import { parseStatement } from "@/utils/importEngine";

assert.equal(isImportTooLarge(MAX_IMPORT_BYTES), false, "15 MB exactos deben aceptarse");
assert.equal(isImportTooLarge(MAX_IMPORT_BYTES + 1), true, "un byte extra debe rechazarse");
assert.equal(isImportTooLarge(undefined), false);

const excelRows: unknown[][] = [["Fecha", "Monto", "Tipo", "Descripcion", "Categoria"]];
for (let index = 0; index < 10_000; index++) {
  excelRows.push([
    `2026-09-${String((index % 28) + 1).padStart(2, "0")}`,
    index + 1,
    index % 2 === 0 ? "Gasto" : "Ingreso",
    `Fila ${index + 1}`,
    index % 2 === 0 ? "Alimentación" : "Trabajo",
  ]);
}
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(excelRows), "Movimientos");
const excelBytes = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
assert.ok(excelBytes.length < MAX_IMPORT_BYTES, "el Excel de prueba debe entrar dentro del límite real");

const excelStart = performance.now();
const extracted = extractExcelText(excelBytes);
const parsed = parseStatement(extracted.text, "bcp");
const excelDuration = performance.now() - excelStart;
if (!parsed.ok) assert.fail(`el Excel grande no se pudo interpretar: ${parsed.reason}`);
assert.equal(parsed.rows.length, 10_000);
assert.equal(parsed.errorCount, 0);
assert.equal(parsed.rows[9_999].description, "Fila 10000");
assert.ok(excelDuration < 5_000, `leer 10.000 filas de Excel tardó ${excelDuration.toFixed(0)} ms`);

const texts: PdfTexts = {
  colDate: "Fecha",
  colCategory: "Categoría",
  colDescription: "Descripción",
  colMethod: "Método",
  colAmount: "Monto",
  total: "Total",
  income: "Ingresos",
  expenses: "Gastos",
  balance: "Balance",
  byCategory: "Por categoría",
  byCategoryBudget: "Presupuestos",
  byMonth: "Por mes",
  byDay: "Por día",
  generatedOn: "Generado",
  movements: "Movimientos",
};
const pdfRows: PdfTx[] = Array.from({ length: 10_000 }, (_, index) => ({
  dateLabel: `${(index % 28) + 1} de septiembre`,
  day: (index % 28) + 1,
  categoryLabel: index % 2 === 0 ? "Comida" : "Salario",
  categoryColor: index % 2 === 0 ? "#f97316" : "#059669",
  description: `Movimiento <${index + 1}>`,
  methodLabel: "Transferencia",
  amount: index + 1,
  type: index % 2 === 0 ? "expense" : "income",
}));

const pdfStart = performance.now();
const html = buildPdfHtml({
  logoDataUri: "data:image/png;base64,AAAA",
  userName: "Prueba",
  title: "Reporte grande",
  monthLabel: "Septiembre 2026",
  txs: pdfRows,
  daysInMonth: 30,
  fmt: (amount) => `S/ ${amount.toFixed(2)}`,
  texts,
  charts: true,
  categoryBudgets: [],
  monthly: [],
  generatedAt: "28 de septiembre",
});
const pdfDuration = performance.now() - pdfStart;
assert.ok(html.includes("Movimiento &lt;1&gt;"), "el primer texto debe conservarse escapado");
assert.ok(html.includes("Movimiento &lt;10000&gt;"), "el último movimiento no debe perderse");
assert.ok(pdfDuration < 3_000, `preparar 10.000 filas para PDF tardó ${pdfDuration.toFixed(0)} ms`);

console.log(
  `Carga real: Excel 10.000 filas en ${excelDuration.toFixed(0)} ms; PDF preparado en ${pdfDuration.toFixed(0)} ms.`,
);

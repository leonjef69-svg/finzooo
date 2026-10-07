// FINO-46: una columna Monto con cargos negativos y abonos positivos.
// Ejecuta el lector real; no imita su lógica ni toca cuentas de usuarios.
import assert from "node:assert/strict";
import { parseStatement } from "@/utils/importEngine";

const mixto = parseStatement([
  "Fecha,Descripcion,Monto",
  "05/10/2026,Compra,-80",
  "06/10/2026,Abono,+1500",
  "07/10/2026,Comision,(15)",
].join("\n"));
assert.equal(mixto.ok, true);
if (!mixto.ok) throw new Error("No se pudo leer el archivo mixto");
assert.deepEqual(mixto.rows.map((row) => [row.amount, row.type]), [
  [80, "expense"], [1500, "income"], [15, "expense"],
], "con cargos negativos, el abono positivo es ingreso");

const soloPositivos = parseStatement([
  "Fecha,Descripcion,Monto",
  "05/10/2026,Compra,80",
  "06/10/2026,Otra compra,25",
].join("\n"));
assert.equal(soloPositivos.ok, true);
if (!soloPositivos.ok) throw new Error("No se pudo leer el archivo de cargos positivos");
assert.deepEqual(soloPositivos.rows.map((row) => row.type), ["expense", "expense"],
  "sin signos negativos, no se inventan ingresos");

const pieDeTabla = parseStatement([
  "Fecha,Descripcion,Monto",
  "05/10/2026,Compra,80",
  "TOTAL,Resumen,-100",
].join("\n"));
assert.equal(pieDeTabla.ok, true);
if (!pieDeTabla.ok) throw new Error("No se pudo leer el archivo con total");
assert.equal(pieDeTabla.rows[0]?.type, "expense",
  "un total negativo sin fecha real no cambia la interpretación de las compras");

const tipoExplicito = parseStatement([
  "Fecha,Descripcion,Monto,Tipo",
  "05/10/2026,Compra,-80,Gasto",
  "06/10/2026,Ajuste,+1500,Gasto",
].join("\n"));
assert.equal(tipoExplicito.ok, true);
if (!tipoExplicito.ok) throw new Error("No se pudo leer el archivo con tipo explícito");
assert.equal(tipoExplicito.rows[1]?.type, "expense",
  "la columna Tipo escrita por la persona prevalece sobre el signo");

const sinFecha = parseStatement([
  "Fecha,Descripcion,Monto",
  ",Compra,-80",
  ",Abono sin dia,+1500",
].join("\n"));
assert.equal(sinFecha.ok, true);
if (!sinFecha.ok) throw new Error("No se pudo leer la fila sin fecha");
assert.equal(sinFecha.rowsSinFecha[1]?.type, "income",
  "el abono que espera que el usuario elija fecha conserva su tipo");

console.log("Los signos de una columna Monto no convierten un abono en gasto.");

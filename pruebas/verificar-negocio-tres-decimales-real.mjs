import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const revision = process.env.FINO_TEST_REVISION;
if (revision && !/^[a-f0-9]{7,40}$/.test(revision)) throw Error("Revisión inválida");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
  const module = { exports: {} }; cache.set(file, module.exports);
  const require = name => {
    if (name === "@/utils/storage") return { loadJSON() {}, saveJSON() {}, saveJSONBatchNow() {}, STORAGE_KEYS: {} };
    if (name === "@/utils/categoryCustom") return { sanitizeName: value => value.trim() };
    if (name === "@/utils/businessSync") return { mergeBusinessData() {} };
    if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
    throw Error(`Dependencia inesperada: ${name}`);
  };
  vm.runInNewContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }), { module, exports: module.exports, require });
  return module.exports;
}
const business = load("utils/negocio.ts"), totals = load("utils/negocioTotales.ts"), workspace = load("utils/negocioWorkspace.ts");
const record = { negocioId: "synthetic", tipo: "ingreso", monto: 1.234, metodo: "efectivo", descripcion: "Ficticio", fecha: "2026-10-24", hora: "10:00" };
assert.equal(business.crearMovimientoNegocio(record).monto, 1.234, "un monto válido de tres decimales no pierde el último");
const lines = [{ productoId: "p", nombre: "Producto ficticio", precio: 1.234, cantidad: 3 }];
assert.equal(business.totalDeLineas(lines), 3.702);
assert.equal(workspace.importeCategoria(1.234, 3), 3.702);
const movements = [business.crearMovimientoNegocio(record), business.crearMovimientoNegocio({ ...record, tipo: "gasto", monto: 0.123 })];
const calculated = totals.totalesDelNegocio("synthetic", [], movements);
assert.equal(calculated.ingresosManuales, 1.234); assert.equal(calculated.gastos, 0.123); assert.equal(calculated.saldo, 1.111);
const rows = workspace.filasDelNegocio("synthetic", { ventas: [], movimientos: movements });
assert.equal(workspace.totalesWorkspace(rows).ingresos, 1.234); assert.equal(workspace.totalesWorkspace(rows).gastos, 0.123);
const monthly = totals.resumenPorMes("synthetic", [], movements);
assert.equal(monthly[0].entro, 1.234); assert.equal(monthly[0].salio, 0.123); assert.equal(monthly[0].queda, 1.111);
assert.equal(totals.diferenciaConElMesPasado([...monthly, { mes: "2026-09", queda: 0.001 }], "2026-10"), 1.11);
const products = [{ id: "exact", negocioId: "synthetic", nombre: "Exacto", activo: true, precio: 1.234 },
  { id: "different", negocioId: "synthetic", nombre: "Distinto", activo: true, precio: 1.23 }];
const match = workspace.coincidenciasNegocio(1.234, products, false);
assert.equal(match.opciones.length, 1); assert.equal(match.opciones[0][0].productoId, "exact", "no confundir precios que difieren por una milésima");
assert.equal(workspace.coincidenciasNegocio(3.702, [products[0]]).opciones[0][0].cantidad, 3);
const sale = business.crearVenta({ negocioId: "synthetic", fecha: "2026-10-24", hora: "10:00", metodo: "efectivo", lineas: lines });
assert.equal(sale.total, 3.702);
assert.equal(totals.productosVendidos("synthetic", [sale])[0].total, 3.702);
// PEN y monedas sin fracciones conservan sus valores anteriores.
for (const amount of [0.01, 0.1, 15.1, 50, 999999999, 9000000000000]) {
  assert.equal(business.crearMovimientoNegocio({ ...record, monto: amount }).monto, amount);
  assert.equal(workspace.importeCategoria(amount, 1), amount);
}
assert.equal(business.totalDeLineas([{ ...lines[0], precio: 15.1, cantidad: 3 }]), 45.3);
assert.equal(workspace.importeCategoria(1.234, 0), 0); assert.equal(workspace.importeCategoria(1.234, 51), 0);
// Redondear únicamente al final pierde milésimas si se acumulan montos muy
// distintos. Los libros completos usan las mismas unidades enteras del panel.
const largeMovements = [{ ...record, id: "large", origen: "manual", monto: 10_000_000_000 },
  ...Array.from({ length: 10_000 }, (_, id) => ({ ...record, id: `small-${id}`, origen: "manual", monto: 0.001 }))];
const expectedLarge = 10_000_000_010;
assert.equal(totals.totalesDelNegocio("synthetic", [], largeMovements).saldo, expectedLarge,
  "el panel conserva diez mil milésimas después de un monto grande");
assert.equal(totals.resumenPorMes("synthetic", [], largeMovements)[0].queda, expectedLarge,
  "el resumen mensual coincide con el panel y no acumula errores de coma flotante");
const largeSales = largeMovements.map((movement, index) => ({ ...sale, id: `sale-${index}`, total: movement.monto,
  lineas: [{ ...lines[0], precio: movement.monto, cantidad: 1 }] }));
assert.equal(totals.totalesDelNegocio("synthetic", largeSales, []).ventas, expectedLarge);
assert.equal(totals.productosVendidos("synthetic", largeSales)[0].total, expectedLarge);
assert.equal(totals.diferenciaConElMesPasado([{ mes: "2026-10", queda: 10_000_000_000.001 },
  { mes: "2026-09", queda: 9_999_999_999.999 }], "2026-10"), 0.002,
  "comparar saldos grandes no pierde la diferencia de dos milésimas");
console.log("Negocio original: tres decimales conservados en alta, cantidad, ventas, totales, meses, comparación y clasificación; PEN/enteros y límites intactos. Datos ficticios, sin Android ni cuenta.");

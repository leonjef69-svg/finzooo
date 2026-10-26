import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const read = createSourceReader();
const require = createRequire(import.meta.url);
const load = file => {
  const output = buildSync({ stdin: { contents: read(file), sourcefile: file, resolveDir: path.dirname(path.resolve(file)), loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: { "@": process.cwd(), "react-native": path.resolve("pruebas/stubs/rn.ts"), "lucide-react-native": path.resolve("pruebas/stubs/lucide.ts"), "@expo/vector-icons": path.resolve("pruebas/stubs/vectoricons.ts"), "expo-font": path.resolve("pruebas/stubs/font.ts") },
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", output.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
};
const engine = load("utils/importEngine.ts"), excel = load("utils/excelExtract.ts"), duplicates = load("utils/duplicates.ts");
const failures = [];
let cases = 0;
function check(name, run) { cases++; try { run(); } catch (error) { failures.push(name); console.log("FALLA", name, error.message); } }
const parsed = (rows, options) => {
  const result = engine.parseStatement(rows.join("\n"), undefined, options);
  assert.equal(result.ok, true); return result;
};
const tx = (row, id = 100) => ({ ...row, id, category: "otros", method: "cash", notes: "", origin: "imported" });
check("CSV con tipo Android de Excel sigue siendo texto", () => assert.equal(excel.looksLikeExcel("estado.csv", "application/vnd.ms-excel"), false));
check("Montos con varios miles conservan su valor", () => assert.equal(parsed(["Fecha;Monto;Tipo", "2026-10-25;1,234,567;Gasto"]).rows[0].amount, 1234567));
check("Céntimos con puntuación final", () => assert.equal(parsed(["Fecha;Monto;Tipo", "2026-10-25;S/ 6.50.;Ingreso"]).rows[0].amount, 6.5));
check("Símbolos y signo de las monedas configurables se conservan", () => {
  for (const [raw, currency, amount] of [["Bs 6,50", "BOB", 6.5], ["د.ك 0.123", "KWD", 0.123], ["+S/ 6.50", "PEN", 6.5], ["-S/ 6,50", "PEN", 6.5], ["COL$ 1500", "COP", 1500]]) {
    assert.equal(parsed(["Fecha;Monto;Tipo", `2026-10-25;${raw};Gasto`], { currency }).rows[0].amount, amount);
  }
});
check("Agrupación rota no cambia el dinero", () => assert.equal(parsed(["Fecha;Monto;Tipo", "2026-10-25;1,2,3.50;Ingreso"]).rows.length, 0));
check("No se redondean fracciones que la moneda no admite", () => {
  assert.equal(parsed(["Fecha;Monto;Tipo", "2026-10-25;0.123;Ingreso"]).rows.length, 0);
  assert.equal(parsed(["Fecha;Monto;Tipo", "2026-10-25;0.123;Ingreso"], { currency: "KWD" }).rows[0].amount, 0.123);
});
check("Fecha inválida no se convierte en fecha faltante", () => {
  const p = parsed(["Fecha;Monto;Tipo", "31/02/2026;10;Gasto"]); assert.equal(p.rowsSinFecha.length, 0); assert.equal(p.errorCount, 1);
});
check("Año con basura no se recorta", () => assert.equal(engine.parseDate("25/10/20266"), null));
check("Fecha de operación no se usa como código ni columna monetaria", () => {
  const p = parsed(["Fecha de operación;Descripción;Monto;Tipo", "2026-10-25;Primero;10;Gasto", "2026-10-25;Segundo;20;Gasto"]);
  assert.deepEqual(p.rows.map(row => row.reference), ["", ""]);
  assert.equal(parsed(["Fecha de abono;Descripción;Monto;Tipo", "2026-10-25;Ingreso;6.50;Ingreso"]).rows[0].amount, 6.5);
});
check("Resumen sin fecha no duplica el gasto", () => assert.equal(parsed(["Fecha;Monto;Descripcion", "25/10/2026;-10;Taxi", ...["TOTAL", "Total gastos", "Total general", "Saldo disponible", "Sub total"].map(label => `;10;${label}`)]).rows.length, 1));
check("Positivos sin tipo requieren una elección", () => {
  const data = ["Fecha;Monto;Tipo", "2026-10-25;6,50;"];
  assert.equal(parsed(data).needsTypeChoice, true);
  const p = parsed(data, { rowTypes: { 2: "income" } }); assert.equal(p.rows[0].type, "income"); assert.equal(p.needsTypeChoice, false);
});
check("Día y mes ambiguos piden confirmación y respetan ambas opciones", () => {
  const data = ["Fecha;Monto;Tipo", "05/10/2026;6,50;Ingreso"];
  assert.equal(parsed(data).needsDateOrder, true);
  assert.equal(parsed(data, { dateOrder: "DMY" }).rows[0].date, "2026-10-05");
  assert.equal(parsed(data, { dateOrder: "MDY" }).rows[0].date, "2026-05-10");
});
check("Archivo estadounidense inequívoco", () => {
  const p = parsed(["Date;Amount;Type", "10/25/2026;6.50;income", "10/05/2026;10;expense"]);
  assert.equal(p.rows.length, 2); assert.equal(p.needsDateOrder, false); assert.equal(p.rows[1].date, "2026-10-05");
});
check("Dos columnas con dinero simultáneo se rechazan", () => assert.equal(parsed(["Fecha;Cargo;Abono", "2026-10-25;10;20"]).rows.length, 0));
check("Comas entre comillas no cambian el separador", () => {
  const p = parsed(["Fecha;Descripcion;Monto;Tipo", '2026-10-25;"uno,dos,tres,cuatro,cinco,seis";6,50;Ingreso']);
  assert.equal(p.rows[0].amount, 6.5);
});
check("Coma decimal sin comillas no recorta 6,50 a 6", () => assert.equal(parsed(["Fecha,Descripcion,Monto,Tipo", "2026-10-25,Cafe,6,50,Ingreso"]).rows.length, 0));
check("Cargo y tipo contradictorios no invierten el movimiento", () => assert.equal(parsed(["Fecha;Cargo;Abono;Tipo", "2026-10-25;6,50;;Ingreso"]).rows.length, 0));
check("Descripción multilínea conserva una fila", () => {
  const p = parsed(["Fecha,Descripcion,Monto,Tipo", '2026-10-25,"Compra', 'en tienda",6.50,Gasto']);
  assert.equal(p.rows.length, 1); assert.equal(p.rows[0].description, "Compra\nen tienda"); assert.equal(p.rows[0].amount, 6.5);
});
const row = { date: "2026-10-25", amount: 6.5, type: "income", description: "Ingreso", merchant: "Ingreso", reference: "0001", categoryRaw: "", methodRaw: "" };
check("Referencias distintas son operaciones distintas", () => assert.equal(duplicates.scoreMatch(tx(row), { ...row, reference: "0002" }).level, "new"));
check("Mismo código con un céntimo distinto exige revisión sin añadir automáticamente", () => assert.equal(duplicates.scoreMatch(tx(row), { ...row, amount: 6.51 }).level, "review"));
check("Referencia idéntica reconoce repetido con descripción distinta", () => assert.equal(duplicates.scoreMatch(tx({ ...row, description: "A", merchant: "A" }), { ...row, description: "Otro texto", merchant: "Otro" }).level, "high"));

// La base ya falla por comportamiento; los auxiliares nuevos solo se cargan
// en la versión corregida, para no confundir fallo de regresión con ausencia.
if (!read.revision) {
  const { buildImportCandidates, resolveImportCandidates } = load("utils/importCandidates.ts");
  const { applyImportedTransactions } = load("utils/importCommit.ts");
  let id = 100;
  const make = row => tx(row, ++id);
  check("Repetido dentro del archivo entra una vez y puede conservarse explícitamente", () => {
    const c = buildImportCandidates([row, row], new Map(), new Set(), new Map(), make);
    assert.equal(c[1].inFile, true);
    assert.equal(resolveImportCandidates(c, new Map()).toAdd.length, 1);
    assert.equal(resolveImportCandidates(c, new Map([[c[1].tx.id, "keepBoth"]])).toAdd.length, 2);
  });
  check("Reimportar archivo con repetidos no añade ninguno", () => {
    const c = buildImportCandidates([row, row], duplicates.buildDuplicateDateIndex([tx(row)]), new Set(), new Map(), make);
    assert.equal(resolveImportCandidates(c, new Map()).toAdd.length, 0);
  });
  check("Tandas con fecha y mes asignado comparten detección", () => {
    const seen = new Map(), matched = new Set();
    buildImportCandidates([row], new Map(), matched, seen, make);
    assert.ok(buildImportCandidates([row], new Map(), matched, seen, make)[0].inFile);
  });
  check("Cambio concurrente exige nueva revisión sin guardar parte del lote", () => {
    const original = [tx(row)]; const copy = structuredClone(original);
    assert.throws(() => applyImportedTransactions(original, [tx({ ...row, reference: "0002" }, 201), tx(row, 202)], [], []), /import-source-changed/);
    assert.deepEqual(original, copy);
    assert.equal(applyImportedTransactions(original, [tx(row, 202)], [], [], Date.now(), [202]).count, 1);
  });
  check("Preparar el mismo lote dos veces conserva los IDs", () => {
    const first = applyImportedTransactions([], [tx(row)], [], []);
    assert.equal(applyImportedTransactions(first.transactions, [tx(row)], [], []).count, 0);
  });
  // Ejecutar el manejador original con IO en memoria, sin cuenta ni SQLite.
  const lock = { current: false }; let saved = 0; let release;
  const deps = { importLock: lock, mounted: { current: true }, needsChoices: false, getAccountStorageSession: () => 1,
    setSaving() {}, candidates: [{ tx: tx(row), raw: row, match: null }], resolveImportCandidates,
    async commitImport() { saved++; await new Promise(resolve => { release = resolve; }); return 1; },
    setImportedTotal() {}, setReviewing() {}, setDone() {}, showToast() {}, t: key => key };
  const apply = handlerOriginal("screens/ImportSheet.tsx", "applyResolutions", deps);
  const first = apply(new Map()); await apply(new Map()); assert.equal(saved, 1); release(); await first;
  const blocked = handlerOriginal("screens/ImportSheet.tsx", "applyResolutions", { ...deps, importLock: { current: false }, needsChoices: true });
  await blocked(new Map()); assert.equal(saved, 1);
  cases++;
  const retryLock = { current: false }; let attempts = 0;
  const retry = handlerOriginal("screens/ImportSheet.tsx", "applyResolutions", { ...deps, importLock: retryLock,
    async commitImport() { if (++attempts === 1) throw Error("storage unavailable"); return 1; } });
  assert.equal(await retry(new Map()), false); assert.equal(retryLock.current, false);
  assert.equal(await retry(new Map()), true); assert.equal(attempts, 2); cases++;
}
assert.deepEqual(failures, [], `${failures.length} fallos de importación`);
console.log(`${cases} casos del lector/detector originales y guardado con IO en memoria correctos; no equivalen a importar en Android.`);

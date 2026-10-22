import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_EXPORT_SUMMARY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const root = process.cwd();
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const originalFiles = new Set(["utils/reportePdfDatos.ts", "utils/exportPdfHtml.ts", "utils/reporteArchivo.ts", "utils/exportSpaces.ts", "utils/exportSelection.ts", "utils/recentMovementFilters.ts", "utils/ahorro.ts", "utils/finances.ts", "utils/saldoAnterior.ts", "constants/i18n.ts"]);
const aliases = Object.fromEntries(Object.entries({ "react-native": "rn.ts", "lucide-react-native": "lucide.ts", "@expo/vector-icons": "vectoricons.ts", "expo-font": "font.ts", "@/modules/export-scheduler": "programador.ts", "expo-notifications": "notif.ts", "expo-crypto": "crypto.ts" }).map(([key, file]) => [key, path.join(root, "pruebas/stubs", file)]));
async function original(file) {
  const result = await build({ entryPoints: [file], bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", alias: { "@": root, ...aliases },
    plugins: [{ name: "historical-sources", setup(b) { b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, args => {
      const relative = path.relative(root, args.path).replaceAll("\\", "/");
      if (originalFiles.has(relative)) return { contents: read(relative), loader: relative.endsWith("tsx") ? "tsx" : "ts" };
    }); } }],
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
  return module.exports;
}
const { htmlDelReporte } = await original("utils/reportePdfDatos.ts");
const { translations, monthNamesFor } = await original("constants/i18n.ts");
const { availablePersonalBalance } = await original("utils/finances.ts");
const { saldoAnteriorDe } = await original("utils/saldoAnterior.ts");
const { fmtExact } = await original("utils/format.ts");
const { currencySymbolFor } = await original("constants/currencies.ts");
const { showInPersonalRecent } = await original("utils/recentMovementFilters.ts");
const { catInfo } = await original("constants/categories.ts");
const { methodLabel } = await original("constants/i18n.ts");
const { fmtDate } = await original("utils/format.ts");
const { saldoLibre, totalApartado } = await original("utils/ahorro.ts");
const { moneyFromUnits, moneyUnits } = await original("utils/moneyPrecision.ts");
const sumAmounts = items => moneyFromUnits(items.reduce((sum, item) => sum + moneyUnits(item.amount), 0n));
const resumenFinanciero = handlerOriginal("utils/exportSpaces.ts", "resumenFinanciero", { availablePersonalBalance, saldoAnteriorDe, moneyFromUnits, moneyUnits, sumAmounts, saldoLibre, totalApartado }, read("utils/exportSpaces.ts"));
const formateadorDelEspacio = handlerOriginal("utils/exportSpaces.ts", "formateadorDelEspacio", { formatAmount: fmtExact, currencySymbolFor }, read("utils/exportSpaces.ts"));
const selectionFile = /export function movimientosParaReporte\(/.test(read("utils/reporteArchivo.ts")) ? "utils/reporteArchivo.ts" : "utils/exportSelection.ts";
const movimientosParaReporte = handlerOriginal(selectionFile, "movimientosParaReporte", { showInPersonalRecent }, read(selectionFile));
const visiblePersonalMovement = handlerOriginal("utils/personalHistory.ts", "visiblePersonalMovement", {}, read("utils/personalHistory.ts"));
const filasDelReporte = handlerOriginal("utils/reporteArchivo.ts", "filasDelReporte", { catInfo, methodLabel, fmtDate }, read("utils/reporteArchivo.ts"));
// Elige espacio/mes con las expresiones originales de la pantalla, no una
// segunda implementación del selector. Solo se adapta useMemo (sin React).
function seleccionDePantalla(espacios, espacioId, selectedMk, exportType) {
  const file = "screens/ExportPdfSheet.tsx", sourceText = read(file);
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const wanted = ["espacio", "movimientosDelEspacio", "monthTx"], found = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && wanted.includes(node.name.text)) {
      assert.ok(!found.has(node.name.text), `Variable original ambigua: ${node.name.text}`);
      found.set(node.name.text, `const ${node.getText(source)};`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(found.size, wanted.length, "selección original de espacio/mes encontrada");
  const code = ts.transpileModule(wanted.map(name => found.get(name)).join("\n"), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function("espacios", "espacioId", "selectedMk", "exportType", "useMemo", "movimientosParaReporte", `${code}\nreturn { espacio, movimientosDelEspacio, monthTx };`)
    (espacios, espacioId, selectedMk, exportType, fn => fn(), movimientosParaReporte);
}
function efectoAutomaticoOriginal(dependencies) {
  const file = "screens/ExportPdfSheet.tsx", sourceText = read(file);
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect") {
      const callback = node.arguments[0];
      if (callback && ts.isArrowFunction(callback) && callback.body.getText(source).includes("!autoExport || autoFired.current || !initialMonth")) matches.push(callback.body.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(matches.length, 1, "efecto automático original identificado sin ambigüedad");
  return handlerOriginal(file, "efectoAutomaticoExtraido", dependencies, `function efectoAutomaticoExtraido() ${matches[0]}`);
}
const movimientos = [
  { id: 1, type: "expense", amount: 50, category: "comida", description: "Almuerzo de prueba", date: "2026-10-07", method: "cash", notes: "", time: "12:30" },
  { id: 2, type: "income", amount: 30, category: "salario", description: "Ingreso de prueba", date: "2026-10-07", method: "debit", notes: "", time: "10:15" },
];
const fmt = amount => `S/ ${amount.toFixed(2)}`;
const resumen = { available: 480, income: 30, expenses: 50, result: -20, budget: 500, previousBalance: 0 };
const text = html => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
function data(type = "all", language = "es", changes = {}) {
  const t = key => translations[language][key] ?? key;
  return { movimientos, todos: movimientos, tipo: type, mes: "2026-10", charts: true,
    userName: "Cuenta de ejemplo", nombresDeMes: monthNamesFor(language), presupuestos: {}, fmt,
    titulo: t(type === "expense" ? "exportPdf.pdfTitleExpenses" : type === "income" ? "exportPdf.pdfTitleIncome" : "exportPdf.pdfTitleAll"),
    etiquetaDelMes: "Octubre 2026", nombreDelEspacio: "Personal", resumen, t, ...changes };
}
for (const language of ["es", "en", "pt"]) {
  for (const type of ["expense", "income", "all"]) {
    const d = data(type, language), html = htmlDelReporte(d), readable = text(html);
    const summary = html.match(/<section data-report-summary\b[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(summary, "El resumen pertenece al mismo documento");
    const cards = [...summary.matchAll(/data-report-card="([^"]+)"/g)].map(match => match[1]);
    assert.ok(cards.includes("available"), "Saldo disponible real en todos los filtros");
    assert.ok(!cards.includes("budget") && summary.includes("data-report-budget"), "Presupuesto positivo dentro de Saldo, nunca en otra tarjeta");
    assert.ok(summary.includes(d.t("exportPdf.budgeted").replace("{amount}", fmt(resumen.budget))));
    assert.equal(cards.length, new Set(cards).size, "Una sola tarjeta por dato, sin repetidos");
    assert.match(summary, /background:#eff6ff/, "Saldo positivo con tarjeta azul");
    if (type !== "income") assert.match(summary, /background:#fff1f2/, "Gastos con tarjeta roja");
    if (type !== "expense") assert.match(summary, /background:#ecfdf5/, "Ingresos con tarjeta verde");
    if (type !== "all") {
      const excluded = d.t(type === "expense" ? "exportPdf.income" : "exportPdf.expenses");
      assert.ok(!readable.includes(excluded), `${type}/${language}: no mostrar el tipo excluido`);
      assert.ok(!readable.includes(type === "expense" ? "Ingreso de prueba" : "Almuerzo de prueba"));
      assert.ok(summary.includes(d.t("exportPdf.available")), "El saldo es del espacio, no solo de las filas filtradas");
    }
    assert.ok(readable.includes(d.t("exportPdf.colMethod")));
    assert.equal((html.match(/aria-hidden="true" style="display:inline-block;width:7px;height:7px;border-radius:4px;background:#2563eb/g) ?? []).length, type === "all" ? 2 : 1);
  }
}
assert.equal(translations.es["exportPdf.colMethod"], "Método de pago");
for (const budget of [undefined, 0, -5]) assert.ok(!htmlDelReporte(data("all", "es", { resumen: { ...resumen, budget } })).includes("data-report-budget"));
const all = htmlDelReporte(data());
// Referencias del usuario: dos columnas con base; movimientos a todo el
// ancho sin presupuesto/arrastre, y un único saldo al pie. Mismos importes.
const groupedCases = [
  { budget: 500, previousBalance: 300, available: 780 },
  { budget: 500, previousBalance: 0, available: 480 },
  { previousBalance: 0, available: -20 },
  { previousBalance: 300, available: 280 },
];
for (const language of ["es", "en", "pt"]) for (const example of groupedCases) {
  const d = data("all", language, { resumenAgrupado: true, resumen: { income: 30, expenses: 50, result: -20, ...example } });
  const html = htmlDelReporte(d);
  assert.ok(html.includes('data-report-layout="grouped"'), "el automático usa la tarjeta agrupada pedida, no las tarjetas anteriores");
  const section = html.match(/<section data-report-summary\b[^>]*>([\s\S]*?)<\/section>/)[1];
  const fields = [...section.matchAll(/data-report-card="([^"]+)"/g)].map(match => match[1]);
  assert.equal(fields.length, new Set(fields).size, "cada dato aparece una sola vez");
  assert.equal(fields.includes("budget"), Boolean(example.budget));
  assert.equal(fields.includes("previousBalance"), Boolean(example.previousBalance));
  assert.equal(fields.at(-1), "available", "el saldo disponible queda al pie del mismo bloque");
  assert.equal(section.includes('data-report-group="base"'), Boolean(example.budget || example.previousBalance));
  assert.equal(section.includes(d.t("exportPdf.monthBase")), Boolean(example.budget || example.previousBalance));
  assert.ok(section.includes(example.available < 0 ? `-${fmt(Math.abs(example.available))}` : fmt(example.available)));
  assert.ok(section.includes("+S/ 30.00") && section.includes("-S/ 50.00"));
  assert.match(section, /color:#059669/); assert.match(section, /color:#e11d48/);
  assert.ok(!section.includes(d.t("exportPdf.periodResult")), "no repite el resultado como otro saldo");
  if (!example.budget && !example.previousBalance) assert.ok(section.includes(d.t("exportPdf.monthlyMovements")));
}
for (const type of ["income", "expense"]) {
  const html = htmlDelReporte(data(type, "es", { resumenAgrupado: true }));
  assert.ok(!text(html).includes(translations.es[type === "income" ? "exportPdf.expenses" : "exportPdf.income"]));
  assert.equal((html.match(/data-report-card="available"/g) ?? []).length, 1);
}
assert.ok(text(all).includes("S/ 480.00") && all.includes("data-report-budget"));
assert.ok(!all.includes(translations.es["exportPdf.previousBalance"]), "Saldo anterior cero no ocupa otra fila");
const onlyExpenses = htmlDelReporte(data("all", "es", { movimientos: [movimientos[0]], resumen: { ...resumen, income: 0 } }));
assert.ok(!text(onlyExpenses).includes(translations.es["exportPdf.income"]));
const transfer = { ...movimientos[1], id: 3, description: "Aporte interno", internalTransfer: "family" };
assert.ok(!text(htmlDelReporte(data("income", "es", { movimientos: [...movimientos, transfer] }))).includes("Aporte interno"));
assert.ok(text(htmlDelReporte(data("all", "es", { movimientos: [...movimientos, transfer] }))).includes("Aporte interno"));

// Las mismas cuentas originales usadas por Inicio/exportación, no saldos de relleno.
const movimientosReales = [...movimientos,
  { ...movimientos[1], id: 4, amount: 310, date: "2026-09-03" },
  { ...transfer, id: 5, type: "expense", amount: 100 },
  { ...transfer, id: 6, amount: 40 },
];
const budgets = { "2026-10": 1_999_202_020.75 };
const espacioReal = { id: "personal", kind: "personal", name: "Personal", currency: "PEN", transactions: movimientosReales };
const resumenReal = resumenFinanciero(espacioReal, "2026-10", budgets, []);
assert.equal(resumenReal.available, 1_999_202_250.75);
assert.equal(resumenReal.previousBalance, 310);
const fmtReal = formateadorDelEspacio(espacioReal);
for (const type of ["all", "income", "expense"]) {
  const html = htmlDelReporte(data(type, "es", { movimientos: movimientosReales.filter(tx => tx.date.startsWith("2026-10")), todos: movimientosReales, resumen: resumenReal, fmt: fmtReal }));
  assert.ok(text(html).includes("S/ 1,999,202,250.75"));
  assert.ok(text(html).includes("S/ 1,999,202,020.75"));
  assert.doesNotMatch(text(html), /\d\s+[KMBT]\b/, "Sin sufijos de monto ni en resumen ni en gráficos");
}
for (const kind of ["family", "box", "sharedBox"]) {
  const summary = resumenFinanciero({ ...espacioReal, kind }, "2026-10", budgets, []);
  assert.equal(summary.available, 230, "Familia/Cajas usan su libro, no el presupuesto de Personal");
  const html = htmlDelReporte(data("expense", "es", { resumen: summary, fmt: fmtReal }));
  assert.ok(!html.includes("data-report-budget"));
  assert.ok(text(html).includes("S/ 230"));
}

// Acumulados grandes con céntimos, arrastre y transferencias internas.
const precisionMovements = [
  { ...movimientos[0], id: 10, amount: 9_000_000_000_000, date: "2026-10-01" },
  ...Array.from({ length: 44 }, (_, i) => ({ ...movimientos[0], id: 11 + i, amount: 50.15, date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}` })),
  ...Array.from({ length: 45 }, (_, i) => ({ ...movimientos[1], id: 60 + i, amount: 30.45, date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}` })),
  { ...transfer, id: 110, type: "expense", amount: 2.15, date: "2026-10-14" },
  { ...transfer, id: 111, type: "income", amount: 0.1, date: "2026-10-14" },
];
const resumenPrecision = resumenFinanciero({ ...espacioReal, transactions: precisionMovements }, "2026-10", { "2026-09": 310.25, "2026-10": 1_999_202_020.75 }, []);
assert.equal(Number(resumenPrecision.expenses.toFixed(2)), 9_000_000_002_206.6, "el PDF suma los gastos con céntimos exactos");
assert.equal(Number(resumenPrecision.income.toFixed(2)), 1_370.25, "el PDF suma los ingresos con céntimos exactos");
assert.equal(Number(resumenPrecision.previousBalance.toFixed(2)), 310.25, "el PDF conserva el saldo arrastrado exacto");
assert.equal(Number(resumenPrecision.available.toFixed(2)), -8_998_000_798_507.4, "el PDF coincide con Inicio y respeta las transferencias");
const grandes = [19_992_020.75, 999_999_999.99, 9_000_000_000_000, 19_999_202_020_020.75];
for (const currency of ["PEN", "USD", "EUR", "JPY", "CLP", "BHD"]) {
  const format = formateadorDelEspacio({ ...espacioReal, currency });
  for (const amount of grandes) {
    const html = htmlDelReporte(data("all", "es", { movimientos: [{ ...movimientos[0], amount }], resumen: { ...resumenReal, available: -amount, budget: amount }, fmt: format }));
    assert.ok(text(html).includes(format(amount)) && text(html).includes(format(-amount)));
    assert.doesNotMatch(text(html), /\d\s+(?:[KMBT]|mil|bill\.)\b/);
  }
}

// ConstruirHtml de la pantalla REAL en los tres recorridos: el PDF que se
// previsualiza/comparte manualmente, el automático abierto y el programado.
const screenModes = [
  { name: "manual", autoExport: false, scheduledRunKey: undefined },
  { name: "automático abierto", autoExport: true, scheduledRunKey: undefined },
  { name: "programado", autoExport: false, scheduledRunKey: "2026-10-14-prueba" },
];
// Caso que vio el usuario: ingreso real 100 y cinco recibos de metas de la
// versión anterior. Esos recibos se conservan, pero no son cinco movimientos
// nuevos ni deben volver a entrar en el total del documento.
const legacySalary = { ...movimientos[1], id: 800, amount: 100, date: "2026-10-20", description: "PERSONAL_INGRESO_REAL" };
const legacyReceipts = [4, -10, 10, -10, -10].map((amount, i) => ({
  ...legacySalary, id: 801 + i, type: amount < 0 ? "expense" : "income", amount: Math.abs(amount),
  description: `RECIBO_META_ANTIGUO_${i}`, internalTransfer: "goal", internalTransferSpaceId: "50", internalTransferLink: `receipt-${i}`,
}));
const legacyPersonal = { ...espacioReal, transactions: [legacySalary, ...legacyReceipts] };
const exportSpaces = [legacyPersonal, ...["family", "box", "sharedBox"].map((kind, i) => {
  const prefix = `ESPACIO_${kind.toUpperCase()}_PRUEBA`, transferKind = kind === "family" ? "family" : "box";
  return { id: `${kind}:ejemplo`, kind, name: prefix, currency: "PEN", transactions: [
    { ...legacySalary, id: 900 + i * 10, amount: 7 + i, description: `${prefix}_INGRESO_REAL` },
    { ...legacySalary, id: 901 + i * 10, type: "expense", amount: 2 + i, description: `${prefix}_GASTO_REAL` },
    { ...legacySalary, id: 902 + i * 10, amount: 20 + i, description: `${prefix}_APORTE_PERSONAL`, internalTransfer: transferKind },
    { ...legacySalary, id: 903 + i * 10, type: "expense", amount: 5 + i, description: `${prefix}_DEVUELTO_PERSONAL`, internalTransfer: transferKind },
  ] };
})];
const fixturesBefore = JSON.stringify(exportSpaces);
const legacyBudgets = { "2026-10": 50 };
const missingSelection = seleccionDePantalla(exportSpaces, "box:ya-no-disponible", "2026-10", "all");
assert.equal(missingSelection.espacio, undefined, "un espacio que desaparece no elige Personal por defecto");
assert.deepEqual(missingSelection.monthTx, []);
assert.doesNotMatch(read("screens/ExportPdfSheet.tsx"), /setEspacioId\(\s*\(\s*actual\s*\)\s*=>/,
  "el refresco no reemplaza una elección desaparecida por Personal sin otro toque del usuario");
assert.throws(() => handlerOriginal("screens/ExportPdfSheet.tsx", "construirHtml", {
  espacio: undefined, t: key => key,
}, read("screens/ExportPdfSheet.tsx"))(), /exportPdf\.spaceUnavailable/, "no se genera vista previa ni PDF de otro espacio");
for (const silent of [false, true]) {
  const calls = [], autoFired = { current: false };
  efectoAutomaticoOriginal({
    autoExport: true, autoFired, initialMonth: "2026-10", espaciosCargando: false, espacio: undefined,
    availableMonths: ["2026-10"], silent, recipientName: undefined, contactosCargados: true,
    showToast: value => calls.push(value), t: key => key, onClose: () => calls.push("cerrar"),
    confirmarEjecucionProgramada: () => { throw Error("no confirmar una ejecución sin el espacio pedido"); },
    handleExport: () => { throw Error("no exportar Personal como sustituto"); }, labelForMonth: key => key,
  })();
  assert.deepEqual(calls, silent ? ["exportPdf.spaceUnavailable", "cerrar"] : ["exportPdf.spaceUnavailable"]);
  assert.equal(autoFired.current, true, "el mismo intento ausente no se repite");
}
assert.equal(resumenFinanciero(legacyPersonal, "2026-10", legacyBudgets, []).available, 150);
const visibleFromHome = legacyPersonal.transactions.filter(row => showInPersonalRecent(row) && visiblePersonalMovement(row));
assert.deepEqual(movimientosParaReporte(legacyPersonal.transactions, "all"), visibleFromHome,
  "exportar Todos no recupera los recibos de Ahorro que Inicio ya reemplazó por su resumen");
assert.deepEqual(visibleFromHome.map(row => row.id), [legacySalary.id]);
const mixedVisibility = [...legacyPersonal.transactions, ...exportSpaces[1].transactions,
  { ...legacySalary, id: 999, hiddenFromHistory: true, description: "REGISTRO_YA_OCULTO" }];
assert.deepEqual(movimientosParaReporte(mixedVisibility, "all"), mixedVisibility.filter(row => showInPersonalRecent(row) && visiblePersonalMovement(row)),
  "la selección comparte la regla de Inicio sin quitar transferencias de Familia/Caja");
for (const chosen of exportSpaces) for (const type of ["all", "income", "expense"]) {
  const selection = seleccionDePantalla(exportSpaces, chosen.id, "2026-10", type);
  assert.equal(selection.espacio, chosen, "la elección original usa solo el espacio tocado");
  assert.equal(selection.movimientosDelEspacio, chosen.transactions);
  assert.ok(selection.monthTx.every(row => chosen.transactions.includes(row)), "no mezcla dinero de otros libros");
  if (chosen.kind === "personal") assert.deepEqual(selection.monthTx.map(row => row.id), type === "expense" ? [] : [legacySalary.id]);
  else assert.equal(selection.monthTx.length, type === "all" ? 4 : 1, "Familia/Cajas conservan sus transferencias en Todos y sus movimientos reales en cada filtro");
  // Las mismas filas que pasan a CSV/XLSX mantienen los montos como número.
  const total = selection.monthTx.reduce((sum, row) => sum + (row.type === "expense" ? -row.amount : row.amount), 0);
  const rows = filasDelReporte({ movimientos: selection.monthTx, total, nombresDeMes: monthNamesFor("es"), t: key => translations.es[key] ?? key });
  assert.deepEqual(rows.slice(1, -2).map(row => row[4]), selection.monthTx.map(row => row.description));
  assert.equal(rows.at(-1).at(-1), total);
  if (chosen.kind === "personal" && type === "all") assert.equal(total, 100, "CSV/XLSX ya no dan el falso total de 84 por los recibos antiguos");
  for (const mode of screenModes) {
    const html = handlerOriginal("screens/ExportPdfSheet.tsx", "construirHtml", {
      ...selection, htmlDelReporte, goals: [], selectedMk: "2026-10", exportType: type, charts: true, userName: "Prueba aislada",
      autoExport: mode.autoExport, scheduledRunKey: mode.scheduledRunKey, monthNames: monthNamesFor("es"),
      categoryBudgets: {}, fmt: formateadorDelEspacio(chosen), reportTitleFor: () => translations.es["exportPdf.pdfTitleAll"],
      selectedMonthLabel: "Octubre 2026", espacios: exportSpaces, budgets: legacyBudgets, carryoverCleared: [],
      resumenFinanciero, t: key => translations.es[key] ?? key,
    }, read("screens/ExportPdfSheet.tsx"))();
    const readable = text(html);
    assert.doesNotMatch(readable, /RECIBO_META_ANTIGUO|REGISTRO_YA_OCULTO/);
    for (const other of exportSpaces.filter(space => space !== chosen)) for (const tx of other.transactions) assert.ok(!readable.includes(tx.description), `${mode.name}/${chosen.kind}: sin filas de ${other.kind}`);
    for (const row of selection.monthTx) assert.ok(readable.includes(row.description));
    if (chosen.kind === "personal") {
      assert.ok(readable.includes("S/ 150") && readable.includes("S/ 50"), "saldo/presupuesto no cambian al retirar recibos del reporte");
      if (type !== "expense") assert.match(html, /Total:\s*<span[^>]*>S\/ 100<\/span>/, "el total de la lista coincide con el ingreso real");
    } else assert.ok(!html.includes("data-report-budget"), "el presupuesto de Personal no aparece en otros espacios");
  }
}
assert.equal(JSON.stringify(exportSpaces), fixturesBefore, "seleccionar y generar archivos no modifica los libros originales");
const savedGoal = { id: 50, creationId: "meta-prueba", name: "Reserva de prueba", target: 25, saved: 25, completed: true, createdDate: "2026-09-01" };
const goalCases = [[savedGoal], [{ ...savedGoal, target: 300, saved: 200, completed: false }]];
const goalsBefore = JSON.stringify(goalCases);
assert.equal(resumenFinanciero(legacyPersonal, "2026-10", legacyBudgets, [], [savedGoal]).available, 125,
  "alcanzar el objetivo no libera los S/25 apartados en Personal");
assert.equal(resumenFinanciero(legacyPersonal, "2026-10", legacyBudgets, [], goalCases[1]).available, -50,
  "el saldo libre negativo se conserva; no se fuerza a cero");
for (const mes of ["2026-09", "2026-10", "2026-11"]) {
  const regular = resumenFinanciero(legacyPersonal, mes, legacyBudgets, []);
  const reserved = resumenFinanciero(legacyPersonal, mes, legacyBudgets, [], [savedGoal]);
  assert.equal(reserved.available, saldoLibre(regular.available, totalApartado([savedGoal])), `${mes}: la misma reserva actual que muestra Inicio`);
  assert.equal(reserved.income, regular.income); assert.equal(reserved.expenses, regular.expenses);
  assert.equal(reserved.previousBalance, regular.previousBalance, "la reserva se resta una sola vez, no se vuelve a descontar del arrastre");
}
for (const chosen of exportSpaces) for (const goals of goalCases) {
  const base = resumenFinanciero(chosen, "2026-10", legacyBudgets, []);
  const reserved = resumenFinanciero(chosen, "2026-10", legacyBudgets, [], goals);
  const expected = chosen.kind === "personal" ? saldoLibre(base.available, totalApartado(goals)) : base.available;
  assert.equal(reserved.available, expected);
  if (chosen.kind !== "personal") assert.deepEqual(reserved, base, "las metas de Personal no descuentan dinero de Familia/Cajas");
  const format = formateadorDelEspacio(chosen), formatted = expected < 0 ? `-${format(Math.abs(expected))}` : format(expected);
  for (const mode of screenModes) {
    const selection = seleccionDePantalla(exportSpaces, chosen.id, "2026-10", "all");
    const html = handlerOriginal("screens/ExportPdfSheet.tsx", "construirHtml", {
      ...selection, htmlDelReporte, goals, selectedMk: "2026-10", exportType: "all", charts: false, userName: "Reserva de prueba",
      autoExport: mode.autoExport, scheduledRunKey: mode.scheduledRunKey, monthNames: monthNamesFor("es"),
      categoryBudgets: {}, fmt: format, reportTitleFor: () => translations.es["exportPdf.pdfTitleAll"],
      selectedMonthLabel: "Octubre 2026", espacios: exportSpaces, budgets: legacyBudgets, carryoverCleared: [],
      resumenFinanciero, t: key => translations.es[key] ?? key,
    }, read("screens/ExportPdfSheet.tsx"))();
    const available = html.match(/data-report-card="available"[\s\S]*?<\/section>/)?.[0] ?? "";
    assert.ok(text(available).includes(formatted), `${mode.name}/${chosen.kind}: el PDF usa el saldo libre real`);
    assert.doesNotMatch(text(html), /RECIBO_META_ANTIGUO/);
  }
}
assert.equal(JSON.stringify(goalCases), goalsBefore, "calcular el saldo exportado no modifica las metas");
for (const type of ["expense", "income", "all"]) for (const mode of screenModes) {
  const screenHtml = handlerOriginal("screens/ExportPdfSheet.tsx", "construirHtml", {
    htmlDelReporte, goals: [], monthTx: movimientosParaReporte(movimientos, type), movimientosDelEspacio: movimientosReales,
    selectedMk: "2026-10", exportType: type, charts: true, userName: "Cuenta de ejemplo",
    autoExport: mode.autoExport, scheduledRunKey: mode.scheduledRunKey,
    monthNames: monthNamesFor("es"), espacio: espacioReal, categoryBudgets: {}, fmt: fmtReal,
    reportTitleFor: () => translations.es[type === "expense" ? "exportPdf.pdfTitleExpenses" : type === "income" ? "exportPdf.pdfTitleIncome" : "exportPdf.pdfTitleAll"],
    selectedMonthLabel: "Octubre 2026", espacios: [], budgets, carryoverCleared: [],
    resumenFinanciero, t: key => translations.es[key] ?? key,
  }, read("screens/ExportPdfSheet.tsx"))();
  if (type !== "all") assert.ok(!text(screenHtml).includes(translations.es[type === "expense" ? "exportPdf.income" : "exportPdf.expenses"]));
  assert.ok(text(screenHtml).includes("S/ 1,999,202,250.75") && text(screenHtml).includes("S/ 1,999,202,020.75"));
  assert.ok(screenHtml.includes('data-report-layout="grouped"'), `${mode.name}/${type}: vista previa y PDF compartido usan el diseño agrupado`);
  const section = screenHtml.match(/<section data-report-summary\b[^>]*>([\s\S]*?)<\/section>/)[1];
  const fields = [...section.matchAll(/data-report-card="([^"]+)"/g)].map(match => match[1]);
  assert.equal(fields.length, new Set(fields).size, `${mode.name}/${type}: sin repetir cifras en el resumen`);
  assert.equal(fields.at(-1), "available");
}

// El proceso original de fondo llega al MISMO generador; IO completamente ficticio.
const source = read("utils/exportarEnFondo.ts");
for (const type of ["expense", "income"]) {
  let htmlGenerated;
  class File { constructor(...args) { this.uri = args.join("/"); } exists = true; size = 200; }
  class NoPdf extends Error {}
  const schedule = { enabled: true, type, charts: true, format: "pdf", destination: "folder", frequency: "daily", spaceId: "personal" };
  const keys = { transactions: "tx", profile: "profile", budgets: "budgets", carryoverCleared: "carry", categoryBudgets: "category", isPremium: "premium", goals: "goals" };
  const stored = { tx: movimientosReales, profile: { userLanguage: "es", userName: "Cuenta de ejemplo", userCurrency: "PEN" }, budgets, carry: [], category: {}, premium: true, goals: [] };
  const run = handlerOriginal("utils/exportarEnFondo.ts", "exportarEnFondo", {
    apuntar: async (result, _file, detail) => ({ resultado: result, detalle: detail }), loadSchedule: async () => schedule, reprogramar() {},
    loadJSON: async (key, fallback) => stored[key] ?? fallback, STORAGE_KEYS: keys,
    loadPrueba: async () => null, pruebaVigente: () => false, esDestinoAutomatico: () => true,
    isScheduledDay: () => true, claveDeEjecucion: () => "prueba", monthForSchedule: () => "2026-10",
    cargarEspaciosExportables: async () => [espacioReal],
    formateadorDelEspacio, translations, monthNamesFor,
    movimientosParaReporte,
    buildFileName: () => "ejemplo.pdf", toDateKey: () => "2026-10-14", File, Paths: { cache: "file:///fake" },
    htmlDelReporte, resumenFinanciero,
    htmlAPdfEnFondo: async html => { htmlGenerated = html; return "file:///fake/ejemplo.pdf"; },
    guardarEnCarpeta: async () => {}, flushPendingSaves: async () => {}, saveSchedule() {}, markExported() {},
    PdfEnFondoNoDisponible: NoPdf, PdfEnFondoSinRespuesta: NoPdf,
  }, source);
  const result = await run(false);
  assert.equal(result.resultado, "hecho", JSON.stringify(result));
  assert.ok(htmlGenerated.includes('data-report-layout="grouped"'), "el proceso automático real activa el diseño nuevo");
  assert.ok(!text(htmlGenerated).includes(translations.es[type === "expense" ? "exportPdf.income" : "exportPdf.expenses"]));
  assert.ok(text(htmlGenerated).includes("S/ 1,999,202,250.75") && text(htmlGenerated).includes("S/ 1,999,202,020.75"));
}
// Fondo REAL con todos los libros ofrecidos simultáneamente: elige por ID y
// no toma Personal por defecto cuando se solicita otra Familia/Caja. Se
// adaptan solo disco, permisos, conversión y entrega; no se crean archivos.
async function reporteDeEspacioEnFondo(spaceId, format = "pdf", type = "all", spaces = exportSpaces, goals = []) {
  let html, rows, saved = 0;
  const reads = [];
  class File { constructor(...args) { this.uri = args.join("/"); } exists = true; size = 200; }
  class NoPdf extends Error {}
  const schedule = { enabled: true, type, charts: true, format, destination: "folder", frequency: "daily", spaceId };
  const keys = { transactions: "tx", profile: "profile", budgets: "budgets", carryoverCleared: "carry", categoryBudgets: "category", isPremium: "premium", goals: "goals" };
  const stored = { tx: legacyPersonal.transactions, profile: { userLanguage: "es", userName: "Prueba aislada", userCurrency: "PEN" }, budgets: legacyBudgets, carry: [], category: {}, premium: true, goals };
  const before = JSON.stringify({ schedule, stored, spaces });
  const file = { uri: "file:///fake/espacio", fileName: `espacio.${format}`, mimeType: "application/octet-stream" };
  const run = handlerOriginal("utils/exportarEnFondo.ts", "exportarEnFondo", {
    apuntar: async (result, _file, detail) => ({ resultado: result, detalle: detail }), loadSchedule: async () => schedule, reprogramar() {},
    loadJSON: async (key, fallback) => { reads.push(key); return stored[key] ?? fallback; }, STORAGE_KEYS: keys,
    loadPrueba: async () => null, pruebaVigente: () => false, esDestinoAutomatico: () => true,
    isScheduledDay: () => true, claveDeEjecucion: () => "prueba", monthForSchedule: () => "2026-10",
    cargarEspaciosExportables: async () => spaces, formateadorDelEspacio, translations, monthNamesFor, movimientosParaReporte,
    buildFileName: () => file.fileName, toDateKey: () => "2026-10-22", File, Paths: { cache: "file:///fake" },
    htmlDelReporte, resumenFinanciero, filasDelReporte,
    htmlAPdfEnFondo: async value => { html = value; return "file:///fake/espacio.pdf"; },
    archivoExcel: value => { rows = value; return file; }, archivoCsv: value => { rows = value; return file; },
    guardarEnCarpeta: async () => { saved++; }, flushPendingSaves: async () => {}, saveSchedule() {}, markExported() {},
    PdfEnFondoNoDisponible: NoPdf, PdfEnFondoSinRespuesta: NoPdf,
  }, source);
  const result = await run(false);
  assert.equal(JSON.stringify({ schedule, stored, spaces }), before, "el reporte no reescribe datos ni cambia de espacio");
  return { result, html, rows, saved, reads };
}
for (const chosen of exportSpaces) for (const format of ["pdf", "csv", "xlsx"]) for (const type of ["all", "income", "expense"]) {
  const output = await reporteDeEspacioEnFondo(chosen.id, format, type);
  const selected = seleccionDePantalla(exportSpaces, chosen.id, "2026-10", type).monthTx;
  assert.equal(output.result.resultado, selected.length ? "hecho" : "sin-movimientos", JSON.stringify(output.result));
  assert.equal(output.saved, selected.length ? 1 : 0);
  if (!selected.length) { assert.equal(output.html, undefined); assert.equal(output.rows, undefined); continue; }
  if (format === "pdf") {
    const readable = text(output.html);
    assert.doesNotMatch(readable, /RECIBO_META_ANTIGUO/);
    for (const tx of selected) assert.ok(readable.includes(tx.description), `${chosen.kind}/${type}: conserva su fila en PDF de fondo`);
    for (const other of exportSpaces.filter(space => space !== chosen)) for (const tx of other.transactions) assert.ok(!readable.includes(tx.description), `${chosen.kind}/${type}: fondo no mezcla ${other.kind}`);
    if (chosen.kind === "personal") {
      assert.equal(output.reads.filter(key => key === "goals").length, 1, "el PDF de Personal carga su reserva del almacenamiento real adaptado");
      assert.ok(readable.includes("S/ 150"), "fondo conserva el saldo real de Personal");
      assert.match(output.html, /Total:\s*<span[^>]*>S\/ 100<\/span>/, "fondo no suma recibos de ahorro al total");
    } else {
      assert.ok(!output.html.includes("data-report-budget"));
      assert.ok(!output.reads.includes("goals"), "Familia/Cajas no consultan las metas de Personal");
    }
  } else {
    assert.deepEqual(output.rows.slice(1, -2).map(row => row[4]), selected.map(row => row.description), `${format}: las filas pertenecen solo al espacio seleccionado`);
    assert.equal(output.rows.at(-1).at(-1), selected.reduce((sum, tx) => sum + (tx.type === "expense" ? -tx.amount : tx.amount), 0));
    if (chosen.kind === "personal") assert.equal(output.rows.at(-1).at(-1), 100);
  }
}
for (const chosen of exportSpaces) for (const goals of goalCases) {
  const output = await reporteDeEspacioEnFondo(chosen.id, "pdf", "all", exportSpaces, goals);
  assert.equal(output.result.resultado, "hecho", JSON.stringify(output.result));
  const expected = resumenFinanciero(chosen, "2026-10", legacyBudgets, [], goals).available;
  const format = formateadorDelEspacio(chosen), formatted = expected < 0 ? `-${format(Math.abs(expected))}` : format(expected);
  const available = output.html.match(/data-report-card="available"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.ok(text(available).includes(formatted), `${chosen.kind}: fondo conserva la reserva y coincide con la vista previa`);
  assert.equal(output.reads.includes("goals"), chosen.kind === "personal");
}
const unavailable = await reporteDeEspacioEnFondo("box:ya-no-disponible");
assert.equal(unavailable.result.resultado, "espacio-no-disponible", "un espacio ausente no se sustituye por Personal");
assert.equal(unavailable.saved, 0);
const goalsOnly = await reporteDeEspacioEnFondo("personal", "pdf", "all", [{ ...legacyPersonal, transactions: legacyReceipts }]);
assert.equal(goalsOnly.result.resultado, "sin-movimientos", "los recibos antiguos solos no generan un archivo automático vacío");
assert.equal(goalsOnly.saved, 0);
assert.equal(JSON.stringify(exportSpaces), fixturesBefore, "los recorridos completos conservan todos los datos originales");
assert.equal(JSON.stringify(goalCases), goalsBefore);
console.log("Reportes originales: sin recibos antiguos de Ahorro, ingreso100/total100/saldo150 y reserva real (cumplida/negativa/otros meses), cuatro espacios aislados sin fallback silencioso; manual/automático y PDF/CSV/XLSX con transferencias reales conservadas. Ausencia de espacio no confirma ni envía otro libro. Cuatro bases, cifras completas, seis monedas/tres idiomas. IO y React adaptados; Android y entrega real aparte.");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_EXPORT_SUMMARY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const root = process.cwd();
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const originalFiles = new Set(["utils/reportePdfDatos.ts", "utils/exportPdfHtml.ts", "utils/reporteArchivo.ts", "utils/exportSpaces.ts", "utils/finances.ts", "utils/saldoAnterior.ts", "constants/i18n.ts"]);
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
const { moneyFromUnits, moneyUnits } = await original("utils/moneyPrecision.ts");
const sumAmounts = items => moneyFromUnits(items.reduce((sum, item) => sum + moneyUnits(item.amount), 0n));
const resumenFinanciero = handlerOriginal("utils/exportSpaces.ts", "resumenFinanciero", { availablePersonalBalance, saldoAnteriorDe, moneyFromUnits, moneyUnits, sumAmounts }, read("utils/exportSpaces.ts"));
const formateadorDelEspacio = handlerOriginal("utils/exportSpaces.ts", "formateadorDelEspacio", { formatAmount: fmtExact, currencySymbolFor }, read("utils/exportSpaces.ts"));
const selectionFile = /export function movimientosParaReporte\(/.test(read("utils/reporteArchivo.ts")) ? "utils/reporteArchivo.ts" : "utils/exportSelection.ts";
const movimientosParaReporte = handlerOriginal(selectionFile, "movimientosParaReporte", {}, read(selectionFile));
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
for (const type of ["expense", "income", "all"]) for (const mode of screenModes) {
  const screenHtml = handlerOriginal("screens/ExportPdfSheet.tsx", "construirHtml", {
    htmlDelReporte, monthTx: movimientosParaReporte(movimientos, type), movimientosDelEspacio: movimientosReales,
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
  const keys = { transactions: "tx", profile: "profile", budgets: "budgets", carryoverCleared: "carry", categoryBudgets: "category", isPremium: "premium" };
  const stored = { tx: movimientosReales, profile: { userLanguage: "es", userName: "Cuenta de ejemplo", userCurrency: "PEN" }, budgets, carry: [], category: {}, premium: true };
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
console.log("PDF original manual/automático: pantalla real manual, automática abierta y programada con resumen agrupado, cuatro bases, campos únicos, saldo/presupuesto reales y filtros; cifras completas, seis monedas y tres idiomas. Fondo original con IO ficticio; conversión Android/entrega reales aparte.");

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
const originalFiles = new Set(["utils/reportePdfDatos.ts", "utils/exportPdfHtml.ts", "utils/reporteArchivo.ts", "constants/i18n.ts"]);
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
const resumenFinanciero = handlerOriginal("utils/exportSpaces.ts", "resumenFinanciero", { availablePersonalBalance, saldoAnteriorDe }, read("utils/exportSpaces.ts"));
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
const grandes = [19_992_020.75, 999_999_999.99, 9_000_000_000_000, 19_999_202_020_020.75];
for (const currency of ["PEN", "USD", "EUR", "JPY", "CLP", "BHD"]) {
  const format = formateadorDelEspacio({ ...espacioReal, currency });
  for (const amount of grandes) {
    const html = htmlDelReporte(data("all", "es", { movimientos: [{ ...movimientos[0], amount }], resumen: { ...resumenReal, available: -amount, budget: amount }, fmt: format }));
    assert.ok(text(html).includes(format(amount)) && text(html).includes(format(-amount)));
    assert.doesNotMatch(text(html), /\d\s+(?:[KMBT]|mil|bill\.)\b/);
  }
}

// ConstruirHtml de la pantalla REAL, no una copia del recorrido manual.
for (const type of ["expense", "income"]) {
  const manual = handlerOriginal("screens/ExportPdfSheet.tsx", "construirHtml", {
    htmlDelReporte, monthTx: movimientosParaReporte(movimientos, type), movimientosDelEspacio: movimientosReales,
    selectedMk: "2026-10", exportType: type, charts: true, userName: "Cuenta de ejemplo",
    monthNames: monthNamesFor("es"), espacio: espacioReal, categoryBudgets: {}, fmt: fmtReal,
    reportTitleFor: () => translations.es[type === "expense" ? "exportPdf.pdfTitleExpenses" : "exportPdf.pdfTitleIncome"],
    selectedMonthLabel: "Octubre 2026", espacios: [], budgets, carryoverCleared: [],
    resumenFinanciero, t: key => translations.es[key] ?? key,
  }, read("screens/ExportPdfSheet.tsx"))();
  assert.ok(!text(manual).includes(translations.es[type === "expense" ? "exportPdf.income" : "exportPdf.expenses"]));
  assert.ok(text(manual).includes("S/ 1,999,202,250.75") && text(manual).includes("S/ 1,999,202,020.75"));
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
  assert.ok(!text(htmlGenerated).includes(translations.es[type === "expense" ? "exportPdf.income" : "exportPdf.expenses"]));
  assert.ok(text(htmlGenerated).includes("S/ 1,999,202,250.75") && text(htmlGenerated).includes("S/ 1,999,202,020.75"));
}
console.log("PDF original manual/automático: tarjetas únicas de color, saldo/presupuesto reales en cada filtro, cifras completas, seis monedas, tres idiomas, método de pago y puntos azules. IO ficticio; conversión Android/entrega reales aparte.");

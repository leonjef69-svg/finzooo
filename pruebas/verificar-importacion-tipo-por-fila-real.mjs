import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
const require = createRequire(import.meta.url);
function load(file) {
  const build = buildSync({ stdin: { contents: read(file), sourcefile: file, resolveDir: path.dirname(path.resolve(file)), loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: { "@": process.cwd(), "react-native": path.resolve("pruebas/stubs/rn.ts"), "lucide-react-native": path.resolve("pruebas/stubs/lucide.ts"), "expo-font": path.resolve("pruebas/stubs/font.ts"), "@expo/vector-icons": path.resolve("pruebas/stubs/vectoricons.ts") } });
  const module = { exports: {} };
  new Function("module", "exports", "require", build.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
const engine = load("utils/importEngine.ts");
const fileText = ["Fecha;Descripcion;Monto;Tipo;Categoria;Referencia",
  "05/10/2026;Sueldo;50;;;REF-SUELDO", "06/10/2026;Almuerzo;20;;;REF-ALMUERZO",
  "07/10/2026;Ingreso claro;6.50;Ingreso;;REF-CLARO", "08/10/2026;Sin nombre;7;;;REF-OTRO"].join("\n");
const initial = engine.parseStatement(fileText, undefined, { dateOrder: "DMY" });
assert.equal(initial.ok, true);
assert.equal(initial.rows.filter(row => row.typePending).length, 3, "Tres importes sin tipo requieren tres elecciones, no una para todo el archivo");
// La regresión falla aquí contra dfbc4a97 por el comportamiento anterior,
// antes de pedir cualquier auxiliar que no existía entonces.
assert.deepEqual(initial.rows.map(row => row.sourceRow), [2, 3, 4, 5]);
const one = engine.parseStatement(fileText, undefined, { dateOrder: "DMY", rowTypes: { 2: "income" } });
assert.equal(one.rows[0].type, "income"); assert.equal(one.rows[1].typePending, true);
assert.equal(one.rows[3].typePending, true); assert.equal(one.rows[2].typePending, undefined);
assert.equal(one.needsTypeChoice, true);
const choices = { 2: "income", 3: "expense", 5: "income" };
const ready = engine.parseStatement(fileText, undefined, { dateOrder: "DMY", rowTypes: choices });
assert.equal(ready.needsTypeChoice, false);
assert.deepEqual(ready.rows.map(row => row.type), ["income", "expense", "income", "income"]);
assert.deepEqual(ready.rows.map(row => row.amount), [50, 20, 6.5, 7]);
assert.equal(engine.parseStatement(fileText, undefined, { dateOrder: "MDY", rowTypes: choices }).rows[0].type, "income", "Cambiar fecha conserva las elecciones");
assert.equal(engine.parseStatement("Fecha;Monto\n2026-10-25;-10\n2026-10-25;+15", undefined).needsTypeChoice, false, "Signos inequívocos no añaden preguntas");

const batch = load("utils/importCandidates.ts"), dupes = load("utils/duplicates.ts"), categories = load("utils/importCategory.ts");
const i18n = load("constants/i18n.ts");
const translations = i18n.TRANSLATIONS ?? i18n.translations;
const dict = translations?.es;
assert.ok(dict, "Usar el catálogo español original");
const t = (key, params = {}) => Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), dict[key] ?? key);
const categoryFor = raw => categories.categoryForImportedRow(raw, t, {});
let id = 200;
const make = raw => ({ id: ++id, type: raw.type, amount: raw.amount, category: categoryFor(raw), date: raw.date, method: "cash", description: raw.description, notes: "", merchant: raw.merchant, reference: raw.reference, origin: "imported" });
let candidates = batch.buildImportCandidates(initial.rows, new Map(), new Set(), new Map(), make);
const ids = candidates.map(c => c.tx.id);
assert.throws(() => batch.resolveImportCandidates(candidates, new Map()), /import-type-unresolved/);
for (const [source, type] of Object.entries(choices)) candidates = batch.classifyImportRow(candidates, [], Number(source), type, new Map(), categoryFor).candidates;
assert.equal(batch.pendingImportTypeCount(candidates, []), 0); assert.deepEqual(candidates.map(c => c.tx.id), ids);
assert.deepEqual(candidates.map(c => c.tx.type), ["income", "expense", "income", "income"]);
assert.equal(candidates[0].tx.category, "salario"); assert.equal(candidates[1].tx.type, "expense");

const duplicateFile = engine.parseStatement("Fecha;Descripcion;Monto;Referencia\n2026-10-25;Pago;10;OP1\n2026-10-25;Pago;10;OP1");
let twins = batch.buildImportCandidates(duplicateFile.rows, new Map(), new Set(), new Map(), make);
twins = batch.classifyImportRow(twins, [], 2, "income", new Map(), categoryFor).candidates;
twins = batch.classifyImportRow(twins, [], 3, "income", new Map(), categoryFor).candidates;
assert.equal(twins[1].inFile, true); assert.equal(batch.resolveImportCandidates(twins, new Map()).toAdd.length, 1);
twins = batch.classifyImportRow(twins, [], 3, "expense", new Map(), categoryFor).candidates;
assert.equal(batch.resolveImportCandidates(twins, new Map()).toAdd.length, 2, "Cambiar dirección vuelve a comprobar duplicados");
const undated = engine.parseStatement("Fecha;Descripcion;Monto\n;Sin fecha;10");
assert.equal(batch.pendingImportTypeCount([], undated.rowsSinFecha), 1);
assert.equal(batch.classifyImportRow([], undated.rowsSinFecha, 2, "income", new Map(), categoryFor).undated[0].typePending, false);

// Ejecutar la pantalla y su fila originales con React/selector/archivo/guardado
// adaptados; no se conecta con una cuenta ni con Android desde esta prueba.
let hookIndex = 0, hooks = [], nextFile = fileText, tree = [], commits = 0, saved = [];
const React = { createElement(type, props, ...children) { return { type, props: { ...props, children } }; }, Fragment: "Fragment" };
const react = { ...React,
  useState(initial) { const i = hookIndex++; if (!(i in hooks)) hooks[i] = typeof initial === "function" ? initial() : initial;
    return [hooks[i], value => { hooks[i] = typeof value === "function" ? value(hooks[i]) : value; }]; },
  useRef(initial) { const i = hookIndex++; return hooks[i] ??= { current: initial }; },
  useMemo(fn) { hookIndex++; return fn(); }, useEffect() { hookIndex++; },
};
const rn = Object.fromEntries(["View", "Text", "ScrollView", "TouchableOpacity", "ActivityIndicator"].map(k => [k, k]));
const categoryInfo = load("constants/categories.ts");
const data = { t, fmt: amount => `S/ ${amount.toFixed(2)}`, monthNames: i18n.MONTH_NAMES_BY_LANG.es, showToast() {}, transactions: [], merchantLearned: {},
  userCurrency: "PEN", learnMerchantCategory() {}, async commitImport(rows) { commits++; saved = rows; return rows.length; } };
class File { constructor(uri) { this.uri = uri; this.exists = true; this.size = nextFile.length; } async text() { return nextFile; } delete() {} }
const dependencies = new Map([
  ["react", react], ["react-native", rn], ["react-native-safe-area-context", { useSafeAreaInsets: () => ({ bottom: 0 }) }],
  ["expo-document-picker", { getDocumentAsync: async () => ({ canceled: false, assets: [{ uri: "file:///cache/test.csv", name: "test.csv", mimeType: "text/csv" }] }) }],
  ["expo-file-system", { File, Paths: { cache: { uri: "file:///cache/" } } }],
  ["lucide-react-native", Object.fromEntries(["FileUp", "CheckCircle2", "AlertTriangle", "Copy", "X", "Landmark"].map(k => [k, k]))],
  ["@/utils/pdfExtract", {}], ["@/utils/excelExtract", { looksLikeExcel: () => false }], ["nativewind", { useColorScheme: () => ({ colorScheme: "light" }) }],
  ["@/utils/pendingImport", { setPendingImport() {} }], ["@/contexts/AppDataContext", { useAppData: () => data }], ["@/utils/id", { nextId: () => ++id }],
  ["@/constants/accounts", { guessAccount: () => undefined }], ["@/constants/categories", categoryInfo], ["@/utils/format", { fmtDate: date => date }],
  ["@/utils/importEngine", engine], ["@/utils/importCategory", categories], ["@/utils/duplicates", dupes], ["@/utils/importCandidates", batch],
  ["@/screens/DuplicateReview", { __esModule: true, default: () => null }], ["@/modules/incoming-file", { puedeElegirArchivo: false }],
  ["@/utils/importLimits", { isImportTooLarge: () => false }], ["@/utils/storage", { getAccountStorageSession: () => 1 }],
]);
function ui(file) {
  const module = { exports: {} };
  const require = spec => {
    if (spec === "@/components/ImportPreviewRow") return ui("components/ImportPreviewRow.tsx");
    if (dependencies.has(spec)) return dependencies.get(spec);
    throw Error(`Dependencia sin adaptar: ${spec}`);
  };
  vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, require, React, console, Date, Set, Map });
  return module.exports;
}
const Screen = ui("screens/ImportSheet.tsx").default;
function expand(node) {
  if (Array.isArray(node)) return node.flatMap(expand);
  if (node == null || typeof node === "boolean") return [];
  if (typeof node !== "object") return [node];
  if (typeof node.type === "function") return expand(node.type(node.props));
  return [{ ...node, children: expand(node.props?.children) }];
}
const flat = nodes => nodes.flatMap(node => [node, ...flat(node.children ?? [])]);
const text = nodes => nodes.map(node => typeof node === "object" ? text(node.children ?? []) : String(node)).join("");
function render() { hookIndex = 0; tree = expand(Screen({ onClose() {} })); }
function button(label) { const b = flat(tree).find(n => n.type === "TouchableOpacity" && (n.props.accessibilityLabel === label || text(n.children) === label || flat(n.children).some(child => child.type === "Text" && text(child.children) === label))); assert.ok(b, `Botón visible: ${label}`); return b; }
async function click(label) { const b = button(label); assert.ok(!b.props.disabled, `Botón habilitado: ${label}`); await b.props.onPress(); render(); }
const rowLabel = (row, description, type) => t("importSheet.rowTypeChoice", { row, description, type: t(type === "income" ? "addSheet.income" : "addSheet.expense") });
async function open(csv) { hooks = []; nextFile = csv; render(); await click(t("importSheet.pickFile")); }
const importLabel = () => t("importSheet.importAll");
await open(fileText);
assert.ok(button(importLabel()).props.disabled, "Fecha ambigua bloquea guardar");
await click(t("importSheet.dateDMY"));
assert.ok(text(tree).includes(t("importSheet.pendingTypes", { count: 3 })));
assert.ok(button(importLabel()).props.disabled);
const unresolvedAmount = flat(tree).find(n => n.type === "Text" && text(n.children) === "S/ 50.00");
assert.ok(unresolvedAmount); assert.ok(!unresolvedAmount.props.className.includes("text-rose"), "Sin gasto supuesto en rojo");
await click(rowLabel(2, "Sueldo", "income")); assert.ok(button(importLabel()).props.disabled);
assert.equal(button(rowLabel(3, "Almuerzo", "expense")).props.accessibilityState.checked, false);
await click(rowLabel(3, "Almuerzo", "expense")); assert.ok(button(importLabel()).props.disabled);
await click(rowLabel(5, "Sin nombre", "income")); assert.equal(button(importLabel()).props.disabled, false);
assert.ok(text(tree).includes("+S/ 50.00")); assert.ok(text(tree).includes("−S/ 20.00"));
await click(t("importSheet.dateMDY"));
assert.equal(button(rowLabel(2, "Sueldo", "income")).props.accessibilityState.checked, true);
assert.equal(button(rowLabel(3, "Almuerzo", "expense")).props.accessibilityState.checked, true);
assert.ok(text(tree).includes("2026-05-10"));
await click(importLabel()); assert.equal(commits, 1);
assert.deepEqual(saved.map(row => row.type), ["income", "expense", "income", "income"]);
assert.equal(saved.reduce((n, r) => n + (r.type === "income" ? r.amount : -r.amount), 0), 43.5);
assert.ok(saved.every(row => !("typePending" in row) && !("sourceRow" in row)), "Metadatos de revisión no se guardan");

await open("Fecha;Descripcion;Monto\n;Sin fecha;10");
await click(rowLabel(2, "Sin fecha", "income")); assert.ok(button(importLabel()).props.disabled, "Sin fecha no hay candidatos guardables");
await click(t("importSheet.pickMonthAction"));
const today = new Date(); await click(`${data.monthNames[today.getMonth()]} ${today.getFullYear()}`);
assert.equal(button(rowLabel(2, "Sin fecha", "income")).props.accessibilityState.checked, true);
assert.equal(button(importLabel()).props.disabled, false);

const large = ["Fecha;Descripcion;Monto;Tipo", ...Array.from({ length: 101 }, (_, n) => `2026-10-25;Fila ${n + 1};${n + 1};${n === 100 ? "" : "Gasto"}`)].join("\n");
await open(large); assert.ok(button(importLabel()).props.disabled, "Fila 101 pendiente bloquea aunque no esté en primera página");
assert.equal(flat(tree).filter(n => n.props?.accessibilityRole === "radio").length, 0);
await click(t("importSheet.nextRows"));
await click(rowLabel(102, "Fila 101", "income")); assert.equal(button(importLabel()).props.disabled, false);
await click(t("importSheet.previousRows")); await click(t("importSheet.nextRows"));
assert.equal(button(rowLabel(102, "Fila 101", "income")).props.accessibilityState.checked, true);
assert.equal(commits, 1, "Solo el guardado ficticio autorizado se ejecuta, nunca las vistas previas");
console.log("Tipos por fila: lector, categorías, duplicados y JSX/acciones originales; elecciones independientes, fechas/mes, bloqueo, paginación 101 filas y lote ficticio correctos. React/IO adaptados; Android aparte.");

import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";

const categories = [
  { id: "transporte", label: "Transporte", color: "yellow", icon: () => null },
  { id: "comida", label: "Comida", color: "green", icon: () => null },
  { id: "compras", label: "Compras", color: "violet", icon: () => null },
  { id: "otros", label: "Otros", color: "teal", icon: () => null },
];
const budgetChanges = [];
const transactions = [{ id: "keep", type: "expense", amount: 10 }];
let transactionCategorySheetProps;
const data = {
  t(key, vars = {}) {
    if (key === "categoryBudgets.usedPercent") return `${vars.percent}% usado`;
    if (key === "categoryBudgets.usedPercentMoreThan999") return "Más de 999% usado";
    if (key === "categoryBudgets.limitFor") return `Límite de ${vars.category}`;
    return ({
      "categoryBudgets.title": "Presupuestos por categoría",
      "categoryBudgets.subtitle": "Ponle un límite mensual a las categorías.",
      "categoryBudgets.limit": "Límite",
      "categoryBudgets.noLimit": "Sin límite",
      "categoryBudgets.nueva": "Nueva categoría",
      "categoryBudgets.addCategory": "Categoría",
      "categoryBudgets.search": "Buscar categoría...",
      "categoryBudgets.category": "categoría",
      "categoryBudgets.categories": "categorías",
      "categoryBudgets.tapToEdit": "Toca para editar",
      "categoryBudgets.monthlyLimit": "Límite mensual",
      "categoryBudgets.overLimit": "Límite superado",
      "categoryBudgets.nearLimit": "Cerca del límite",
      "categoryBudgets.noSearchResults": "No hay categorías con ese nombre.",
      "common.saveChanges": "Guardar cambios",
    })[key] ?? key;
  },
  fmt(amount) {
    return `S/ ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}`;
  },
  userCurrency: "PEN",
  userLanguage: "es",
  monthNames: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  showToast() {},
  categoryBudgets: { transporte: 100, comida: 50, compras: 50 },
  categorySpent: { transporte: 943_854_353_434, comida: 50, compras: 35 },
  updateCategoryBudgets(value) { budgetChanges.push(value); },
  categoriasPropias: [],
  transactions,
};

const React = {
  createElement(type, props, ...children) {
    return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
  },
};
let hookIndex = 0;
const hooks = [];
const react = {
  ...React,
  useState(initial) {
    const index = hookIndex++;
    if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], (next) => { hooks[index] = typeof next === "function" ? next(hooks[index]) : next; }];
  },
  useMemo(fn) { hookIndex++; return fn(); },
  useEffect() { hookIndex++; },
};
const rn = {
  Keyboard: { dismiss() {} },
  View: "View", Text: "Text", TextInput: "TextInput", TouchableOpacity: "TouchableOpacity", ScrollView: "ScrollView",
  useWindowDimensions: () => ({ width: 390, height: 850, fontScale: 1 }),
};
const aliases = new Map([
  ["react", react],
  ["react-native", rn],
  ["react-native-reanimated", { __esModule: true, default: { View: "AnimatedView" } }],
  ["react-native-safe-area-context", { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }],
  ["nativewind", { useColorScheme: () => ({ colorScheme: "light" }) }],
  ["lucide-react-native", { AlertTriangle: "AlertTriangle", Pencil: "Pencil", Plus: "Plus", Search: "Search", TrendingDown: "TrendingDown", TrendingUp: "TrendingUp" }],
  ["@/constants/categories", {
    gastosDisponibles: () => categories,
    catInfo: (id) => categories.find((category) => category.id === id) ?? categories.at(-1),
  }],
  ["@/constants/style", { CARD_SHADOW: {} }],
  ["@/constants/currencies", { currencySymbolFor: () => "S/" }],
  ["@/contexts/AppDataContext", { useAppData: () => data }],
  ["@/utils/amount", {
    amountInputError: () => null,
    parseAmountInput: (value) => Number(value) || 0,
    sanitizeSafeAmountInput: (value) => value,
  }],
  ["@/utils/keyboard", { useKeyboardAnimatedPadding: () => ({ animatedPaddingStyle: {} }) }],
  ["@/components/BackButton", { __esModule: true, default: (props) => React.createElement("TouchableOpacity", props, "Atrás") }],
  ["@/components/TransactionCategorySheet", { __esModule: true, default: (props) => { transactionCategorySheetProps = props; return null; } }],
  ["@/constants/colors", { COLOR_HEX_600: { yellow: "#d97706", green: "#059669", violet: "#7c3aed", teal: "#0d9488" } }],
  ["@/utils/format", {
    fmtExact: (amount) => data.fmt(amount),
    monthKey: (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`,
  }],
  ["@/utils/reportCalendar", { dailyCalendarTotals: () => [] }],
  ...["DonutChart", "DailyActivityCalendar", "MonthlyActivityComparison", "MonthSelector"].map((name) => [
    `@/components/${name}`,
    { __esModule: true, default: () => null },
  ]),
]);

function loadUi(file) {
  let source = fs.readFileSync(file, "utf8");
  if (file === "screens/CategoryBudgets.tsx" && process.env.FINO_CATEGORY_BUDGETS_BASELINE) {
    assert.match(process.env.FINO_CATEGORY_BUDGETS_BASELINE, /^[a-f\d]{7,40}$/);
    source = execFileSync("git", ["show", `${process.env.FINO_CATEGORY_BUDGETS_BASELINE}:${file}`], { encoding: "utf8" });
  }
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier === "@/components/IconBadge") return loadUi("components/IconBadge.tsx");
    if (aliases.has(specifier)) return aliases.get(specifier);
    throw new Error(`Dependencia no adaptada: ${specifier}`);
  };
  vm.runInNewContext(js, { module, exports: module.exports, require, React, console, Math, Map, Set });
  return module.exports;
}

let tree;
function expand(node) {
  if (Array.isArray(node)) return node.flatMap(expand);
  if (node == null || typeof node === "boolean") return [];
  if (typeof node !== "object") return [node];
  if (typeof node.type === "function") return expand(node.type(node.props));
  return [{ ...node, children: expand(node.props?.children) }];
}
function render() {
  hookIndex = 0;
  const Screen = loadUi("screens/CategoryBudgets.tsx").default;
  tree = expand(Screen({ onBack() {} }));
}
function flatten(nodes) { return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]); }
function node(id) { return flatten(tree).find((item) => item.props?.testID === id); }
function labelText(nodes) {
  return nodes.map((item) => typeof item === "object" ? labelText(item.children ?? []) : String(item)).join("").replace(/\s+/g, " ").trim();
}

render();
const all = flatten(tree);
assert.equal(all.filter((item) => item.props?.testID?.startsWith("category-budget-row-")).length, 4, "cada categoría mantiene su tarjeta y su campo para fijar el límite");

assert(node("category-budget-add"), "la acción para agregar categoría queda junto al título");
assert(node("category-budget-search"), "se puede buscar una categoría por nombre");
assert.equal(labelText([node("category-budget-status-transporte")]), "Límite superado", "superar el límite muestra un aviso breve");
const redStatusText = flatten(node("category-budget-status-transporte").children).find((item) => item.type === "Text");
assert(String(redStatusText.props.className).includes("text-rose-600"), "el exceso se identifica en rojo");
assert.equal(labelText([node("category-budget-status-comida")]), "Cerca del límite", "llegar al 90% o más sin superar muestra aviso ámbar");
const amberStatusText = flatten(node("category-budget-status-comida").children).find((item) => item.type === "Text");
assert(String(amberStatusText.props.className).includes("text-amber-700"), "acercarse al límite se identifica en ámbar");
assert.equal(node("category-budget-status-compras"), undefined, "si el gasto está normal no añade texto ni color de aviso");
assert.equal(flatten(tree).some((item) => String(item.props?.testID ?? "").includes("progress")), false, "la pantalla de edición no repite las barras de la consulta de presupuestos");
const spentAmount = node("category-budget-spent-transporte");
assert.equal(labelText([spentAmount]), "S/ 943,854,353,434", "el monto gastado se conserva y no se encoge");
assert.equal(spentAmount.props.numberOfLines, 2, "un gasto largo puede ocupar dos líneas sin reducir la letra");
assert.equal(labelText([node("category-budget-limit-label-transporte")]), "Límite S/ 100", "el límite queda separado del gasto y alineado a la izquierda");
data.categorySpent.compras = 45;
render();
assert.equal(labelText([node("category-budget-status-compras")]), "Cerca del límite", "el aviso ámbar comienza exactamente al 90%");
data.categorySpent.compras = 35;
render();

const comidaRow = node("category-budget-row-comida");
const icon = flatten(comidaRow.children).find((item) => String(item.props?.className).includes("rounded-2xl") && String(item.props?.className).includes("bg-green-100"));
assert(icon, "el icono conserva su fondo en un cuadrado redondeado de color");
assert.equal(icon.props.style.width, 38);

node("category-budget-add").props.onPress();
render();
assert.equal(transactionCategorySheetProps.initialCreate, true, "agregar categoría abre directamente su formulario en el panel compartido");
assert.equal(transactionCategorySheetProps.type, "expense");
transactionCategorySheetProps.onClose();
render();

const search = node("category-budget-search");
search.props.onChangeText("Comida");
render();
assert.equal(flatten(tree).filter((item) => item.props?.testID?.startsWith("category-budget-row-")).length, 1, "la búsqueda reduce la lista a la categoría coincidente");
assert(node("category-budget-row-comida"));
node("category-budget-search").props.onChangeText("");
render();

const categoryScreenHooks = hooks.slice();
hooks.length = 0;
hookIndex = 0;
const Reports = loadUi("screens/Reports.tsx").default;
tree = expand(Reports({ transactions: [], month: { y: 2026, m: 9 }, setMonth() {} }));
assert.equal(node("report-category-budget-transporte")?.type, "View", "la tarjeta rediseñada también aparece en Reportes");
assert.equal(node("report-category-budgets-title").props.className.includes("text-[15px]"), true, "el título de presupuestos se lee con mayor tamaño");
assert(String(node("report-category-budget-name-transporte").props.className).includes("text-[13px]"), "el nombre de categoría se lee con mayor tamaño");
assert(String(node("report-category-budget-limit-transporte").props.className).includes("text-[13px]"), "el texto de límite se lee con mayor tamaño");
assert.equal(labelText([node("report-category-budget-spent-transporte")]), "S/ 943,854,353,434", "Reportes separa el gasto del límite sin encoger cifras largas");
assert.equal(node("report-category-budget-spent-transporte").props.numberOfLines, 2);
assert.match(labelText([node("report-category-budget-limit-transporte")]), /^Límite S\/ 100$/);
assert.equal(labelText([node("report-category-budget-percent-transporte")]), "Más de 999% usado");
assert.equal(node("report-category-budget-progress-fill-transporte").props.style.width, "100%");
assert.equal(node("report-category-budget-progress-fill-transporte").props.style.backgroundColor, "#d97706");
assert(String(node("report-category-budget-percent-transporte").props.className).includes("text-rose-600"));
assert.equal(node("report-category-budget-progress-fill-comida").props.style.backgroundColor, "#059669");
assert(String(node("report-category-budget-percent-comida").props.className).includes("text-amber-600"));
assert.equal(node("report-category-budget-progress-fill-compras").props.style.width, "70%");
assert.equal(node("report-category-budget-progress-fill-compras").props.style.backgroundColor, "#7c3aed");
assert(String(node("report-category-budget-percent-compras").props.className).includes("text-emerald-700"));
const reportIcon = flatten(node("report-category-budget-comida").children).find((item) => String(item.props?.className).includes("rounded-2xl") && String(item.props?.className).includes("bg-green-100"));
assert(reportIcon, "Reportes muestra el icono en su cuadro redondeado de color");
assert.equal(reportIcon.props.style?.width ?? reportIcon.props.size, 38, "el icono de categoría gana tamaño sin perder su recuadro");
assert.equal(node("report-category-budget-transporte").props.style.borderBottomColor, "#94a3b8", "el divisor entre categorías tiene contraste visible");
assert.equal(node("report-category-budget-transporte").props.style.borderBottomWidth, 1.5, "el divisor entre categorías tiene grosor visible");

hooks.splice(0, hooks.length, ...categoryScreenHooks);
render();
node("category-budget-edit-transporte").props.onPress();
render();
const limitInput = node("category-budget-limit-transporte");
assert.equal(limitInput.props.value, "100");
assert.match(limitInput.props.accessibilityLabel, /Transporte/);
limitInput.props.onChangeText("150");
render();
const save = node("category-budget-save");
assert(save, "se conserva la acción de guardar los límites");
save.props.onPress();
assert.equal(budgetChanges.length, 1);
assert.equal(budgetChanges[0].transporte, 150, "guardar conserva la edición del límite");
assert.equal(JSON.stringify(transactions), '[{"id":"keep","type":"expense","amount":10}]', "la pantalla no altera los movimientos");

console.log("Presupuestos: búsqueda, edición directa, avisos al 90% o al superar el límite, creación en panel compartido y consulta de Reportes sin cambios.");

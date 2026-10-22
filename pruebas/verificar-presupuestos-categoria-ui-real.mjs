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
  ["lucide-react-native", { Plus: "Plus", TrendingDown: "TrendingDown", TrendingUp: "TrendingUp" }],
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
  ["@/components/TransactionCategorySheet", { __esModule: true, default: () => null }],
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

const overAmount = node("category-budget-spent-transporte");
assert.equal(labelText([overAmount]), "S/ 943,854,353,434", "el monto grande conserva todas sus cifras y no se encoge");
assert.equal(overAmount.props.numberOfLines, 2, "el gasto largo puede ocupar dos líneas sin reducir el tamaño de letra");
assert(String(overAmount.props.className).includes("text-rose-600"), "el importe se destaca cuando supera el límite");
assert.equal(labelText([node("category-budget-percent-transporte")]), "Más de 999% usado", "el porcentaje extremo no desborda la tarjeta");
assert.equal(node("category-budget-progress-fill-transporte").props.style.width, "100%", "la barra se limita al ancho de la tarjeta");
assert.equal(node("category-budget-progress-fill-transporte").props.style.backgroundColor, "#d97706", "la barra usa el color de su categoría");
assert(String(node("category-budget-percent-transporte").props.className).includes("text-rose-600"), "superar el límite se indica en rojo junto al porcentaje");

assert.equal(labelText([node("category-budget-percent-comida")]), "100% usado");
assert.equal(node("category-budget-progress-fill-comida").props.style.backgroundColor, "#059669", "la barra conserva el color de su categoría al llegar al límite");
assert(String(node("category-budget-percent-comida").props.className).includes("text-amber-600"), "llegar exactamente al límite se indica en ámbar");
assert.equal(labelText([node("category-budget-percent-compras")]), "70% usado");
assert.equal(node("category-budget-progress-fill-compras").props.style.width, "70%");
assert.equal(node("category-budget-progress-fill-compras").props.style.backgroundColor, "#7c3aed", "la barra usa el color propio de la categoría Compras");
assert(String(node("category-budget-percent-compras").props.className).includes("text-emerald-700"), "estar debajo del límite se indica en verde");
assert.equal(node("category-budget-progress-otros"), undefined, "sin límite no se dibuja una barra falsa");

const comidaCard = node("category-budget-row-comida");
const icon = flatten(comidaCard.children).find((item) => String(item.props?.className).includes("rounded-2xl") && String(item.props?.className).includes("bg-green-100"));
assert(icon, "el icono conserva su fondo en un cuadrado redondeado de color");
assert.equal(icon.props.style.width, 38);

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
const limitInput = node("category-budget-limit-transporte");
assert.equal(limitInput.props.value, "100");
assert.match(limitInput.props.accessibilityLabel, /Transporte/);
limitInput.props.onChangeText("150");
render();
const save = flatten(tree).find((item) => item.type === "TouchableOpacity" && labelText([item]) === "Guardar cambios");
assert(save, "se conserva la acción de guardar los límites");
save.props.onPress();
assert.equal(budgetChanges.length, 1);
assert.equal(budgetChanges[0].transporte, 150, "guardar conserva la edición del límite");
assert.equal(JSON.stringify(transactions), '[{"id":"keep","type":"expense","amount":10}]', "la pantalla no altera los movimientos");

console.log("Presupuestos en Ajustes y Reportes: título, nombres, límite e iconos legibles; divisor visible, barras con color de categoría y edición sin tocar movimientos.");

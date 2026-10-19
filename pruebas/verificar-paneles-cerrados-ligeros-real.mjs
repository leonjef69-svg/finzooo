import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

const read = createSourceReader();
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function load(file, require) {
  const module = { exports: {} };
  vm.runInNewContext(compile(read(file)), { module, exports: module.exports, require });
  return module.exports;
}
const pure = new Map();
function original(file) {
  if (!pure.has(file)) pure.set(file, load(file, name => {
    assert.ok(name.startsWith("@/utils/"), name);
    return original(name.slice(2) + ".ts");
  }));
  return pure.get(file);
}
function hooks() {
  let cursor = 0;
  const slots = [];
  return {
    begin() { cursor = 0; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useMemo(build, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) slots[index] = { deps, value: build() };
      return slots[index].value;
    },
  };
}
const flatten = node => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
const texts = node => !node || typeof node === "boolean" ? [] : typeof node === "object" ? Array.isArray(node) ? node.flatMap(texts) : texts(node.props?.children) : [String(node)];
const element = (type, props) => ({ type, props: props ?? {} });
const months = ["2026-09", "2026-10"];
const context = { t: key => key, fmtCompact: n => `S/ ${n}`, userCountry: "PE", showToast() {},
  transactions: [{ id: 1, date: "2026-09-01", type: "income", amount: 100 }, { id: 2, date: "2026-10-01", type: "expense", amount: 20 }],
  budgets: { "2026-10": 50 }, carryoverCleared: [] };
const before = JSON.stringify(context);
let generated = 0, totalsCalls = 0, categoryCalls = 0, memberComparisons = 0;
const jsx = (type, props) => { generated++; return element(type, props); };
const ui = new Proxy({ Platform: { OS: "android" }, useWindowDimensions: () => ({ height: 800 }) }, { get: (target, key) => target[key] ?? key });
let runtime = hooks();
const finances = original("utils/finances.ts");
function dependencies(name) {
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (name === "react") return runtime;
  if (name === "react-native" || name === "lucide-react-native") return ui;
  if (name === "nativewind") return { useColorScheme: () => ({ colorScheme: "light" }) };
  if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ bottom: 0 }) };
  if (name.endsWith("AppDataContext")) return { useAppData: () => context };
  if (name.endsWith("finances")) return { ...finances, totalsForMonth: (...args) => { totalsCalls++; return finances.totalsForMonth(...args); } };
  if (["linkedTransfers", "presupuestoMensual", "saldoAnterior"].some(file => name.endsWith(file))) return original(name.slice(2) + ".ts");
  if (name.endsWith("categories")) return { ingresosDisponibles: () => { categoryCalls++; return []; }, gastosDisponibles: () => { categoryCalls++; return []; } };
  if (name.endsWith("countries")) return { COUNTRIES: [] };
  if (name.endsWith("currencies")) return { currencySymbolFor: () => "S/" };
  return { default: name.split("/").at(-1) };
}
const Picker = load("components/MonthSelector.tsx", dependencies).default;
const changes = [], props = { month: { y: 2026, m: 9 }, months, monthNames: Array.from({ length: 12 }, (_, i) => `Mes ${i + 1}`), onChange: month => changes.push(month), showMovementCount: true };
const render = () => { runtime.begin(); return Picker(props); };
let tree = render();
assert.equal(totalsCalls, 0, "volver a Personal no debe calcular los saldos de un selector cerrado");
assert.equal(flatten(tree).filter(n => n.type === "PrivateModal").length, 0);
assert.equal(JSON.stringify(context), before, "montar el selector no altera sus datos");
flatten(tree).find(n => n.type === "TouchableOpacity").props.onPress();
tree = render();
assert.equal(totalsCalls, months.length);
assert.ok(texts(tree).includes("S/ 100")); assert.ok(texts(tree).includes("S/ 130"), "las fórmulas originales incluyen el arrastre y presupuesto");
const visibleCalls = totalsCalls;
render(); assert.equal(totalsCalls, visibleCalls, "abrir no recalcula sin cambios");
context.transactions = [...context.transactions, { id: 3, date: "2026-10-02", type: "income", amount: 7 }];
tree = render(); assert.ok(texts(tree).includes("S/ 137"), "una llegada real actualiza el selector abierto");
const monthButton = flatten(tree).find(n => n.type === "TouchableOpacity" && n.props.accessibilityState?.selected === true);
monthButton.props.onPress(); tree = render();
assert.deepEqual(JSON.parse(JSON.stringify(changes)), [{ y: 2026, m: 9 }]);
assert.equal(flatten(tree).filter(n => n.type === "PrivateModal").length, 0);
const closedCalls = totalsCalls;
context.budgets = { "2026-10": 80 }; render();
assert.equal(totalsCalls, closedCalls, "cerrado tampoco procesa cambios financieros que aún no muestra");
flatten(render()).find(n => n.type === "TouchableOpacity").props.onPress();
assert.ok(texts(render()).includes("S/ 167"), "reabrir usa los datos actuales, no una copia financiera antigua");
const currentData = JSON.stringify(context); render();
assert.equal(JSON.stringify(context), currentData, "presentar meses no escribe ni modifica dinero");

// El aviso de borrar solo necesita preparar su explicación cuando se abre.
// Ejecutar las expresiones originales comprueba la selección enviada al aviso.
const homeFile = "screens/Home.tsx", homeTree = ts.createSourceFile(homeFile, read(homeFile), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let checkedMessages = 0;
function inspect(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(homeTree) === "ConfirmDialog") {
    const attr = name => node.attributes.properties.find(p => p.name?.text === name)?.initializer?.expression;
    const visible = attr("visible")?.getText(homeTree);
    if (["confirmandoBorrarTodo", "confirmandoSeleccionados"].includes(visible)) {
      const expression = attr("message").getText(homeTree), calls = [];
      const scope = { confirmandoBorrarTodo: false, confirmandoSeleccionados: false,
        movimientosBorrablesDelMes: [{ id: 1 }, { id: 2 }], seleccionadosBorrables: [2],
        removalMessage: ids => { calls.push(Array.from(ids)); return "aviso"; } };
      const evaluate = () => vm.runInNewContext(compile(`(${expression})`), scope);
      assert.equal(evaluate(), ""); assert.equal(calls.length, 0, "aviso cerrado no recorre su historial");
      scope[visible] = true; assert.equal(evaluate(), "aviso");
      assert.deepEqual(calls, visible === "confirmandoBorrarTodo" ? [[1, 2]] : [[2]], "el aviso abierto conserva los IDs exactos y su explicación");
      checkedMessages++;
    }
  }
  ts.forEachChild(node, inspect);
}
inspect(homeTree); assert.equal(checkedMessages, 2);

for (const file of ["SpaceMovementSheet", "SpaceInvitationSheet", "SpaceMembersSheet"]) {
  runtime = hooks();
  const Component = load(`components/${file}.tsx`, dependencies).default;
  const name = () => ({ localeCompare() { memberComparisons++; return 0; } });
  const members = [{ uid: "A", rol: "member", nombre: name() }, { uid: "B", rol: "member", nombre: name() }];
  const input = { visible: false, code: "ABCD2345", loading: false, kind: "family", type: "ingreso", currency: "PEN", familyName: "Familia", members, onClose() {} };
  runtime.begin(); generated = 0; categoryCalls = 0; memberComparisons = 0;
  assert.equal(Component(input), null, `${file}: no crea el árbol oculto`);
  assert.equal(generated, 0); assert.equal(categoryCalls, 0); assert.equal(memberComparisons, 0);
  runtime.begin(); generated = 0;
  const openTree = Component({ ...input, visible: true });
  assert.ok(openTree); assert.ok(generated > 0, `${file}: sigue disponible cuando el usuario lo abre`);
  if (file === "SpaceInvitationSheet") {
    runtime.begin(); assert.equal(Component({ ...input, visible: true, code: "" }), null);
    runtime.begin(); assert.ok(flatten(Component({ ...input, visible: true, code: "", loading: true })).some(n => n.type === "ActivityIndicator"));
  }
}
console.log("JSX/cálculos originales: selector cerrado sin saldos ni filas; apertura actualizada y fórmulas conservadas. Formularios, invitación y miembros cerrados sin árbol/categorías/ordenación; siguen abriendo y preparando códigos. React/Android adaptados.");

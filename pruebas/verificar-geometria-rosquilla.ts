import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript") as typeof import("typescript");

// Ejecuta el componente original y sus cuentas. React/Android se sustituyen
// por un árbol de elementos y cajas de hooks; no es una captura ni TalkBack.
// Para comprobar la regresión: FINO_TEST_DONUT_WHEEL_BASELINE=<hash Git>.
const baseline = process.env.FINO_TEST_DONUT_WHEEL_BASELINE;
if (baseline && !/^[a-f\d]{7,40}$/i.test(baseline)) throw new Error("Se requiere una revisión Git válida");
const source = (file: string) => baseline
  ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" })
  : fs.readFileSync(file, "utf8");

type Element = {
  type: string | ((...args: unknown[]) => unknown);
  props: Record<string, any>;
  children: unknown[];
};
type Item = { id: string; name: string; value: number; color: string; Icon: () => null };
let hooks: unknown[] = [];
let cursor = 0;
const React = {
  createElement: (type: Element["type"], props: Element["props"] | null, ...children: unknown[]) => ({
    type, props: props ?? {}, children,
  }),
};
function moduleOriginal(file: string, dependencies: Record<string, unknown>) {
  const code = ts.transpileModule(source(file), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} as Record<string, any> };
  new Function("React", "module", "exports", "require", code)(React, module, module.exports, (name: string) => {
    if (!(name in dependencies)) throw new Error(`Dependencia no adaptada: ${name}`);
    return dependencies[name];
  });
  return module.exports;
}
const geometry = moduleOriginal("utils/donutGeometry.ts", {});
const DonutChart = moduleOriginal("components/DonutChart.tsx", {
  react: {
    useState: (initial: unknown) => {
      const slot = cursor++;
      if (!(slot in hooks)) hooks[slot] = typeof initial === "function" ? initial() : initial;
      return [hooks[slot], (value: unknown) => {
        hooks[slot] = typeof value === "function" ? value(hooks[slot]) : value;
      }];
    },
    useMemo: (calculate: () => unknown) => calculate(),
    useCallback: (callback: unknown) => callback,
  },
  "react-native": Object.fromEntries(["Text", "TouchableOpacity", "Pressable", "View"].map(name => [name, name])),
  "react-native-svg": { __esModule: true, default: "Svg", Circle: "Circle", Path: "Path" },
  nativewind: { useColorScheme: () => ({ colorScheme: "light" }) },
  "@/utils/donutGeometry": geometry,
  "@/components/EntryUI": { ENTRY_FONT: { medium: "test-medium", bold: "test-bold" } },
  "@/contexts/AppDataContext": { useAppData: () => ({ t: (key: string) => ({
    "reports.lessThanOnePercent": "menos de 1 por ciento",
    "reports.moreThan99Percent": "más de 99 por ciento",
  } as Record<string, string>)[key] ?? key }) },
}).default;
function flatten(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (node == null || typeof node !== "object" || !("type" in node)) return [];
  const element = node as Element;
  return [element, ...element.children.flatMap(flatten)];
}
function text(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return (node as Element).children.map(text).join("");
}
const style = (value: unknown): Record<string, any> => Array.isArray(value)
  ? Object.assign({}, ...value.map(style))
  : value && typeof value === "object" ? value : {};
const makeData = (values: number[]): Item[] => values.map((value, index) => ({
  id: `categoria-${index}`, name: `Categoría ${index}`, value,
  color: `hsl(${index * 31}, 80%, 40%)`, Icon: () => null,
}));
const formatValue = (value: number) => `Bs ${value.toFixed(2)}`;
function render(data: Item[], width = 340) {
  cursor = 0;
  return flatten(DonutChart({ data, width, formatValue, totalLabel: "Total gastado" }));
}
const bubbles = (nodes: Element[]) => nodes.filter(node => node.type === "TouchableOpacity"
  && node.props.accessibilityRole === "button" && String(node.props.accessibilityLabel).includes("Categoría"));
const segments = (nodes: Element[]) => nodes.filter(node => node.type === "Circle" && typeof node.props.onPress === "function");
const texts = (nodes: Element[]) => nodes.filter(node => node.type === "Text").map(text);
const categoryButton = (nodes: Element[], index: number) => bubbles(nodes)
  .find(node => String(node.props.accessibilityLabel).startsWith(`Categoría ${index}:`));

const data = makeData([1_234_567, 123_456, 11_122, 11_111, 1_234, 1_234, 123, 11]);
const total = data.reduce((sum, item) => sum + item.value, 0);
const original = structuredClone(data.map(({ Icon: _Icon, ...item }) => item));
let nodes = render(data);
assert.ok(texts(nodes).includes("Total gastado"), "la rueda muestra qué total está representando en su centro");
assert.ok(texts(nodes).includes(formatValue(total)), "el centro recibe el total real y usa la moneda elegida en Reportes");
assert.equal(bubbles(nodes).length, data.length, "ninguna categoría pequeña se oculta o se agrupa");
assert.equal(nodes.filter(node => node.type === "Path" && node.props.fill === "none").length, 0,
  "la rueda elimina los conectores que se cruzaban entre categorías");

const small = categoryButton(nodes, 7);
assert.ok(small, "la categoría menor a 1% sigue teniendo un botón propio");
assert.ok(String(small.props.accessibilityLabel).includes("menos de 1"), "su etiqueta accesible conserva el porcentaje real");
small.props.onPress();
nodes = render(data);
assert.ok(texts(nodes).includes(data[7].name), "al tocar el icono, el centro identifica la categoría");
assert.ok(texts(nodes).includes(formatValue(11)), "la selección muestra exactamente su monto, sin ampliar el dato");
assert.equal(categoryButton(nodes, 7)?.props.accessibilityState.selected, true, "el icono comunica su selección");
assert.ok(segments(nodes)[7].props.strokeOpacity > segments(nodes)[0].props.strokeOpacity,
  "el bloque elegido resalta frente a los demás");
categoryButton(nodes, 7)?.props.onPress();
nodes = render(data);
assert.ok(texts(nodes).includes(formatValue(total)), "el segundo toque al mismo icono restaura el total");
assert.equal(categoryButton(nodes, 7)?.props.accessibilityState.selected, false);
segments(nodes)[1].props.onPress();
nodes = render(data);
assert.ok(texts(nodes).includes(data[1].name), "tocar el bloque de la rosquilla también selecciona su categoría");
assert.ok(texts(nodes).includes(formatValue(data[1].value)));
segments(nodes)[1].props.onPress();
nodes = render(data);
assert.ok(texts(nodes).includes(formatValue(total)), "el segundo toque al mismo bloque restaura el total");
categoryButton(nodes, 7)?.props.onPress();
const changed = data.map(item => item.id === data[7].id ? { ...item, value: 17 } : item);
nodes = render(changed);
assert.ok(texts(nodes).includes(formatValue(17)), "una categoría seleccionada refleja el monto actualizado");
nodes = render(data.slice(0, 7));
assert.ok(texts(nodes).includes(formatValue(total - 11)), "si desaparece la categoría, el centro vuelve al total vigente");
assert.ok(bubbles(nodes).every(node => node.props.accessibilityState.selected === false), "no queda una selección fantasma");

// La presencia pareja corresponde a los botones. Las porciones de dinero no
// se inflan, incluso con una categoría miles de millones de veces mayor.
hooks = [];
const extremeData = makeData([9_999_999_999, 8, 5, 3, 1]);
nodes = render(extremeData);
const realTotal = extremeData.reduce((sum, item) => sum + item.value, 0);
const arcs = segments(nodes);
assert.equal(arcs.length, extremeData.length);
for (let index = 0; index < arcs.length; index++) {
  const arc = arcs[index].props;
  const dash = Number(String(arc.strokeDasharray).split(/[ ,]+/)[0]);
  const renderedFraction = dash / (2 * Math.PI * arc.r);
  const trueFraction = extremeData[index].value / realTotal;
  assert.ok(Math.abs(renderedFraction - trueFraction) < 0.005,
    `el bloque ${index} respeta su proporción financiera, con solo la separación entre bloques`);
}
assert.deepEqual(data.map(({ Icon: _Icon, ...item }) => item), original, "seleccionar nunca modifica movimientos o montos");

// Composición real a partir del JSX: mismo tamaño, dentro de la tarjeta y sin
// colisiones. Con muchas categorías se permite crecer de alto, no encogerlas.
for (const width of [280, 340, 380]) {
  for (const count of [1, 2, 4, 8, 10, 20, 30]) {
    hooks = [];
    nodes = render(makeData(Array.from({ length: count }, (_, index) => index + 1)), width);
    const root = style(nodes[0].props.style);
    const buttons = bubbles(nodes).map(node => style(node.props.style));
    assert.equal(buttons.length, count);
    assert.ok(buttons.every(button => button.width === buttons[0].width && button.height === buttons[0].height),
      "los iconos tienen el mismo espacio visual, aunque sus montos sean distintos");
    assert.ok(buttons[0].width >= 52, `${count} categorías: los botones no se vuelven diminutos`);
    if (count === 8 && width >= 340) {
      const radii = buttons.map(button => Math.hypot(button.left + button.width / 2 - width / 2,
        button.top + button.height / 2 - root.height / 2));
      assert.ok(Math.max(...radii) - Math.min(...radii) < 0.01,
        "las ocho categorías de la captura conservan la misma distancia al centro");
      const gaps = buttons.map((button, index) => {
        const next = buttons[(index + 1) % buttons.length];
        return Math.hypot(button.left - next.left, button.top - next.top);
      });
      assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.01,
        "las ocho categorías tienen espacio uniforme alrededor del círculo");
    }
    for (const button of buttons) {
      assert.ok(button.left >= -0.001 && button.top >= -0.001 && button.left + button.width <= width + 0.001
        && button.top + button.height <= root.height + 0.001, `${width}px/${count}: ninguna categoría se recorta`);
    }
    for (let first = 0; first < buttons.length; first++) {
      for (let second = first + 1; second < buttons.length; second++) {
        const a = buttons[first], b = buttons[second];
        const distance = Math.hypot(a.left - b.left, a.top - b.top);
        assert.ok(distance >= a.width + 7.9, `${width}px/${count}: dos categorías no chocan (${distance.toFixed(2)}px)`);
      }
    }
  }
}

hooks = [];
nodes = render(makeData([42]));
assert.ok(texts(nodes).includes("100%"), "una sola categoría conserva el 100% real");
assert.ok(texts(nodes).includes(formatValue(42)));
hooks = [];
assert.equal(render([]).length, 0, "sin movimientos no se dibuja una rueda ni se inventa un total");
assert.equal(geometry.textoPorcentajeRosquilla(9_999_999_999, 10_000_000_000), ">99%");
assert.equal(geometry.textoPorcentajeRosquilla(1, 10_000_000_000), "<1%");

console.log("✓ Rueda original: botones iguales y separados, proporciones/moneda reales, selección por icono/bloque y retorno al total. Android visual pendiente.");

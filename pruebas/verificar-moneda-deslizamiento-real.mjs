import { entryUIFixture } from "./helpers/entry-ui-fixture.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { buildSync } from "esbuild";

// Ejecuta el JSX original; comprueba la configuración entregada a Android,
// catálogo/búsqueda y acciones. No simula el dibujado nativo ni cuenta FPS.
const baseline = process.env.FINO_CURRENCY_SCROLL_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const file = "screens/CurrencyPicker.tsx";
const source = baseline
  ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" })
  : fs.readFileSync(file, "utf8");
function originalModule(entry) {
  const code = buildSync({ entryPoints: [entry], bundle: true, write: false,
    format: "cjs", platform: "node", target: "node22", tsconfig: "tsconfig.json" }).outputFiles[0].text;
  const module = { exports: {} };
  new Function("module", "exports", code)(module, module.exports);
  return module.exports;
}
const search = originalModule("utils/catalogSearch.ts");
const flags = originalModule("utils/decorativeFlags.ts");
const catalog = search.filterCurrencies("", "es", key => key);
assert.equal(catalog.length, 155);
const flatten = node => !node || typeof node !== "object" ? []
  : [node, ...(node.children ?? []).flat(Infinity).flatMap(flatten)];

async function fixture(configured) {
  let query = "", refIndex = 0, focus;
  const refs = [], changes = [], backs = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useMemo: callback => callback(), useCallback: callback => callback,
    useState: () => [query, value => { query = value; }],
    useRef: initial => refs[refIndex++] ??= { current: initial },
  };
  const rn = Object.fromEntries(["FlatList", "Image", "StatusBar", "Text", "TextInput", "TouchableOpacity", "View"].map(name => [name, name]));
  const imports = {
    "@/components/EntryUI": entryUIFixture,
    react: React, "react-native": rn,
    "expo-router": { useFocusEffect: callback => { focus = callback; } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
    "lucide-react-native": { Check: "Check", Search: "Search" },
    "@/components/BackButton": { default: "BackButton" },
    "@/utils/catalogSearch": search, "@/utils/decorativeFlags": flags,
    "@/contexts/AppDataContext": { useAppData: () => ({ userLanguage: "es",
      hasOnboarded: configured, t: key => key, showToast: () => {} }) },
  };
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exported = {};
  new Function("React", "exports", "require", code)(React, exported, name => {
    if (name.endsWith(".png")) return name;
    assert.ok(name in imports, `Import no adaptado: ${name}`);
    return imports[name];
  });
  function render() {
    refIndex = 0;
    const tree = exported.default({ current: "PEN", onBack: () => backs.push("back"), onSelect: id => changes.push(id) });
    const nodes = flatten(tree);
    return { list: nodes.find(node => node.type === "FlatList"),
      input: nodes.find(node => node.type === "TextInput") };
  }
  let screen = render(); focus();
  const props = screen.list.props;
  assert.equal(props.removeClippedSubviews, false, "Moneda no retira filas nativas por recorte: evita desapariciones que requieren otro gesto");
  assert.ok(props.initialNumToRender >= 20 && props.initialNumToRender <= 30, "prepara una reserva inicial limitada de filas");
  assert.equal(props.windowSize, 21, "prepara una ventana estándar para evitar huecos en el catálogo corto");
  assert.ok(props.maxToRenderPerBatch >= 20 && props.maxToRenderPerBatch <= 30);
  assert.ok(props.updateCellsBatchingPeriod > 0 && props.updateCellsBatchingPeriod <= 20);
  assert.equal(props.getItemLayout, undefined, "no inventa alturas fijas que recorten letras grandes/dos líneas");
  assert.deepEqual(props.data.map(item => item.id), catalog.map(item => item.id));
  assert.equal(new Set(props.data.map(props.keyExtractor)).size, 155);
  const pen = props.renderItem({ item: props.data.find(item => item.id === "PEN") });
  assert.equal(pen.props.accessibilityState.selected, true);
  assert.equal(pen.props.disabled, configured);
  for (const filter of ["USD", "Sol", "inexistente-98765", ""]) {
    screen.input.props.onChangeText(filter); screen = render();
    assert.deepEqual(screen.list.props.data.map(item => item.id), search.filterCurrencies(filter, "es", key => key).map(item => item.id));
  }
  const usd = screen.list.props.renderItem({ item: screen.list.props.data.find(item => item.id === "USD") });
  await usd.props.onPress();
  assert.deepEqual(changes, configured ? [] : ["USD"]);
  assert.deepEqual(backs, configured ? [] : ["back"]);
}
await fixture(false);
await fixture(true);
console.log("Moneda: JSX original, recorte desactivado, reserva acotada, 155 opciones, búsqueda y moneda fija conservados; dibujo Android se verifica aparte.");

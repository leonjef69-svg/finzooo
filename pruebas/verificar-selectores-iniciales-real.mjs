import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { buildSync } from "esbuild";

const baseline = process.env.FINO_INITIAL_SELECTORS_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const selectedCase = process.env.FINO_INITIAL_SELECTORS_CASE ?? "all";
if (!["all", "language", "currency"].includes(selectedCase)) throw Error("Caso inválido.");
const read = file => baseline
  ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" })
  : fs.readFileSync(file, "utf8");
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...(node.children ?? []).flat(Infinity).flatMap(flatten)];
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function originalLanguages() {
  const source = read("constants/i18n.ts"), tree = ts.createSourceFile("constants/i18n.ts", source, ts.ScriptTarget.Latest, true);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "LANGUAGES") initializer = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(initializer);
  const compiled = ts.transpileModule(`const languages = ${initializer};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(`${compiled}; return languages;`)();
}
const languages = originalLanguages();
assert.deepEqual(languages.map(item => item.id), ["es", "en", "pt"]);
let decorativeFlags = {};
if (!baseline) {
  const compiled = buildSync({ entryPoints: ["utils/decorativeFlags.ts"], bundle: true, write: false,
    format: "cjs", platform: "node", target: "node22", tsconfig: "tsconfig.json" }).outputFiles[0].text;
  const original = { exports: {} };
  new Function("module", "exports", compiled)(original, original.exports);
  decorativeFlags = original.exports;
}

function fixture(kind, configured = false) {
  const changes = [], backs = [], errors = [], refs = [];
  let index = 0, focusCallback, focusCleanup;
  let selectBehavior = () => {}, backBehavior = () => {};
  const context = { userLanguage: "es", hasOnboarded: configured,
    t: key => key, showToast: message => errors.push(message) };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useMemo: callback => callback(), useState: initial => [initial, () => {}],
    useCallback: callback => callback,
    useRef: initial => refs[index++] ??= { current: initial },
  };
  const rn = Object.fromEntries(["FlatList", "Image", "StatusBar", "Text", "TextInput", "TouchableOpacity", "View", "ScrollView"].map(name => [name, name]));
  const currencies = [{ id: "PEN", name: "Sol", symbol: "S/" }, { id: "USD", name: "Dollar", symbol: "$" }, { id: "EUR", name: "Euro", symbol: "€" }];
  function moduleOriginal(file, imports) {
    const code = ts.transpileModule(read(file), { fileName: file, compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const exported = {};
    new Function("React", "exports", "require", code)(React, exported, name => {
      if (name.endsWith(".png")) return name;
      if (!(name in imports)) throw Error(`Import no adaptado: ${name}`);
      return imports[name];
    });
    return exported;
  }
  const common = { react: React, "react-native": rn, "@/contexts/AppDataContext": { useAppData: () => context },
    "lucide-react-native": { Check: "Check", Search: "Search", ChevronLeft: "ChevronLeft" },
    nativewind: { useColorScheme: () => ({ colorScheme: "light" }) },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
    "expo-router": { useFocusEffect: callback => { focusCallback = callback; } },
    "@/utils/decorativeFlags": decorativeFlags,
  };
  const BackButton = moduleOriginal("components/BackButton.tsx", common).default;
  const Root = moduleOriginal(`screens/${kind === "language" ? "Language" : "Currency"}Picker.tsx`, {
    ...common, "@/components/BackButton": { default: BackButton }, "@/constants/i18n": { LANGUAGES: languages },
    "@/utils/catalogSearch": { filterCurrencies: () => currencies },
  }).default;
  const props = { current: kind === "language" ? "es" : "PEN",
    onSelect: (...args) => { changes.push(args); return selectBehavior(...args); },
    onBack: () => { backBehavior(); backs.push("back"); } };
  function render() {
    index = 0;
    const tree = Root(props), nodes = flatten(tree);
    const back = nodes.find(node => node.type === BackButton);
    assert.ok(back, "El botón BackButton original sigue conectado");
    const backTree = BackButton(back.props);
    const list = nodes.find(node => node.type === "FlatList");
    const rows = list ? list.props.data.map(item => list.props.renderItem({ item }))
      : nodes.filter(node => node.type === "TouchableOpacity");
    return { tree, rows, pressBack: backTree.props.onPress };
  }
  let screen = render();
  function focus() { focusCleanup = focusCallback?.(); }
  function blur() { focusCleanup?.(); focusCleanup = null; }
  focus();
  return { context, props, changes, backs, errors, render, focus, blur,
    get screen() { return screen; }, rerender() { screen = render(); return screen; },
    setSelect: behavior => { selectBehavior = behavior; }, setBack: behavior => { backBehavior = behavior; } };
}

for (const kind of ["language", "currency"].filter(value => selectedCase === "all" || selectedCase === value)) {
  {
    const f = fixture(kind), rows = f.screen.rows;
    const first = rows[0].props.onPress(), second = rows[1].props.onPress(); f.screen.pressBack();
    await Promise.all([first, second]);
    assert.equal(f.changes.length, 1, `${kind}: dos filas rápidas no realizan dos selecciones`);
    assert.equal(f.changes[0].length, 1, "Solo se entrega el ID elegido, no país/otra moneda");
    assert.equal(f.backs.length, 1, `${kind}: fila y BackButton comparten una sola vuelta`);
    f.blur(); f.focus(); await rows[1].props.onPress();
    assert.equal(f.changes.length, 2, "Al volver al selector se puede elegir otra vez");
    assert.equal(f.backs.length, 2);
  }
  {
    const f = fixture(kind); f.screen.pressBack(); await f.screen.rows[1].props.onPress();
    assert.deepEqual(f.changes, [], "Atrás primero impide seleccionar durante la salida");
    assert.equal(f.backs.length, 1);
  }
  {
    const f = fixture(kind), pending = deferred(); f.setSelect(() => pending.promise);
    const first = f.screen.rows[0].props.onPress(); await f.screen.rows[1].props.onPress(); f.screen.pressBack();
    assert.equal(f.backs.length, 0, "La vuelta espera que termine la elección");
    assert.equal(f.changes.length, 1); pending.resolve(); await first;
    assert.equal(f.backs.length, 1);
  }
  for (const fail of [() => { throw Error("selección"); }, async () => { throw Error("selección"); }]) {
    const f = fixture(kind); f.setSelect(fail);
    await assert.doesNotReject(async () => f.screen.rows[0].props.onPress());
    assert.deepEqual(f.backs, [], "Un fallo no cierra el selector");
    assert.deepEqual(f.errors, ["setup.selectionFailed"]);
    f.setSelect(() => {}); await f.screen.rows[1].props.onPress();
    assert.equal(f.changes.length, 2, "Un fallo libera el intento sin salir/volver a entrar");
    assert.equal(f.backs.length, 1);
  }
  {
    const f = fixture(kind), pending = deferred(); f.setSelect(() => pending.promise);
    const first = f.screen.rows[0].props.onPress(); f.blur(); pending.resolve(); await first;
    assert.deepEqual(f.backs, [], "Una elección atrasada no cierra otra pantalla");
    assert.deepEqual(f.errors, []);
    f.focus(); f.setSelect(() => {}); await f.screen.rows[1].props.onPress(); assert.equal(f.backs.length, 1);
  }
  {
    const f = fixture(kind), pending = deferred(); f.setSelect(() => pending.promise);
    const first = f.screen.rows[0].props.onPress(); f.blur(); pending.reject(Error("respuesta vieja")); await first;
    assert.deepEqual(f.errors, [], "Una respuesta antigua no muestra error en otra pantalla");
    assert.deepEqual(f.backs, []);
  }
  {
    const f = fixture(kind); f.setBack(() => { throw Error("ruta"); });
    await assert.doesNotReject(async () => f.screen.rows[0].props.onPress());
    assert.deepEqual(f.errors, ["setup.selectionFailed"]);
    f.setBack(() => {}); await f.screen.rows[1].props.onPress(); assert.equal(f.backs.length, 1);
  }
  if (kind === "currency") {
    const fixed = fixture(kind, true); assert.equal(fixed.screen.rows.length, 1);
    assert.equal(fixed.screen.rows[0].props.disabled, true);
    await fixed.screen.rows[0].props.onPress();
    assert.deepEqual(fixed.changes, [], "La protección vive también dentro del manejador de moneda fija");
    assert.deepEqual(fixed.backs, []);
    const changing = fixture(kind), oldRow = changing.screen.rows[1];
    changing.context.hasOnboarded = true; changing.rerender(); await oldRow.props.onPress();
    assert.deepEqual(changing.changes, [], "Un callback viejo tampoco cambia moneda después de configurarla");
  } else {
    const f = fixture(kind, true); await f.screen.rows[1].props.onPress();
    assert.deepEqual(f.changes, [["en"]], "Idioma sigue editable en cuenta configurada");
  }
  if (!baseline) {
    const f = fixture(kind);
    for (const row of f.screen.rows) {
      const flags = flatten(row).filter(node => node.props.testID === "flag-decoration");
      assert.equal(flags.length, 1); assert.equal(flags[0].props.accessible, false);
      assert.equal(flags[0].props.accessibilityElementsHidden, true);
      assert.equal(flags[0].props.importantForAccessibility, "no-hide-descendants");
      assert.ok(!row.props.accessibilityLabel.includes(flags[0].children[0]), "La bandera no se agrega al nombre accesible");
    }
    if (kind === "language") assert.deepEqual(f.screen.rows.map(row => row.props.accessibilityLabel), languages.map(item => item.label));
  }
}
console.log(`Selectores ${selectedCase}: JSX, BackButton, acciones y adornos originales con ciclo de foco/React/IO adaptados; una selección/vuelta, reintento, cancelación al salir y moneda fija. Catálogo/adornos completos tienen suite aparte; Android/TalkBack pendientes.`);

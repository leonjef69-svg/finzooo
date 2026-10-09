import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Funciones/catálogos actuales originales y JSX original de ambos selectores.
// Solo React/Android tienen adaptadores; sin cuentas, almacenamiento ni nube.
// La regresión mantiene la utilidad actual y lee el JSX histórico: falla por
// la fila sin adorno, no por buscar una utilidad ausente en esa revisión.
const root = process.cwd(), require = createRequire(import.meta.url);
const read = createSourceReader({ revision: process.env.FINO_DECORATIVE_FLAGS_BASELINE ?? "" });
const built = buildSync({ stdin: { contents: `
  export { languageFlagFor, currencyFlagFor } from '@/utils/decorativeFlags';
  export { CURRENCIES, currencySymbolFor, currencyDecimals } from '@/constants/currencies';
  export { COUNTRIES } from '@/constants/countries';
  export { LANGUAGES } from '@/constants/i18n';
  export { filterCurrencies } from '@/utils/catalogSearch';
`, resolveDir: root, sourcefile: "decorative-original.ts", loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", alias: { "@": root } });
const module = { exports: {} };
new Function("module", "exports", "require", built.outputFiles[0].text)(module, module.exports, require);
const api = module.exports;
const currenciesBefore = structuredClone(api.CURRENCIES);
const countriesBefore = structuredClone(api.COUNTRIES);
const moneyBefore = api.CURRENCIES.map(({ id }) => ({ id, symbol: api.currencySymbolFor(id), decimals: api.currencyDecimals(id) }));
assert.equal(api.CURRENCIES.length, 155, "155 códigos del catálogo existente, sin agregar o retirar monedas");
assert.equal(new Set(api.CURRENCIES.map(item => item.id)).size, 155);
for (const { id } of api.CURRENCIES) {
  assert.match(api.currencyFlagFor(id), /^[\u{1F1E6}-\u{1F1FF}]{2}$/u, `${id}: todo el catálogo tiene bandera representativa`);
}
for (const [id, flag] of Object.entries({ PEN: "🇵🇪", USD: "🇺🇸", JPY: "🇯🇵", GBP: "🇬🇧", CHF: "🇨🇭",
  EUR: "🇪🇺", ANG: "🇨🇼", XCG: "🇨🇼", XAF: "🇨🇲", XOF: "🇸🇳", XCD: "🇦🇬", XPF: "🇵🇫" })) {
  assert.equal(api.currencyFlagFor(id), flag, `${id}: representante definido, no residencia`);
}
for (const value of ["", "???", "ZZZ", "USZ", "__proto__", "constructor"]) {
  assert.equal(api.currencyFlagFor(value), "🌐", "código no catalogado no adopta país por su prefijo");
  assert.equal(api.languageFlagFor(value), "🌐", "idioma desconocido tiene adorno neutral");
}
assert.equal(api.currencyFlagFor(" pen "), "🇵🇪");
for (const [language, flag] of [["es", "🇪🇸"], ["en", "🇺🇸"], ["pt", "🇧🇷"]]) assert.equal(api.languageFlagFor(language), flag);
assert.equal(api.languageFlagFor(" ES "), "🇪🇸");
assert.equal(api.languageFlagFor("es"), "🇪🇸"); assert.equal(api.currencyFlagFor("PEN"), "🇵🇪", "idioma español no convierte soles en euros ni selecciona España");
assert.deepEqual(api.CURRENCIES, currenciesBefore);
assert.deepEqual(api.COUNTRIES, countriesBefore, "los adornos no cambian el país habitual ni su moneda/idioma");
assert.deepEqual(api.CURRENCIES.map(({ id }) => ({ id, symbol: api.currencySymbolFor(id), decimals: api.currencyDecimals(id) })), moneyBefore, "códigos, símbolos y decimales permanecen exactos");

const React = { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...node.children.flat(Infinity).flatMap(flatten)];
const dependencies = {
  ...api, React, View: "View", Text: "Text", TextInput: "TextInput", TouchableOpacity: "Button", ScrollView: "ScrollView",
  FlatList: "FlatList", Image: "Image", StatusBar: "StatusBar", Check: "Check", Search: "Search", BackButton: "BackButton",
  useCallback: callback => callback, useMemo: factory => factory(), useRef: value => ({ current: value }),
  useState: initial => [initial, () => {}], useFocusEffect: callback => { callback(); },
  useSafeAreaInsets: () => ({ top: 20, bottom: 20 }), require: () => "existing-photo",
  useAppData: () => ({ t: key => key, showToast() {}, userLanguage: "es", hasOnboarded: false }),
};
function render(file, name, props) { return handlerOriginal(file, name, dependencies, read(file))(props); }
function verifyAdornment(row, expected) {
  const decoration = flatten(row).find(node => node.props.testID === "flag-decoration");
  assert.ok(decoration, "la fila original debe mostrar una bandera decorativa");
  assert.equal(decoration.type, "Text");
  assert.equal(decoration.children.join(""), expected);
  assert.equal(decoration.props.accessible, false);
  assert.equal(decoration.props.accessibilityElementsHidden, true);
  assert.equal(decoration.props.importantForAccessibility, "no-hide-descendants");
  assert.doesNotMatch(row.props.accessibilityLabel ?? "", /[\u{1F1E6}-\u{1F1FF}]/u, "lector anuncia nombre/código, no un país de residencia");
}
const selections = [];
const currencyTree = render("screens/CurrencyPicker.tsx", "CurrencyPicker", { current: "PEN", onBack() {}, onSelect: id => selections.push(["currency", id]) });
const list = flatten(currencyTree).find(node => node.type === "FlatList");
assert.equal(list.props.data.length, 155);
const rows = list.props.data.map(item => ({ item, row: list.props.renderItem({ item }) }));
for (const { item, row } of rows) {
  verifyAdornment(row, api.currencyFlagFor(item.id));
  assert.match(row.props.accessibilityLabel, new RegExp(item.id));
  assert.equal(row.props.accessibilityRole, "button");
}
await rows.find(({ item }) => item.id === "PEN").row.props.onPress();
const languageTree = render("screens/LanguagePicker.tsx", "LanguagePicker", { current: "es", onBack() {}, onSelect: id => selections.push(["language", id]) });
const languageRows = flatten(languageTree).filter(node => node.type === "Button");
assert.equal(languageRows.length, 3);
for (let index = 0; index < languageRows.length; index++) {
  const item = api.LANGUAGES[index], row = languageRows[index];
  verifyAdornment(row, api.languageFlagFor(item.id));
  assert.equal(row.props.accessibilityLabel, item.label);
  assert.equal(row.props.accessibilityRole, "button");
}
await languageRows.find(row => row.props.accessibilityLabel === api.LANGUAGES.find(item => item.id === "en").label).props.onPress();
assert.deepEqual(selections, [["currency", "PEN"], ["language", "en"]], "decoración mantiene selección de moneda/idioma separadas y conserva el código exacto");
assert.deepEqual(api.CURRENCIES, currenciesBefore); assert.deepEqual(api.COUNTRIES, countriesBefore);
console.log("Funciones/catálogos y JSX originales: 155 banderas, neutral desconocido, idioma/moneda independientes, códigos/símbolos/decimales intactos y adorno excluido del lector. Android/TalkBack real pendientes.");

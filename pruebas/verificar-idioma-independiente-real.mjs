import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { buildSync } from "esbuild";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const baseline = process.env.FINO_LANGUAGE_INDEPENDENCE_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere hash Git.");
const read = file => baseline
  ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" })
  : fs.readFileSync(file, "utf8");
const clone = value => JSON.parse(JSON.stringify(value));
const contextFile = "contexts/AppDataContext.tsx", contextSource = read(contextFile);
const fields = {};
vm.runInNewContext(ts.transpileModule(read("utils/cloudFieldMerge.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: fields, Error, Date });
function bundledOriginal(file) {
  const code = buildSync({ entryPoints: [file], bundle: true, write: false,
    format: "cjs", platform: "node", target: "node22", tsconfig: "tsconfig.json" }).outputFiles[0].text;
  const original = { exports: {} };
  new Function("module", "exports", code)(original, original.exports);
  return original.exports;
}
const i18n = bundledOriginal("constants/i18n.ts");

function account(configured) {
  const writes = [], changes = [], notices = [], functions = {};
  const before = { userName: "Ana", userEmail: "ana@example.test", userPhoto: "data:photo-fixture",
    userLanguage: "es", userCurrency: "PEN", userCountry: "PE", hasOnboarded: configured,
    budgets: { "2026-10": 100 }, categoryBudgets: {}, transactions: [], goals: [],
    pagosProgramados: [], iconosFavoritos: [], isPremium: false };
  const deps = { ...before, ready: true, accountConfigured: { current: configured },
    cloudFieldsRef: { current: clone(before) }, cloudSyncMetaRef: { current: { profile: 10, budgets: 5 } },
    CLOUD_SYNC_GROUPS: fields.CLOUD_SYNC_GROUPS, STORAGE_KEYS: { profile: "profile", budgets: "budgets", cloudSyncMeta: "meta" },
    cloudGroupValue: fields.cloudGroupValue, recordCloudGroupChange: fields.recordCloudGroupChange,
    replaceCloudGroup: fields.replaceCloudGroup, datosParaLaNube: () => clone(before),
    LANGUAGES: i18n.LANGUAGES, translations: i18n.translations,
    t: key => key, showToast: value => notices.push(value),
    saveJSON: (key, value) => writes.push([key, clone(value)]),
    setCloudSyncMeta: value => changes.push(["metadata", clone(value)]),
  };
  for (const name of ["setUserName", "setUserPhoto", "setUserLanguage", "setUserCountry", "setUserCurrency"])
    deps[name] = value => changes.push([name, value]);
  // Todos los eslabones son originales, incluidos la fusión/marcado TS de VM.
  for (const name of ["markCloudGroup", "markCloudProfile", "persistCloudProfile", "updateLanguage"])
    deps[name] = (...args) => functions[name](...args);
  for (const name of ["markCloudGroup", "markCloudProfile", "persistCloudProfile", "updateLanguage"])
    functions[name] = handlerOriginal(contextFile, name, deps, contextSource);
  return { before, deps, writes, changes, notices, update: functions.updateLanguage };
}

// Primero la regresión real: la fuente histórica marcaba setup terminado
// simplemente por elegir English, sin haber guardado el presupuesto.
for (const configured of [false, true]) {
  for (const language of ["en", "pt", "es"]) {
    const a = account(configured); a.update(language);
    const profile = a.writes.findLast(([key]) => key === "profile")[1];
    assert.equal(profile.hasOnboarded, configured, "Elegir idioma no termina ni reabre la configuración");
    assert.equal(profile.userLanguage, language);
    for (const key of ["userCurrency", "userCountry", "userName", "userPhoto", "userEmail"])
      assert.equal(profile[key], a.before[key], `${key} permanece independiente del idioma`);
    assert.equal(a.deps.accountConfigured.current, configured);
    assert.equal(a.deps.cloudFieldsRef.current.userCurrency, "PEN");
    assert.equal(a.deps.cloudFieldsRef.current.userCountry, "PE");
    assert.deepEqual(clone(a.deps.cloudFieldsRef.current.budgets), { "2026-10": 100 });
    assert.equal(a.deps.cloudFieldsRef.current.userLanguage, language);
    assert.ok(a.deps.cloudSyncMetaRef.current.profile > 10, "Se conserva el marcado original del perfil");
    assert.equal(a.deps.cloudSyncMetaRef.current.budgets, 5, "No marca dinero como editado");
    assert.ok(!a.writes.some(([key]) => key === "budgets"));
    assert.equal(a.notices.at(-1), i18n.translations[language]["toast.languageUpdated"]);
  }
}
for (const invalid of ["", "EN", "de", "__proto__", "toString"]) {
  const a = account(false), before = clone(a.deps.cloudFieldsRef.current), metadata = clone(a.deps.cloudSyncMetaRef.current);
  assert.throws(() => a.update(invalid), /setup\.selectionFailed/);
  assert.deepEqual(a.writes, []); assert.deepEqual(a.changes, []); assert.deepEqual(a.notices, []);
  assert.deepEqual(clone(a.deps.cloudFieldsRef.current), before);
  assert.deepEqual(clone(a.deps.cloudSyncMetaRef.current), metadata, "Un idioma no soportado no deja marca parcial");
}

// JSX completo original de SetupBudget. React, navegación/avisos y guardado
// se adaptan aquí; montarlo así no es una prueba visual ni de Android.
const flags = bundledOriginal("utils/decorativeFlags.ts"), currencies = bundledOriginal("constants/currencies.ts"), amounts = bundledOriginal("utils/amount.ts");
const routes = [], saves = [], refs = [], states = [];
let stateIndex = 0, refIndex = 0, finishSave;
const savePending = new Promise(resolve => { finishSave = resolve; });
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(initial) {
    const index = stateIndex++;
    if (!(index in states)) states[index] = index === 0 ? "100" : initial;
    return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
  },
  useRef(initial) { return refs[refIndex++] ??= { current: initial }; },
};
const rn = Object.fromEntries(["ActivityIndicator", "Image", "KeyboardAvoidingView", "ScrollView", "StatusBar", "Text", "TextInput", "TouchableOpacity", "View"].map(name => [name, name]));
const imports = { react: React, "react-native": { ...rn, Platform: { OS: "android" } },
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
  "lucide-react-native": Object.fromEntries(["Bell", "ChevronRight", "Globe2", "Moon", "Sun", "WalletCards"].map(name => [name, name])),
  "@/constants/currencies": currencies, "@/constants/i18n": i18n, "@/utils/decorativeFlags": flags,
  "@/contexts/AppDataContext": { useAppData: () => ({ userCountry: "PE", userCurrency: "PEN", userLanguage: "en", t: key => key,
    monthNames: i18n.monthNamesFor("en"), themeMode: "light", updateThemeMode() {} }) },
  "@/utils/firebase": { auth: { currentUser: { uid: "fixture" } } }, "@/utils/amount": amounts,
  "@/utils/nav": { irUnaVez: route => routes.push(route) },
  "@/utils/setupNotifications": { useSetupNotifications: () => ({ notificationsEnabled: false, notificationBusy: false, notificationErrorKey: null, enableNotifications() {} }) },
};
const exported = {}, compiled = ts.transpileModule(read("screens/SetupBudget.tsx"), { fileName: "screens/SetupBudget.tsx", compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
} }).outputText;
new Function("React", "exports", "require", compiled)(React, exported, name => {
  if (name.endsWith(".png")) return name;
  if (!(name in imports)) throw Error(`Import no adaptado: ${name}`);
  return imports[name];
});
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...(node.children ?? []).flat(Infinity).flatMap(flatten)];
const textOf = node => flatten(node).flatMap(item => (item.children ?? []).flat(Infinity).filter(child => typeof child === "string")).join(" ");
function renderSetup() {
  stateIndex = refIndex = 0;
  return flatten(exported.default({ onSaved: amount => { saves.push(amount); return savePending; } }));
}
let setup = renderSetup();
const languageRow = setup.find(node => node.type === "TouchableOpacity" && textOf(node).includes("settings.language"));
const currencyRow = setup.find(node => node.type === "TouchableOpacity" && textOf(node).includes("settings.currency"));
const start = setup.find(node => node.type === "TouchableOpacity" && textOf(node).includes("setup.start"));
assert.ok(languageRow && currencyRow && start);
assert.ok(textOf(languageRow).includes("English"));
assert.ok(!textOf(languageRow).includes("PEN") && !textOf(languageRow).includes("S/"), "Idioma no muestra ni selecciona moneda asociada");
assert.ok(textOf(currencyRow).includes("PEN") && textOf(currencyRow).includes("S/"));
assert.ok(!setup.some(node => textOf(node) === "settings.country"), "La fila País ya no sustituye Idioma");
for (const row of [languageRow, currencyRow]) {
  const decoration = flatten(row).find(node => node.type === "Text" && node.props.accessibilityElementsHidden);
  assert.ok(decoration); assert.equal(decoration.props.accessible, false);
  assert.equal(decoration.props.importantForAccessibility, "no-hide-descendants");
}
languageRow.props.onPress(); currencyRow.props.onPress();
assert.deepEqual(routes, ["/language", "/currency"]); routes.length = 0;
const saving = start.props.onPress(); await start.props.onPress();
languageRow.props.onPress(); currencyRow.props.onPress();
assert.deepEqual(routes, [], "Callbacks viejos tampoco abren selectores mientras se guarda");
assert.deepEqual(saves, [100], "Doble toque no repite la configuración");
setup = renderSetup();
assert.ok(setup.filter(node => node.type === "TouchableOpacity" && (textOf(node).includes("settings.language") || textOf(node).includes("settings.currency"))).every(node => node.props.disabled));
finishSave(); await saving;
renderSetup(); languageRow.props.onPress(); assert.deepEqual(routes, ["/language"], "Al terminar se puede abrir idioma de nuevo");

// Settings solo es contrato estático separado: no ejecutamos su pantalla completa.
const settings = read("screens/Settings.tsx"), settingsTree = ts.createSourceFile("screens/Settings.tsx", settings, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const rows = [];
function visitSettings(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(settingsTree) === "Row") rows.push(node);
  ts.forEachChild(node, visitSettings);
}
visitSettings(settingsTree);
const languageSetting = rows.find(row => row.getText(settingsTree).includes('t("settings.language")'));
const currencySetting = rows.find(row => row.getText(settingsTree).includes('t("settings.currency")'));
assert.ok(languageSetting && currencySetting);
assert.match(languageSetting.getText(settingsTree), /onPress=\{onLanguage\}/);
assert.match(languageSetting.getText(settingsTree), /languageLabelFor\(userLanguage\)/);
assert.doesNotMatch(languageSetting.getText(settingsTree), /countryLabelFor|currencyLabelFor|onCountry/);
assert.match(currencySetting.getText(settingsTree), /onPress=\{onCurrency\}/);
assert.ok(!rows.some(row => row.getText(settingsTree).includes('t("settings.country")')));
console.log("Idioma independiente: cadena de guardado/marcado original y SetupBudget JSX/acciones originales con IO/React adaptados; país/moneda/configuración conservados. Settings es contrato estático; disco/Firebase/UI/Android/TalkBack reales pendientes.");

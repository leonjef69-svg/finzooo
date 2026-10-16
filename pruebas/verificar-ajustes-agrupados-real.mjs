import assert from "node:assert/strict";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { createSourceReader } from "./helpers/source-reader.mjs";

// JSX y acciones originales; React, Android, Auth y callbacks adaptados.
// No inicia sesiones, pide permisos, coloca widgets ni toca datos reales.
const read = createSourceReader({ revision: process.env.FINO_SETTINGS_UI_BASELINE ?? "" });
const current = createSourceReader({ revision: "", report: false });
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  Children: { toArray: children => [children].flat(Infinity).filter(value => value != null && value !== false) } };
function evaluate(file, dependency) {
  const module = { exports: {} };
  const code = ts.transpileModule(current(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  new Function("React", "require", "module", "exports", code)(React, dependency, module, module.exports);
  return module.exports;
}
const style = evaluate("constants/style.ts", () => { throw Error("pure-style"); });
const theme = evaluate("constants/visualTheme.ts", name => {
  if (name === "@/constants/style") return style;
  throw Error("pure-theme");
});
const fonts = { regular: "FinoEntryRegular", medium: "FinoEntryMedium", bold: "FinoEntryBold" };
let dark = false, visualStyle = "peachOlive";
const ui = evaluate("components/SettingsUI.tsx", name => {
  if (name === "react") return React;
  if (name === "react-native") return { Text: "Text", View: "View", TouchableOpacity: "TouchableOpacity", Switch: "Switch" };
  if (name === "lucide-react-native") return { ChevronRight: "ChevronRight", Crown: "Crown" };
  if (name === "nativewind") return { useColorScheme: () => ({ colorScheme: dark ? "dark" : "light" }) };
  if (name === "@/constants/visualTheme") return theme;
  if (name === "@/constants/style") return style;
  if (name === "@/components/EntryUI") return { ENTRY_FONT: fonts };
  if (name === "@/contexts/AppDataContext") return { useAppData: () => ({ visualStyle, t: key => key }) };
  throw Error("Unexpected SettingsUI dependency: " + name);
});
function walk(node, found = []) {
  if (Array.isArray(node)) node.forEach(child => walk(child, found));
  else if (node && typeof node === "object") { found.push(node); (node.children ?? []).forEach(child => walk(child, found)); }
  return found;
}
const textOf = node => typeof node === "string" ? node : Array.isArray(node) ? node.map(textOf).join("") : node?.children?.map(textOf).join("") ?? "";
const iconNames = "CalendarClock Camera Check ChevronRight Cloud Crown FileDown FileUp Lock PiggyBank PieChart Coins Globe2 KeyRound Pencil UserX LogOut Info Shield Store Zap Mic MessageSquare Moon Palette Sun X".split(" ");
const contexts = { themeMode: "light", visualStyle, hasCloudAccount: true, isPremium: false, cloudBackupEnabled: true,
  setCloudBackupEnabled: async enabled => { calls.push(["cloud", enabled]); }, respaldoAlDia: false, respaldoFallo: "permisos", autoCaptureOn: false,
  testerPremiumPendingVerification: false, negocios: [] };
const calls = [];
const t = key => key;
const deps = {
  React, useState: value => [value, () => {}], Platform: { OS: "android" },
  ScrollView: "ScrollView", Text: "Text", TouchableOpacity: "TouchableOpacity", View: "View", Image: "Image", Switch: "Switch",
  ActivityIndicator: "ActivityIndicator", TextInput: "TextInput", LinearGradient: "LinearGradient",
  Row: "Row", SettingsSection: "Section", SettingsIcon: "SettingsIcon", ENTRY_FONT: fonts,
  settingsColors: ui.settingsColors, useSafeAreaInsets: () => ({ top: 24, bottom: 8 }),
  useColorScheme: () => ({ colorScheme: dark ? "dark" : "light" }),
  useAppData: () => ({ ...contexts, t, showToast: text => calls.push(["toast", text]),
    updateThemeMode: value => calls.push(["appearance", value]), updateVisualStyle: value => calls.push(["style", value]) }),
  auth: { currentUser: { emailVerified: true, providerData: [{ providerId: "password" }] } },
  TELEGRAM_ENABLED: false, currencyLabelFor: code => code, languageLabelFor: language => language,
  currencyFlagFor: () => "flag", languageFlagFor: () => "flag", hayRegistroAutomatico: currency => ["PEN", "BOB"].includes(currency),
  voiceWidget: { isSupported: true, requestPin: variant => { calls.push(["widget", variant]); return true; } },
  irUnaVez: route => calls.push(["route", route]),
  ...Object.fromEntries(iconNames.map(name => [name, name])),
};
const screen = handlerOriginal("screens/Settings.tsx", "Settings", deps, read("screens/Settings.tsx"));
function render(premium = false, currency = "PEN") {
  contexts.isPremium = premium;
  return screen({ userName: "SYNTHETIC-NAME", userPhoto: "SYNTHETIC-PHOTO", userEmail: "synthetic@example.test",
    userCurrency: currency, userLanguage: "es", isPremium: premium, isTesterPremium: false,
    ...Object.fromEntries(["onSaveProfile", "onCurrency", "onLanguage", "onCategoryBudgets", "onExportPdf",
      "onScheduledExport", "onImport", "onAutoCapture", "onLogout", "onPremium", "onSavings", "onAppLock",
      "onChangePassword", "onDeleteAccount", "onAbout", "onLegal", "onVoiceHelp", "onTelegram"].map(name => [name, () => calls.push([name])])) });
}
const nodes = walk(render()), sections = nodes.filter(node => node.type === "Section");
assert.deepEqual(sections.map(node => node.props.title), [
  "settings.sectionPersonalize", "settings.sectionFinances", "settings.sectionData",
  "settings.sectionCloud", "settings.sectionRecording", "settings.sectionSecurityAccount", "settings.sectionInfo",
], "todas las opciones están clasificadas en seis secciones visibles, no una lista mezclada");
assert.equal(nodes.some(node => ["Image", "TextInput", "Camera", "Pencil"].includes(node.type)), false, "perfil/editor/cámara retirados sin borrar datos");
const account = sections.find(node => node.props.title === "settings.sectionSecurityAccount");
assert.equal(textOf(account).includes("synthetic@example.test"), true, "correo solo en Cuenta");
assert.equal(textOf(nodes.filter(node => node.type === "Text")).includes("SYNTHETIC-NAME"), false);
const premiumEntry = nodes.find(node => node.type === "TouchableOpacity" && node.props.accessibilityLabel === "settings.proEntryTitle");
assert.ok(premiumEntry, "Pro accesible arriba tanto sin Pro como con Pro");
premiumEntry.props.onPress(); assert.deepEqual(calls.pop(), ["onPremium"]);
const title = walk(premiumEntry).find(node => node.type === "Text" && textOf(node) === "settings.proEntryTitle");
assert.ok(title.props.style.fontSize >= 20, "título Pro mayor que antes, legible y sin texto Gratis");
assert.equal(premiumEntry.props.style.marginHorizontal, 16);
assert.equal(nodes.indexOf(premiumEntry) < nodes.indexOf(sections[0]), true);
assert.ok(nodes.some(node => node.type === "Row" && node.props.label === "settings.backupProTitle"), "respaldo conserva la condición de pago");
assert.ok(walk(render(true)).some(node => node.type === "Text" && textOf(node) === "settings.premiumActive"));

const rows = nodes.filter(node => node.type === "Row");
for (const [label, callback] of [
  ["settings.language", "onLanguage"], ["settings.currency", "onCurrency"],
  ["categoryBudgets.rowLabel", "onCategoryBudgets"], ["settings.savingsGoals", "onSavings"],
  ["exportPdf.exportDataTitle", "onExportPdf"], ["importSheet.rowLabel", "onImport"],
  ["schedExport.settingsRow", "onScheduledExport"], ["autoCapture.rowLabel", "onAutoCapture"],
  ["lock.rowLabel", "onAppLock"], ["settings.changePassword", "onChangePassword"],
  ["settings.logout", "onLogout"], ["settings.deleteAccount", "onDeleteAccount"],
  ["settings.appInfo", "onAbout"], ["settings.legal", "onLegal"], ["voiceHelp.rowLabel", "onVoiceHelp"],
]) {
  const row = rows.find(node => node.props.label === label);
  assert.ok(row, "acceso conservado: " + label); row.props.onPress();
  assert.deepEqual(calls.pop(), label === "autoCapture.rowLabel" ? ["onPremium"] : [callback]);
}
assert.equal(rows.find(row => row.props.label === "categoryBudgets.rowLabel").props.premium, undefined, "presupuestos por categoría son gratis");
for (const label of ["settings.savingsGoals", "exportPdf.exportDataTitle", "importSheet.rowLabel", "schedExport.settingsRow", "autoCapture.rowLabel", "negocios.rowLabel", "widget.rowLabel", "voiceHelp.rowLabel", "lock.rowLabel"])
  assert.equal(rows.find(row => row.props.label === label).props.premium, true, label + ": etiqueta de pago");
const cloudSection = sections.find(node => node.props.title === "settings.sectionCloud");
assert.ok(walk(cloudSection).some(node => node.type === "Row" && node.props.label === "settings.backupProTitle"), "la copia en nube está agrupada y marcada como de pago");
const proSettings = walk(render(true));
const cloudSwitch = proSettings.find(node => node.type === "Switch" && node.props.accessibilityLabel === "settings.backupSwitch");
assert.ok(cloudSwitch, "Pro muestra un interruptor real para pausar o activar la copia");
assert.equal(cloudSwitch.props.value, true);
cloudSwitch.props.onValueChange(false);
assert.deepEqual(calls.pop(), ["cloud", false], "el interruptor comunica la pausa al almacenamiento de Ajustes");
rows.find(row => row.props.label === "widget.rowLabel").props.onPress(); assert.deepEqual(calls.pop(), ["onPremium"]);
walk(render(true)).find(row => row.type === "Row" && row.props.label === "widget.rowLabel").props.onPress();
assert.deepEqual(calls.pop(), ["widget", "round"], "sin conceder Pro ni cambiar la acción");
rows.find(row => row.props.label === "calendario.titulo").props.onPress(); assert.deepEqual(calls.pop(), ["route", "/calendario"]);
contexts.negocios = [{ id: "test-business" }];
walk(render()).find(row => row.type === "Row" && row.props.label === "negocios.rowLabel").props.onPress();
assert.deepEqual(calls.pop(), ["route", "/negocio/test-business"]);
assert.ok(!walk(render(false, "COP")).some(row => row.type === "Row" && row.props.label === "autoCapture.rowLabel"));
deps.auth.currentUser.providerData = [{ providerId: "google.com" }];
assert.ok(!walk(render()).some(row => row.type === "Row" && row.props.label === "settings.changePassword"));
assert.ok(!rows.some(row => row.props.label === "telegram.rowLabel"), "Telegram no se reactiva");

for (const appearance of ["classic", "peachOlive"]) for (const isDark of [false, true]) {
  visualStyle = appearance; dark = isDark;
  const palette = ui.settingsColors(appearance, isDark);
  const icon = ui.SettingsIcon({ Icon: "TestIcon" });
  assert.equal(walk(icon).find(node => node.type === "TestIcon").props.size, 26, "iconos grandes con el mismo lenguaje");
  const row = ui.SettingsRow({ Icon: "TestIcon", label: "label", premium: true, onPress: () => calls.push(["row"]) });
  assert.equal(row.props.accessibilityRole, "button"); row.props.onPress(); assert.deepEqual(calls.pop(), ["row"]);
  assert.equal(row.props.style.minHeight, 64, "zona táctil no diminuta");
  assert.equal(walk(row).filter(node => node.type === "Text").map(textOf).includes("settings.paidBadge"), false);
  assert.equal(walk(row).find(node => node.type === "Crown").props.size, 18);
  assert.equal(row.props.accessibilityLabel, "label, settings.paidBadge");
  assert.equal(walk(row).find(node => node.type === "Text" && textOf(node) === "label").props.style.color, palette.text);
  assert.equal(ui.SettingsSection({ title: "group", children: [null, false, row] }).children[1].props.style.backgroundColor, palette.surface);
}
assert.notDeepEqual(ui.settingsColors("classic", false).proGradient, ui.settingsColors("peachOlive", false).proGradient);
assert.equal(ui.settingsColors("peachOlive", true).surface, style.NOCHE.tarjeta, "oscuro conserva el carbón de Fino");
const languageData = evaluate("constants/i18n.ts", () => { throw Error("pure-i18n"); }).translations;
assert.equal(languageData.es["settings.title"], "Ajustes", "ya no se presenta como Perfil");
for (const lang of ["es", "en", "pt"]) for (const key of [...sections.map(node => node.props.title), "settings.proEntryTitle", "settings.proEntryHint", "settings.paidBadge"])
  assert.ok(languageData[lang][key], lang + ": " + key);
console.log("Ajustes originales: siete grupos, nube pagada agrupada con interruptor y pausas respetadas, sin perfil ni etiqueta Gratis; accesos/condiciones Pro, correo, Yape/widget/Google, cuatro apariencias e iconos conservados. No prueba Firebase ni teléfono físico.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const revision = process.env.FINO_DARK_BASELINE;
const read = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
let dark = false;
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  new Function("require", "module", "exports", code)(name => {
    if (name in dependencies) return dependencies[name];
    if (name.endsWith(".ttf")) return 1;
    throw Error(`Unadapted visual dependency ${name}`);
  }, module, module.exports);
  return module.exports;
}
const { NOCHE } = load("constants/style.ts");
assert.equal(NOCHE.fondo, "#11110f", "el fondo oscuro es carbón cálido y no negro absoluto");
assert.equal(NOCHE.navegacion, "#1a1916", "la barra tiene una superficie propia que combina con el fondo");
const theme = load("constants/visualTheme.ts", { "@/constants/style": { NOCHE } });
const entry = load("components/EntryUI.tsx", {
  "react-native": { StyleSheet: { create: x => x } }, "@/constants/style": { NOCHE },
  nativewind: { useColorScheme: () => ({ colorScheme: dark ? "dark" : "light" }) },
  "react-native-safe-area-context": {}, "lucide-react-native": {}, "@/contexts/AppDataContext": {},
});
assert.equal(typeof entry.useEntryTheme, "function", "los paneles de idioma y formularios de acceso también responden al modo oscuro");
const light = entry.useEntryTheme();
assert.equal(light.colors.background, "#f7f5ee");
assert.equal(light.styles.button.backgroundColor, "#506946");
dark = true;
const dim = entry.useEntryTheme();
assert.equal(dim.colors.background, NOCHE.fondo);
assert.equal(dim.styles.panel.backgroundColor, NOCHE.tarjeta);
assert.equal(dim.styles.buttonText.color, "#fffdf8");
assert.notEqual(dim.styles.panel.backgroundColor, dim.styles.screen.backgroundColor);
assert.notEqual(NOCHE.tarjeta, NOCHE.encima);
const luminance = hex => {
  const rgb = hex.startsWith("#") ? hex.slice(1).match(/../g).map(x => parseInt(x, 16)) : hex.split(" ").map(Number);
  return rgb.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s, x, i) => s + x * [.2126, .7152, .0722][i], 0);
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
for (const surface of [NOCHE.fondo, NOCHE.navegacion, NOCHE.tarjeta, NOCHE.encima, NOCHE.panel]) {
  assert.ok(contrast(NOCHE.texto, surface) >= 7, "texto principal legible");
  assert.ok(contrast(NOCHE.textoSuave, surface) >= 4.5, "texto secundario legible");
}
const vars = theme.nativewindThemeVariables("classic", true);
for (const color of ["emerald-700", "rose-700", "emerald-600"]) assert.ok(contrast("#ffffff", vars[`--fino-${color}`]) >= 4.5, "montos y botones blancos con contraste suficiente");
assert.deepEqual(theme.nativewindThemeVariables("classic", true), theme.nativewindThemeVariables("peachOlive", true), "una misma apariencia oscura para ambos estilos claros");
console.log("Tema original: superficies por capas, formularios/paneles oscuros, claro conservado y contraste de textos/montos comprobados. No equivale a revisión visual Android.");

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const baseline = process.env.FINO_TEST_INVITATION_UI_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Hash inválido");
const file = "components/SpaceInvitationSheet.tsx";
const source = baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const translations = fs.readFileSync("constants/i18n.ts", "utf8");
const t = (key, values = {}) => {
  const match = translations.match(new RegExp(`"${key.replaceAll(".", "\\.")}": "([^"]*)"`));
  assert.ok(match, `Traducción ${key}`);
  return match[1].replace(/\{(\w+)\}/g, (_, name) => values[name]);
};
const alerts = [], shares = [], copied = [];
let shareResult = { action: "sharedAction" }, rejectShare = false, rejectCopy = false;
const element = (type, props) => ({ type, props });
const rn = Object.fromEntries(["ActivityIndicator", "Pressable", "Text", "TouchableOpacity", "View"].map(key => [key, key]));
rn.Share = { share: async content => { shares.push(content); if (rejectShare) throw Error("native"); return shareResult; } };
const deps = {
  "react/jsx-runtime": { jsx: (type, props) => element(type, props), jsxs: (type, props) => element(type, props) },
  "react-native": rn,
  "lucide-react-native": { Copy: "Copy", X: "X", Share2: "Share2" },
  "@/components/PrivateModal": { default: "PrivateModal" },
  "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
  "@/contexts/AppDataContext": { useAppData: () => ({ t, showToast: value => alerts.push(value) }) },
  "expo-clipboard": { setStringAsync: async code => { if (rejectCopy) throw Error("clipboard"); copied.push(code); } },
};
const module = { exports: {} };
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(js, { module, exports: module.exports, require: key => { assert.ok(deps[key], `Dependencia inesperada ${key}`); return deps[key]; } });
const render = (kind, code = "ABCD2345", visible = true, loading = false) => module.exports.default({ kind, code, visible, loading, onClose() {} });
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
for (const kind of ["box", "family"]) {
  const tree = render(kind), all = nodes(tree);
  const button = all.find(node => node.type === "TouchableOpacity" && node.props.accessibilityLabel === t("family.shareInvitation"));
  assert.ok(button, "La ventana debe ofrecer Compartir además de Copiar, no solo un código visible");
  assert.ok(all.some(node => node.props?.selectable && [node.props.children].flat(Infinity).includes("ABCD2345")), "Muestra el mismo código real");
  button.props.onPress(); await tick();
  assert.equal(shares.at(-1).message, t(kind === "box" ? "boxes.invitationMessage" : "family.invitationMessage", { code: "ABCD2345" }));
  assert.equal(alerts.length, 0, "Abrir compartir no confirma entrega, no abre revisiones ni cambia saldos");
  shareResult = { action: "dismissedAction" }; button.props.onPress(); await tick(); assert.equal(alerts.length, 0);
  rejectShare = true; button.props.onPress(); await tick(); assert.equal(alerts.pop(), t("family.codeShareFailed")); rejectShare = false;
  const copy = all.find(node => node.type === "TouchableOpacity" && node.props.accessibilityLabel === t("family.copyCode"));
  assert.ok(copy); copy.props.onPress(); await tick(); assert.equal(copied.at(-1), "ABCD2345"); assert.equal(alerts.pop(), t("family.codeCopied"));
  rejectCopy = true; copy.props.onPress(); await tick(); assert.equal(alerts.pop(), t("family.codeCopyFailed")); rejectCopy = false;
}
for (const [code, visible] of [["", true], ["ABCD2345", false]]) {
  const tree = render("box", code, visible), count = shares.length;
  assert.equal(tree, null, "no construye controles de una invitación cerrada o sin código");
  await tick(); assert.equal(shares.length, count, "No comparte códigos vacíos ni una invitación cerrada");
}
for (const kind of ["box", "family"]) {
  const waiting = render(kind, "", true, true), beforeShare = shares.length, beforeCopy = copied.length;
  assert.equal(waiting.props.visible, true, "el código se prepara en su propia hoja desde el toque");
  assert.ok(nodes(waiting).some(node => node.type === "ActivityIndicator"));
  for (const label of ["family.shareInvitation", "family.copyCode"]) {
    const button = nodes(waiting).find(node => node.type === "TouchableOpacity" && node.props.accessibilityLabel === t(label));
    assert.equal(button.props.disabled, true); button.props.onPress();
  }
  await tick(); assert.equal(shares.length, beforeShare); assert.equal(copied.length, beforeCopy, "nunca comparte/copia un código vacío");
}
// La Caja convertida sigue accesible en la lista ÚNICA, sin comprar de nuevo.
const boxesFile = "screens/Cajas.tsx";
const boxesSource = baseline ? execFileSync("git", ["show", `${baseline}:${boxesFile}`], { encoding: "utf8" }) : fs.readFileSync(boxesFile, "utf8");
const tree = ts.createSourceFile(boxesFile, boxesSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let entry;
function find(node) {
  if (ts.isJsxOpeningElement(node) && node.tagName.getText(tree) === "TouchableOpacity"
    && node.attributes.properties.some(prop => prop.name?.text === "onPress" && prop.initializer?.getText(tree) === '{() => abrirCompartida(item)}')) entry = node;
  ts.forEachChild(node, find);
}
find(tree); assert.ok(entry, "Cajas debe mostrar las compartidas en la lista principal, sin esconderlas al quitar el acceso extra");
const press = entry.attributes.properties.find(prop => prop.name?.text === "onPress").initializer.expression;
const action = ts.transpile(`(${press.getText(tree)})`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None });
const opened = [], realBox = { id: "shared-real", nombre: "Caja" };
new Function("abrirCompartida", "item", `return ${action}`)(item => opened.push(item), realBox)();
assert.deepEqual(opened, [realBox], "La entrada abre exactamente la caja elegida, no otra lista ni un formulario de código");
console.log("Invitación original: Compartir/Copiar reales, cancelación sin éxito supuesto, fallos recuperables y acceso visible a cajas compartidas sin escribir dinero.");

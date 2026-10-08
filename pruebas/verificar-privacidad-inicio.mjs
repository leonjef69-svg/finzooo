import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { buildSync, transformSync } from "esbuild";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const baseline = process.env.FINO_TEST_HOME_PRIVACY_BASELINE;
if (baseline && !/^[a-f0-9]{7,40}$/.test(baseline)) throw Error("Se requiere un hash Git.");
const read = file => baseline ? execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }) : fs.readFileSync(file, "utf8");
const source = read("screens/Home.tsx");
const tree = ts.createSourceFile("Home.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const home = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "Home");
const declarations = home.body.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations]);
const formatter = declarations.find(node => node.name.getText(tree) === "fmt");
assert.ok(formatter?.initializer, "Inicio necesita un formato privado compartido por sus importes, no solo el disponible");
const formatterCode = transformSync(`return ${formatter.initializer.getText(tree)};`, { loader: "ts" }).code;
const actualFormatter = hidden => new Function("hideBalance", "formatAmount", "useCallback", formatterCode)(hidden, n => `S/${n.toFixed(2)}`, fn => fn);
const visible = actualFormatter(false), privateFmt = actualFormatter(true);
for (const amount of [0, 12345.67, -456.78, 999999999999]) {
  assert.equal(privateFmt(amount), "• • • • • •");
  assert.equal(visible(amount), `S/${amount.toFixed(2)}`);
}
const row = tree.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
  .find(node => node.name.getText(tree) === "FilaMovimiento");
function compile(contents) {
  return buildSync({ stdin: { contents, sourcefile: "fixture.tsx", loader: "tsx" }, bundle: true, platform: "node",
    format: "cjs", jsx: "automatic", external: ["react/jsx-runtime"], write: false, logLevel: "silent" }).outputFiles[0].text;
}
function exportsOf(code, env) {
  const module = { exports: {} };
  new Function("module", "exports", "require", ...Object.keys(env), code)(module, module.exports, require, ...Object.values(env));
  return module.exports;
}
// JSX original; ventanas/iconos adaptados, sin afirmar prueba visual Android.
const transfer = exportsOf(compile(read("components/SpaceTransferAmounts.tsx").replace(/^import[^\n]+\n/, "")), { View: "View", Text: "Text" }).default;
const animation = { delay() { return this; }, duration() { return this; } };
const render = exportsOf(compile(`export const FilaMovimiento=${row.initializer.getText(tree)};`), {
  memo: fn => fn, catInfo: () => ({ label: "Servicios", color: "blue", icon: "Icon" }), esFoto: () => false,
  iconoDe: () => "Icon", fmtDate: () => "24 oct.", Animated: { View: "View" }, FadeInDown: animation,
  View: "View", Text: "Text", PressableScale: "PressableScale", CheckCircle2: "Check", Circle: "Circle",
  softShadow: {},
  IconBadge: "Icon", ArrowRightLeft: "TransferIcon", SpaceTransferAmounts: transfer, EtiquetaMetodo: "Method",
}).FilaMovimiento;
function texts(node) {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (typeof node !== "object") return [String(node)];
  if (typeof node.type === "function") return texts(node.type(node.props));
  return texts(node.props?.children);
}
const base = { index: 0, marcada: false, selectMode: false, oscuro: false, t: k => k, monthNames: [], onPress() {},
  tx: { id: 1, date: "2026-10-24", time: "14:32", amount: 12345.67, type: "expense", description: "MOVISTAR", category: "services", method: "cash" } };
let rendered = texts(render({ ...base, fmt: privateFmt })).join("|");
assert.ok(rendered.includes("MOVISTAR") && rendered.includes("24 oct.") && rendered.includes("14:32"));
assert.ok(rendered.includes("• • • • • •") && !rendered.includes("12345.67"));
rendered = texts(render({ ...base, fmt: visible })).join("|");
assert.ok(rendered.includes("S/12345.67"), "Mostrar recupera el importe original sin cambiarlo");
rendered = texts(render({ ...base, fmt: privateFmt, tx: { ...base.tx, internalTransfer: "family", internalTransferSpaceName: "Familia" },
  transferGroup: { sent: 321.45, returned: 87.65, consumed: 210.98 } })).join("|");
for (const amount of ["321.45", "87.65", "210.98"]) assert.ok(!rendered.includes(amount));
assert.equal(rendered.split("• • • • • •").length - 1, 3);
assert.ok(/accessibilityRole="switch"[\s\S]{0,240}accessibilityState=\{\{ checked: hideBalance \}\}/.test(source));
assert.ok(source.includes('t(hideBalance ? "home.showAmounts" : "home.hideAmounts")'));
assert.ok(source.includes("!hideBalance && <View style={{ width: `${visiblePct}%`"), "Barra no revela progreso con importes ocultos");
for (const value of ["available", "prevBalance", "mainSpent", "mainIncome", "pago.monto"]) {
  assert.ok(source.includes(`fmt(${value})`), `${value} usa el mismo formato privado`);
}
assert.ok(source.includes("[hideBalance, formatAmount]"));
assert.ok(source.includes("[marcadas, selectMode, colorScheme, fmt, t, monthNames, alTocarFila]"), "Lista se redibuja con nuevo formato");
console.log("Inicio original: formato privado, movimiento/calendario, transferencias, retorno del importe y accesibilidad comprobados. Vista y TalkBack Android pendientes.");

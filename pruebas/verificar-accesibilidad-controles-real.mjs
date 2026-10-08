import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_ACCESSIBILITY_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = file => revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const selectedCase = process.env.FINO_ACCESSIBILITY_CASE ?? "all";
if (!["all", "toggle", "pin", "daily", "contracts"].includes(selectedCase)) throw new Error("Caso inválido");
const runCase = name => selectedCase === "all" || selectedCase === name;
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const rn = Object.fromEntries(["Text", "View", "TouchableOpacity", "ScrollView"].map(name => [name, name]));
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...(node.children ?? []).flat(Infinity).flatMap(flatten)];
function moduleOriginal(file, substitutes) {
  const compiled = ts.transpileModule(source(file), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  new Function("React", "module", "exports", "require", compiled)(React, module, module.exports, name => {
    if (!(name in substitutes)) throw new Error(`Dependencia inesperada: ${name}`);
    return substitutes[name];
  });
  return module.exports;
}

if (runCase("toggle")) {
const Toggle = moduleOriginal("components/Toggle.tsx", { "react-native": rn }).default;
const changes = [];
for (const on of [false, true]) {
  const toggle = Toggle({ on, onChange: value => changes.push(value), label: "Exportación automática" });
  assert.equal(toggle.props.accessibilityRole, "switch", "no anunciar el interruptor como botón anónimo");
  assert.equal(toggle.props.accessibilityLabel, "Exportación automática");
  assert.deepEqual(toggle.props.accessibilityState, { checked: on, disabled: false });
  toggle.props.onPress(); assert.equal(changes.at(-1), !on);
}
const disabledToggle = Toggle({ on: false, onChange: value => changes.push(value), label: "Prueba", disabled: true });
const count = changes.length; disabledToggle.props.onPress(); assert.equal(changes.length, count);
assert.equal(disabledToggle.props.accessibilityState.disabled, true);
assert.equal(disabledToggle.props.disabled, true);
}

if (runCase("pin")) {
const key = handlerOriginal("components/PinPad.tsx", "Key", { React, ...rn }, source("components/PinPad.tsx"));
const pins = [];
const PinPad = moduleOriginal("components/PinPad.tsx", {
  react: { useRef: value => ({ current: value }), useEffect() {} },
  "react-native": { ...rn, useWindowDimensions: () => ({ width: 360 }), Animated: { View: "AnimatedView", Value: class { interpolate() { return 0; } } } },
  "lucide-react-native": { Delete: "Delete", Fingerprint: "Fingerprint", ScanFace: "ScanFace" },
  "expo-haptics": { selectionAsync: () => Promise.resolve() }, "@/utils/appLock": { PIN_LENGTH: 4 },
}).default;
for (const biometric of ["face", "fingerprint", "none"]) {
  const tree = flatten(PinPad({ value: "12", onChange: value => pins.push(value), biometric,
    onBiometric: () => pins.push("biometric"), deleteLabel: "Borrar última cifra", biometricLabel: "Desbloquear biométrico" }));
  const buttons = tree.filter(node => typeof node.type === "function");
  assert.equal(buttons.length, biometric === "none" ? 11 : 12);
  for (const element of buttons) {
    const rendered = key(element.props);
    assert.equal(rendered.props.accessibilityRole, element.props.label === "Desbloquear biométrico" ? "button" : "keyboardkey");
    assert.ok(rendered.props.accessibilityLabel);
    assert.notEqual(rendered.props.accessibilityLabel, "12", "no anunciar PIN acumulado");
  }
  buttons.find(node => node.props.label === "Borrar última cifra").props.onPress();
  assert.equal(pins.at(-1), "1");
  buttons.find(node => node.props.label === "3").props.onPress(); assert.equal(pins.at(-1), "123");
  if (biometric !== "none") { buttons.find(node => node.props.label === "Desbloquear biométrico").props.onPress(); assert.equal(pins.at(-1), "biometric"); }
}
}

if (runCase("daily")) {
let selected = null, showAmounts = true;
const daily = moduleOriginal("components/DailyBarsChart.tsx", {
  "react-native": rn,
  react: { useState: initial => initial === true ? [showAmounts, fn => { showAmounts = fn(showAmounts); }] : [selected, fn => { selected = fn(selected); }] },
}).default;
const chartProps = { data: [{ day: 3, amount: 10 }, { day: 8, amount: 25 }], width: 300,
  fmt: value => `S/${value}`, fmtAxis: String, today: 0, hint: "Elegir día", formatSelected: (day, amount) => `Día ${day}, S/${amount}`,
  showAmountsLabel: "Mostrar montos", hideAmountsLabel: "Ocultar montos" };
let nodes = flatten(daily(chartProps));
let showButton = nodes.find(node => node.props.accessibilityRole === "togglebutton");
assert.ok(showButton, "el control de montos anuncia que se puede activar/desactivar");
assert.equal(showButton.props.accessibilityState.checked, true); assert.equal(showButton.props.accessibilityLabel, "Ocultar montos");
showButton.props.onPress(); assert.equal(showAmounts, false);
nodes.find(node => node.props.accessibilityLabel === "Día 8, S/25").props.onPress();
assert.equal(selected, 1);
nodes = flatten(daily(chartProps));
assert.equal(nodes.find(node => node.props.accessibilityLabel === "Día 8, S/25").props.accessibilityState.selected, true);
assert.equal(nodes.find(node => node.props.accessibilityRole === "togglebutton").props.accessibilityLabel, "Mostrar montos");
nodes.find(node => node.props.accessibilityLabel === "Día 8, S/25").props.onPress(); assert.equal(selected, null);
}

// Contratos de conexión/etiquetado estáticos: no confundirlos con TalkBack.
if (runCase("contracts")) {
const month = source("components/MonthSelector.tsx");
assert.ok(month.includes('t("monthPicker.choose", { month: label })'));
assert.ok(month.includes('accessibilityState={{ expanded: open }}'));
assert.ok(month.includes('accessibilityState={{ selected }}'));
for (const file of ["components/MonthSelector.tsx", "components/TransactionCategorySheet.tsx"]) assert.ok(source(file).includes('accessibilityLabel={t("common.close")}'));
}
// TypeScript además exige label en todos los usos de Toggle y en las teclas PIN.
console.log(`Caso ${selectedCase}: componentes originales/JSX adaptado para interruptor, PIN y barras; mes/categorías son contratos estáticos. TalkBack y toda la app pendientes.`);

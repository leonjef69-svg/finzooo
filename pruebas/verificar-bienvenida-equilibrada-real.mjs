import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { entryUIFixture } from "./helpers/entry-ui-fixture.mjs";

// JSX original y dimensiones/React adaptados. No mide el dibujado ni FPS Android.
const revision = process.env.FINO_WELCOME_BALANCE_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw Error("Revisión inválida");
const file = "screens/Onboarding.tsx";
const source = revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...(node.children ?? []).flat(Infinity).flatMap(flatten)];
for (const [width, height] of [[320, 568], [360, 640], [393, 852], [412, 915], [768, 1024]]) {
  const deps = {
    ...entryUIFixture, React, Image: "Image", Text: "Text", View: "View", Feature: "Feature",
    BusFront: "Bus", ChartPie: "Budget", PiggyBank: "Savings", Utensils: "Food",
    AuthLegalAcceptance: "Terms", GoogleButton: "Google", StyleSheet: { absoluteFill: {} },
    Platform: { OS: "android" }, useWindowDimensions: () => ({ width, height }),
    useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }),
    useCallback: callback => callback, useFocusEffect() {}, useEntryOperation: () => () => () => true,
    require: path => path, useAppData: () => ({ fmt: amount => "S/ " + amount.toFixed(2), t: key => key }),
  };
  const root = handlerOriginal(file, "Onboarding", deps, source)({ onGoogle() {}, onCreateAccount() {}, onLogin() {} });
  const nodes = flatten(root), surface = nodes.find(node => node.type === "EntryScreen");
  assert.notEqual(surface.props.center, true, "Bienvenida no agrega un hueco encima por centrar verticalmente todo el contenido");
  assert.equal(surface.props.contentStyle.paddingTop, 0);
  const image = nodes.find(node => node.type === "Image");
  assert.ok(image.props.style.width <= (Math.min(width, 460) - 46) * 0.72);
  if (height >= 720 && width >= 390) assert.ok(image.props.style.width >= 240, "la persona supera los 220 anteriores sin ocupar el ancho entero");
  const cards = nodes.filter(node => node.type === "Feature");
  assert.equal(cards.length, 4);
  const contentWidth = Math.min(width, 460) - 46;
  for (const card of cards) {
    const rendered = handlerOriginal(file, "Feature", deps, source)(card.props);
    const style = rendered.props.style;
    assert.ok(style.width <= (contentWidth - 44) / 2, "las tarjetas respetan el espacio central y el margen lateral mayor");
    assert.ok(style.minHeight >= 60);
    const labels = flatten(rendered).filter(node => node.type === "Text");
    assert.ok(labels.every(node => node.props.style.fontSize >= 13), "nombres y montos legibles");
    const placement = nodes.find(node => node.children.includes(card)).props.style;
    const inset = placement.left ?? placement.right;
    // Incluso la inclinación conserva espacio libre dentro del margen exterior.
    const angle = Math.abs(parseFloat(placement.transform[0].rotate)) * Math.PI / 180;
    const rotatedWidth = style.width * Math.cos(angle) + 92 * Math.sin(angle);
    assert.ok(23 + inset - (rotatedWidth - style.width) / 2 >= 30, "ni la inclinación acerca la tarjeta al borde");
  }
  const subtitle = nodes.find(node => node.type === "Text" && node.children.includes("onboarding.subtitle"));
  assert.equal(subtitle.props.style[1].fontSize, 16, "subtítulo ligeramente mayor, sin agrandar el título");
  assert.equal(nodes.filter(node => node.type === "EntryButton").length, 1);
  assert.equal(nodes.filter(node => node.type === "Google").length, 1);
  assert.equal(nodes.filter(node => node.type === "EntryLink").length, 1);
}
console.log("Bienvenida original/JSX adaptado: sin hueco superior, persona mayor, tarjetas y letras proporcionadas, márgenes en cinco tamaños y tres accesos conservados. Android visual/FPS se comprueban aparte.");

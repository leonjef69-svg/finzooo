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
for (const measuredHeights of [[64, 64, 64, 64], [82, 96, 100, 88], [140, 140, 140, 140]]) {
for (const [width, height] of [[320, 568], [360, 640], [393, 852], [412, 915], [768, 1024]]) {
  const deps = {
    ...entryUIFixture, React, Image: "Image", Text: "Text", View: "View", Feature: "Feature",
    BusFront: "Bus", ChartPie: "Budget", PiggyBank: "Savings", Utensils: "Food",
    AuthLegalAcceptance: "Terms", GoogleButton: "Google", StyleSheet: { absoluteFill: {} },
    Platform: { OS: "android" }, useWindowDimensions: () => ({ width, height }),
    useState: initial => [Array.isArray(initial) ? measuredHeights : initial, () => {}], useRef: initial => ({ current: initial }),
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
  for (const [index, card] of cards.entries()) {
    const rendered = handlerOriginal(file, "Feature", deps, source)(card.props);
    const style = rendered.props.style;
    assert.ok(style.width <= (contentWidth - 44) / 2, "las tarjetas respetan el espacio central y el margen lateral mayor");
    assert.ok(style.minHeight >= 60);
    const wrapper = nodes.find(node => node.children.includes(card));
    const placement = wrapper.props.style;
    assert.equal(placement.position, "absolute", "conservar la composición flotante aprobada, no separar todo en tres filas");
    assert.equal(style.justifyContent, "center", "icono y texto se centran como grupo, sin hueco sobrante a un solo lado");
    const badge = rendered.children[0], copy = rendered.children[1];
    assert.ok(badge.props.style.width >= 34 && badge.props.style.height >= 34);
    assert.equal(badge.props.style.flexShrink, 0, "el icono no pierde tamaño al estrechar la tarjeta");
    assert.notEqual(copy.props.style.flex, 1, "el texto no rellena artificialmente el hueco lateral");
    assert.equal(copy.props.style.flexShrink, 1, "una pantalla estrecha permite partir texto sin salirse");
    assert.ok(card.props.icon.props.size >= 24);
    const labels = flatten(rendered).filter(node => node.type === "Text");
    assert.ok(labels.every(node => node.props.style.fontSize >= 13), "nombres y montos legibles");
    assert.ok(labels[0].props.style.fontSize >= 15 && labels[1].props.style.fontSize >= 14);
    assert.equal(labels[1].props.numberOfLines, 2, "montos decorativos pueden ocupar dos líneas en vez de cortarse");
    const inset = placement.left ?? placement.right;
    // Incluso la inclinación conserva espacio libre dentro del margen exterior.
    const angle = Math.abs(parseFloat(placement.transform[0].rotate)) * Math.PI / 180;
    const rotatedWidth = style.width * Math.cos(angle) + measuredHeights[index] * Math.sin(angle);
    assert.ok(23 + inset - (rotatedWidth - style.width) / 2 >= 30, "ni la inclinación acerca la tarjeta al borde");
    const rotatedHeight = style.width * Math.sin(angle) + measuredHeights[index] * Math.cos(angle);
    const rotationPadding = (rotatedHeight - measuredHeights[index]) / 2;
    if (index < 2) {
      const gap = image.props.style.top + image.props.style.height * 69 / 640 - placement.top - measuredHeights[index] - rotationPadding;
      assert.ok(gap >= 9.99, "tarjeta superior separada de la cabeza incluso al crecer el texto");
    } else {
      const gap = placement.top - rotationPadding - image.props.style.top - image.props.style.height * 577 / 640;
      assert.ok(gap >= 9.99, "tarjeta inferior separada de los zapatos incluso al crecer el texto");
    }
  }
  const scene = nodes.find(node => node.children.includes(image));
  assert.equal(image.props.style.position, "absolute");
  assert.ok(Math.abs(image.props.style.width / image.props.style.height - 427 / 640) < 0.00001, "la persona conserva su proporción y no se estira");
  // En una pantalla baja se prioriza no cortar texto/persona; el ScrollView
  // común mantiene los accesos disponibles, aunque haga falta desplazar.
  if (height >= 720 && width >= 390) assert.ok(scene.props.style.height < image.props.style.height + Math.max(...measuredHeights.slice(0, 2)) + Math.max(...measuredHeights.slice(2)) + 12, "composición habitual más compacta que las tres filas separadas");
  const circle = nodes.find(node => node.type === "View" && node.props.style?.backgroundColor === entryUIFixture.ENTRY_COLORS.soft);
  assert.equal(circle.props.style.width, circle.props.style.height, "círculo redondo y proporcional");
  assert.equal(circle.props.style.borderRadius, circle.props.style.width / 2);
  assert.ok(Math.abs(circle.props.style.top + circle.props.style.height / 2 - image.props.style.top - image.props.style.height / 2) < 0.001, "círculo centrado detrás de la persona");
  if (height >= 720 && width >= 390) assert.ok(circle.props.style.width >= 270, "círculo algo mayor que los 238 anteriores");
  const subtitle = nodes.find(node => node.type === "Text" && node.children.includes("onboarding.subtitle"));
  assert.equal(subtitle.props.style[1].fontSize, 16, "subtítulo ligeramente mayor, sin agrandar el título");
  assert.equal(nodes.filter(node => node.type === "EntryButton").length, 1);
  assert.equal(nodes.filter(node => node.type === "Google").length, 1);
  assert.equal(nodes.filter(node => node.type === "EntryLink").length, 1);
}
}
let measured = [64, 64, 64, 64];
const record = handlerOriginal(file, "recordCardHeight", { setCardHeights: updater => { measured = updater(measured); } }, source);
record(0, 88.2); assert.deepEqual(measured, [89, 64, 64, 64]);
const stable = measured; record(0, 88.2); assert.equal(measured, stable, "medición igual no provoca otra actualización");
record(1, NaN); record(2, Infinity); assert.equal(measured, stable);
console.log("Bienvenida original/JSX: composición flotante, círculo mayor centrado, márgenes y separación cabeza/zapatos en cinco tamaños y tres alturas de texto; mediciones repetidas estables. Dibujo/FPS/otras marcas pendientes.");

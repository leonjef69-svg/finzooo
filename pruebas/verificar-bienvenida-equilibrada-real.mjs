import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { entryUIFixture } from "./helpers/entry-ui-fixture.mjs";

// JSX original y dimensiones/React adaptados. No mide el dibujado ni FPS Android.
const revision = process.env.FINO_WELCOME_BALANCE_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw Error("Revisión inválida");
const file = "screens/Onboarding.tsx";
const source = revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
assert.equal(createHash("sha256").update(readFileSync("assets/images/onboarding/fino-welcome-person.webp")).digest("hex"),
  "d0d796ed38b46dc1d968b0ba0e31635097f93945720dcb1e9183132223a099dc",
  "si cambia la ilustración hay que volver a medir su contorno antes de validar la colocación");
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const flatten = node => !node || typeof node !== "object" ? [] : [node, ...(node.children ?? []).flat(Infinity).flatMap(flatten)];
// Referencia de contorno medida en el WebP 427x640; no es una segunda copia
// del posicionador. Recortar el polígono contra cada banda comprueba el resultado
// con otro algoritmo, incluyendo la inclinación y un margen visible de 4.
const silhouette = [[69, 93, 176, 265], [93, 133, 171, 271], [133, 165, 173, 253],
  [165, 197, 115, 256], [197, 493, 92, 354], [493, 525, 97, 345],
  [525, 549, 139, 351], [549, 565, 161, 247], [565, 578, 187, 249]];
function clip(polygon, axis, limit, greater) {
  const result = [], inside = point => greater ? point[axis] >= limit : point[axis] <= limit;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) {
      const fraction = (limit - a[axis]) / (b[axis] - a[axis]);
      result.push([a[0] + fraction * (b[0] - a[0]), a[1] + fraction * (b[1] - a[1])]);
    }
  }
  return result;
}
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
    assert.ok(23 + inset - (rotatedWidth - style.width) / 2 >= 22, "las cuatro tarjetas se acercan a las rayas azules conservando margen incluso con la inclinación");
    if (measuredHeights.every(value => value === 64)) assert.ok(inset <= 4, "tarjetas un poco más hacia los laterales, sin alterar tamaño ni altura");
    const rotatedHeight = style.width * Math.sin(angle) + measuredHeights[index] * Math.cos(angle);
    const rotationPadding = (rotatedHeight - measuredHeights[index]) / 2;
    const left = placement.left ?? contentWidth - placement.right - style.width;
    const signedAngle = parseFloat(placement.transform[0].rotate) * Math.PI / 180;
    const polygon = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [
      left + style.width / 2 + x * style.width / 2 * Math.cos(signedAngle) - y * measuredHeights[index] / 2 * Math.sin(signedAngle),
      placement.top + measuredHeights[index] / 2 + x * style.width / 2 * Math.sin(signedAngle) + y * measuredHeights[index] / 2 * Math.cos(signedAngle),
    ]);
    for (const [from, to, first, last] of silhouette) {
      const x1 = (contentWidth - image.props.style.width) / 2 + first * image.props.style.width / 427 - 4;
      const x2 = (contentWidth - image.props.style.width) / 2 + last * image.props.style.width / 427 + 4;
      const y1 = image.props.style.top + from * image.props.style.height / 640 - 4;
      const y2 = image.props.style.top + to * image.props.style.height / 640 + 4;
      const overlap = clip(clip(clip(clip(polygon, 0, x1, true), 0, x2, false), 1, y1, true), 1, y2, false);
      const area = Math.abs(overlap.reduce((sum, a, i) => {
        const b = overlap[(i + 1) % overlap.length]; return sum + a[0] * b[1] - b[0] * a[1];
      }, 0)) / 2;
      assert.ok(area < 0.0001, `tarjeta ${index} no tapa el contorno de persona ni su margen en ${width}x${height}`);
    }
    if (height >= 720 && width >= 410 && measuredHeights.every(value => value === 64)) {
      if (index === 0) assert.ok(placement.top >= 40, "Bus baja hacia el costado de la cabeza siguiendo la referencia roja");
      if (index === 1) assert.ok(placement.top >= 28, "Comida baja hacia el costado, sin quedarse encima de la persona");
      if (index >= 2) {
        const earlierTop = image.props.style.top + image.props.style.height * 577 / 640 + (index === 2 ? 10 : 18) + rotationPadding;
        assert.ok(placement.top < earlierTop - 2, "las tarjetas inferiores se acercan un poco a los pies, sin taparlos");
      }
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
  assert.ok(circle.props.style.width <= contentWidth * 0.96, "círculo con margen lateral y sin desbordarse");
  if (height >= 720 && width >= 390) assert.ok(circle.props.style.width >= 330, "círculo ampliado de cabeza a zapatos como la referencia azul, no los 272 anteriores");
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
console.log("Bienvenida original/JSX: tarjetas hacia las referencias rojas, círculo amplio centrado, margen y contorno libre mediante recorte independiente en cinco tamaños/tres alturas de texto; mediciones estables. Dibujo/FPS/otras marcas pendientes.");

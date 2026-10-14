import { entryUIFixture } from "./helpers/entry-ui-fixture.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const revision = process.env.FINO_WELCOME_NAV_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = file => revision
  ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" })
  : readFileSync(file, "utf8");
const original = (file, name, dependencies) => handlerOriginal(file, name, dependencies, source(file));
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
const flatten = node => !node || typeof node !== "object" ? []
  : [node, ...node.children.flat(Infinity).flatMap(flatten)];

function environment() {
  let now = 10_000;
  const pushes = [], states = [], refs = [], recent = new Map();
  let stateIndex = 0, refIndex = 0, focus;
  const routeKey = original("utils/nav.ts", "claveDeRuta", {});
  const throttled = original("utils/nav.ts", "seNavegoHacePoco", {
    Date: { now: () => now }, claveDeRuta: routeKey, ultimosViajes: recent, BLOQUEO_NAVEGACION_MS: 1500,
  });
  const push = original("utils/nav.ts", "irUnaVez", {
    seNavegoHacePoco: throttled, router: { push: path => pushes.push(path) },
  });
  // Los callbacks de la ruta también son originales: no sustituir por un
  // callback que siempre navega, porque ocultaría el descarte del helper real.
  const props = original("app/onboarding.tsx", "OnboardingRoute", {
    React, useRef: initial => ({ current: initial }), Onboarding: "Onboarding", irUnaVez: push,
    useAppData: () => ({ t: key => key }),
  })().props;
  const screen = original("screens/Onboarding.tsx", "Onboarding", {
    ...entryUIFixture, useWindowDimensions: () => ({ width: 360, height: 800 }),
    Image: "Image", BusFront: "Bus", ChartPie: "Chart", PiggyBank: "Savings", Utensils: "Food", GoogleButton: "GoogleButton", StyleSheet: { absoluteFill: {} },
    React, ActivityIndicator: "Spinner", ImageBackground: "ImageBackground", ScrollView: "ScrollView",
    StatusBar: "StatusBar", Text: "Text", TouchableOpacity: "TouchableOpacity", View: "View",
    BellRing: "BellRing", ChartNoAxesCombined: "Chart", ReceiptText: "Receipt", ShieldCheck: "Shield",
    AuthLegalAcceptance: "AuthLegalAcceptance", Feature: "Feature", require: () => "original-image",
    Platform: { OS: "android" }, useSafeAreaInsets: () => ({ top: 24, bottom: 24 }),
    useAppData: () => ({ t: key => key, fmt: amount => String(amount) }),
    useCallback: callback => callback, useFocusEffect: callback => { focus = callback; },
    useEntryOperation: () => () => () => true,
    useRef: initial => { const index = refIndex++; refs[index] ??= { current: initial }; return refs[index]; },
    useState: initial => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
  });
  function render() { stateIndex = 0; refIndex = 0; return flatten(screen(props)); }
  function button(key) {
    const item = render().find(node => ((node.type === "TouchableOpacity" && node.props.accessibilityLabel === key) || (["EntryButton", "EntryLink"].includes(node.type) && node.props.label === key)));
    assert.ok(item, `botón original disponible: ${key}`);
    return item;
  }
  render(); focus();
  return {
    pushes, refs, states, props, button,
    advance: milliseconds => { now += milliseconds; },
    refocus: () => { focus(); },
  };
}

for (const [label, path, otherLabel, otherPath] of [
  ["onboarding.createAccount", "/login?mode=register", "onboarding.haveAccount", "/login"],
  ["onboarding.haveAccount", "/login", "onboarding.createAccount", "/login?mode=register"],
]) {
  const e = environment();
  e.button(label).props.onPress();
  assert.deepEqual(e.pushes, [path]);
  assert.equal(e.refs[1].current, true, "el viaje aceptado conserva el bloqueo contra doble toque");
  e.button(otherLabel).props.onPress();
  assert.deepEqual(e.pushes, [path], "un segundo destino no se apila antes de volver");

  // Android devuelve el enfoque de Bienvenida; 100 ms después se solicita
  // el mismo destino, todavía dentro del bloqueo global de 1500 ms.
  e.refocus(); e.advance(100);
  e.button(label).props.onPress();
  assert.deepEqual(e.pushes, [path], "el helper conserva su descarte original");
  assert.equal(e.refs[1].current, false, "un viaje descartado no debe dejar Bienvenida bloqueada");
  assert.equal(e.button(label).props.disabled, false, "la pantalla sin viaje permite reintentar");
  assert.equal(e.button(otherLabel).props.disabled, false, "el otro acceso también sigue disponible");

  e.button(otherLabel).props.onPress();
  assert.deepEqual(e.pushes, [path, otherPath], "se puede elegir el otro destino sin esperar un enfoque inexistente");
  e.refocus(); e.advance(1500);
  e.button(label).props.onPress();
  assert.deepEqual(e.pushes, [path, otherPath, path], "el mismo destino vuelve a navegar tras la ventana existente");
}

// Conservar callbacks antiguos de tipo void y liberar también una excepción;
// ambos casos ejecutan navigate original, no una copia del algoritmo.
const states = [], dependencies = {
  authBusy: { current: false }, navigationBusy: { current: false }, setNavigating: value => states.push(value),
};
const navigate = original("screens/Onboarding.tsx", "navigate", dependencies);
let calls = 0;
navigate(() => { calls++; });
assert.equal(calls, 1); assert.equal(dependencies.navigationBusy.current, true, "void conserva el contrato anterior");
dependencies.navigationBusy.current = false;
assert.throws(() => navigate(() => { throw new Error("router-test"); }), /router-test/);
assert.equal(dependencies.navigationBusy.current, false, "una excepción libera el botón sin ocultar el error");
assert.equal(states.at(-1), false);
dependencies.authBusy.current = true;
navigate(() => { calls++; }); assert.equal(calls, 1, "un acceso en curso sigue impidiendo navegar");

console.log("Bienvenida/ruta/helper originales con reloj, enfoque y JSX adaptados: viaje descartado libera botones; doble toque, otros destinos, reintento, callback void, excepción y Auth conservados. No acredita Android físico.");

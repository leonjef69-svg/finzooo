import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

import { formatBudgetDisplay } from "@/utils/budgetDisplay";

let montoRecibido = 0;
const exacto = formatBudgetDisplay(false, 1359, (amount) => {
  montoRecibido = amount;
  return `S/ ${amount.toLocaleString("en-US")}`;
});

assert.equal(montoRecibido, 1359, "el formateador debe recibir el monto sin redondearlo");
assert.equal(exacto, "S/ 1,359");

const oculto = formatBudgetDisplay(true, 1359, () => {
  throw new Error("un monto oculto no debe formatearse");
});
assert.equal(oculto, "••••");

const inicio = fs.readFileSync(path.join(process.cwd(), "screens/Home.tsx"), "utf8");
const idiomas = fs.readFileSync(path.join(process.cwd(), "constants/i18n.ts"), "utf8");
const pressableScale = fs.readFileSync(path.join(process.cwd(), "components/PressableScale.tsx"), "utf8");
const barra = inicio.indexOf("width: `${visiblePct}%`");
const textoAccion = inicio.indexOf('t(hasPreviousBalanceHistory ? "home.defineBudgetCompact" : "home.setMonthlyBudget")', barra);
const inicioAccion = inicio.lastIndexOf("<PressableScale", textoAccion);
const finAccion = inicio.indexOf("</PressableScale>", textoAccion);
assert.ok(barra >= 0 && textoAccion > barra && inicioAccion > barra && finAccion > textoAccion,
  "Definir presupuesto debe quedar después de la barra mensual");
const accion = inicio.slice(inicioAccion, finAccion);
assert.match(accion, /onPress=\{startEditBudget\}/, "solo la acción de presupuesto abre el editor mensual");
assert.match(accion, /accessibilityRole="button"/, "la acción de presupuesto se anuncia como botón");
assert.match(accion, /min-h-\[68px\]/, "la acción mantiene un alto cómodo sin apretar el contenido");
assert.equal((inicio.match(/onPress=\{startEditBudget\}/g) || []).length, 1,
  "el monto y la acción compacta son la única entrada al editor mensual");
const indiceMontoPresupuesto = inicio.indexOf("formatBudgetDisplay(hideBalance, budget, fmt)");
const indiceEtiquetaPresupuesto = inicio.lastIndexOf('{t("home.monthlyBudget")}', indiceMontoPresupuesto);
const inicioFilaPresupuesto = inicio.lastIndexOf('<View className="flex-row items-center justify-between gap-3">', indiceEtiquetaPresupuesto);
const finFilaPresupuesto = inicio.indexOf("</View>", indiceMontoPresupuesto);
const filaPresupuesto = inicio.slice(inicioFilaPresupuesto, finFilaPresupuesto);
assert.ok(inicioFilaPresupuesto >= 0 && finFilaPresupuesto > inicioFilaPresupuesto, "la etiqueta y el monto comparten una fila normal de texto");
assert.doesNotMatch(filaPresupuesto, /onPress|rounded-xl border border-white\/20 bg-white\/10/, "el monto del presupuesto no debe parecer un campo ni abrir el editor");
assert.match(inicio, /const hasPreviousBalanceHistory =\s*prevBalance !== 0 \|\| carryoverActive \|\| availableMonths\.some\(\(key\) => key < mk\)/,
  "el primer mes no muestra una opción para un saldo anterior inexistente");
assert.match(inicio, /hasPreviousBalanceHistory \? \(\s*<PressableScale\s+onPress=\{togglePreviousBalance\}/,
  "mostrar u ocultar saldo aparece solo cuando ya hay datos de meses anteriores");
assert.match(inicio, /min-h-\[68px\].*rounded-xl/, "las acciones mantienen una altura táctil intermedia");
assert.match(inicio, /text-\[14px\] font-bold leading-\[17px\]/, "el texto largo conserva tamaño legible y puede envolver sin truncarse");
assert.match(inicio, /containerStyle=\{\{ flexGrow: 1, flexBasis: 0, minHeight: 68 \}\}/, "ambos botones comparten ancho y la tarjeta reserva su alto real");
assert.match(inicio, /containerStyle=\{hasPreviousBalanceHistory\s*\? \{ flexGrow: 1, flexBasis: 0, minHeight: 68 \}\s*: \{ width: "100%", minHeight: 48 \}\}/,
  "el primer mes muestra el botón de presupuesto ancho y más bajo");
assert.match(inicio, /t\(hasPreviousBalanceHistory \? "home\.defineBudgetCompact" : "home\.setMonthlyBudget"\)/,
  "el primer mes usa la etiqueta completa y en meses siguientes se adapta a la fila doble");
assert.match(inicio, /hasPreviousBalanceHistory \? "text-\[14px\] leading-\[17px\]" : "text-\[15px\] leading-\[19px\]"/,
  "la etiqueta del presupuesto cabe en dos líneas cuando comparte espacio y mantiene letra mayor cuando va sola");
assert.doesNotMatch(inicio, /numberOfLines=\{3\} className="flex-1 text-center text-\[15px\]/, "el botón largo no trunca su etiqueta en tres líneas");
assert.match(inicio, /showPreviousBalanceCard \? \(\s*<EyeOff size=\{18\}/, "al ocultar la tarjeta se ve el ojo cerrado");
assert.match(inicio, /\) : \(\s*<Eye size=\{18\}/, "al mostrar el saldo aparece el ojo abierto");
assert.match(pressableScale, /scale\.value = withSpring\(0\.96/, "el botón da una respuesta visual sutil al tocarlo");
assert.match(pressableScale, /scale\.value = withSpring\(1,/, "el botón vuelve suavemente a su tamaño al soltarlo");
assert.match(pressableScale, /accessibilityRole=\{accessibilityRole\}/, "el control animado conserva su rol accesible");
assert.match(inicio, /home\.showPreviousBalanceCompact/);
assert.match(idiomas, /"home\.showPreviousBalanceCompact": "Mostrar saldo del mes anterior"/);
assert.match(idiomas, /"home\.hidePreviousBalanceCompact": "Ocultar saldo del mes anterior"/);
assert.ok(idiomas.includes('"home.defineBudgetCompact": "Definir presupuesto\\nmensual"'),
  "la acción de presupuesto muestra mensual en otra línea, sin comprimir el texto");
assert.doesNotMatch(inicio, /<Chevron(?:Down|Up) size=\{16\} color=\{previousActionText\}/, "la acción de saldo no usa una flecha como icono");
assert.match(inicio, /showPreviousBalanceCard \? <Animated\.View entering=\{FadeInDown\.duration\(220\)\} exiting=\{FadeOutUp\.duration\(180\)\}/,
  "la tarjeta anterior entra y sale con una transición breve");
assert.match(inicio, /layout=\{LinearTransition\.duration\(240\)\}/,
  "el contenido inferior acompaña el alto de la tarjeta con una transición suave");
assert.match(inicio, /className=\{`min-w-0 flex-1 text-base font-bold \$\{peachOlive \? "text-emerald-800" : "text-emerald-100"\}`\}>\s*\{t\("home\.monthlyBudget"\)\}/,
  "Presupuesto del mes debe resaltarse con texto un poco más grande");
assert.match(inicio, /className="mt-2 h-2 overflow-hidden rounded-full"\s+style=\{\{ backgroundColor: peachOlive \? "rgba\(101, 118, 74, 0\.16\)" : "rgba\(255, 255, 255, 0\.27\)" \}\}/,
  "la barra de presupuesto queda algo más gruesa y su fondo se adapta al tema");
assert.match(inicio, /className="flex-1 text-base text-slate-600 dark:text-slate-200 font-semibold" numberOfLines=\{1\}>\s*\{t\("home\.spent"\)\}/,
  "Gastado mantiene el rótulo legible junto a la flecha y en una sola línea");
assert.match(inicio, /className="flex-1 text-base text-slate-600 dark:text-slate-200 font-semibold" numberOfLines=\{1\}>\s*\{t\("home\.income"\)\}/,
  "Ingresos mantiene el rótulo legible junto a la flecha y en una sola línea");

console.log("El presupuesto conserva el monto exacto y separa presupuesto y saldo anterior.");

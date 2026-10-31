import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync("screens/Home.tsx", "utf8");
const gastoLabel = home.indexOf('t("home.spent")');
const ingresoLabel = home.indexOf('t("home.income")', gastoLabel);
const cierreGasto = home.indexOf("</PressableScale>", gastoLabel);
const cierreIngreso = home.indexOf("</PressableScale>", ingresoLabel);
const gasto = home.slice(home.lastIndexOf("<PressableScale", gastoLabel), cierreGasto);
const ingreso = home.slice(home.lastIndexOf("<PressableScale", ingresoLabel), cierreIngreso);

assert.ok(gastoLabel > 0 && ingresoLabel > gastoLabel, "se encontraron las dos tarjetas de resumen");
assert.match(gasto, /<ArrowDown size=\{18\} color=\{colorScheme === "dark" \? "#ffffff" : "#f43f5e"\} strokeWidth=\{2\.6\} \/>/,
  "Gastado usa una flecha hacia abajo del color de gasto");
assert.match(ingreso, /<ArrowUp size=\{18\} color=\{colorScheme === "dark" \? "#ffffff" : "#059669"\} strokeWidth=\{2\.6\} \/>/,
  "Ingresos usa una flecha hacia arriba del color de ingreso");
assert.doesNotMatch(`${gasto}\n${ingreso}`, /📉|📈/, "las tarjetas ya no usan iconos de gráfica");
assert.match(gasto, /text-base text-slate-600.*numberOfLines=\{1\}/,
  "el rótulo de gasto es más grande y queda alineado con su flecha");
assert.match(ingreso, /text-base text-slate-600.*numberOfLines=\{1\}/,
  "el rótulo de ingreso es más grande y queda alineado con su flecha");
assert.match(gasto, /minHeight: 68/);
assert.match(ingreso, /minHeight: 68/);
assert.match(gasto, /px-3 py-2/);
assert.match(ingreso, /px-3 py-2/);

console.log("Tarjetas de Gastado e Ingresos: flechas claras, rótulos legibles y altura compacta.");

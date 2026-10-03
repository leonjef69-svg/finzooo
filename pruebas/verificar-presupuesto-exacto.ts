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
const barra = inicio.indexOf("width: `${visiblePct}%`");
const textoAccion = inicio.indexOf('{t("home.setMonthlyBudget")}', barra);
const inicioAccion = inicio.lastIndexOf("<TouchableOpacity", textoAccion);
const finAccion = inicio.indexOf("</TouchableOpacity>", textoAccion);
assert.ok(barra >= 0 && textoAccion > barra && inicioAccion > barra && finAccion > textoAccion,
  "Definir presupuesto debe aparecer como texto bajo la barra del mes");
const accion = inicio.slice(inicioAccion, finAccion);
assert.match(accion, /onPress=\{startEditBudget\}/, "el texto abre el editor mensual existente");
assert.match(accion, /accessibilityRole="button"/, "el texto es accesible como botón");
assert.equal((inicio.match(/onPress=\{startEditBudget\}/g) || []).length, 1,
  "no debe quedar el botón ancho anterior como segundo acceso al editor");
assert.match(inicio, /className=\{`text-sm font-bold \$\{peachOlive \? "text-emerald-800" : "text-emerald-100"\}`\}>\{t\("home\.monthlyBudget"\)\}/,
  "Presupuesto del mes debe tener el mismo tamaño que Saldo del mes anterior");
assert.match(inicio, /className="flex-1 text-sm text-slate-600 dark:text-slate-200 font-semibold" numberOfLines=\{2\}>\s*\{t\("home\.spent"\)\}/,
  "Gastado debe tener el mismo tamaño que Saldo del mes anterior");
assert.match(inicio, /className="flex-1 text-sm text-slate-600 dark:text-slate-200 font-semibold" numberOfLines=\{2\}>\s*\{t\("home\.income"\)\}/,
  "Ingresos debe tener el mismo tamaño que Saldo del mes anterior");

console.log("El presupuesto conserva el monto exacto y respeta el modo oculto.");

import assert from "node:assert/strict";
import fs from "node:fs";

const history = fs.readFileSync("screens/History.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const reports = fs.readFileSync("screens/Reports.tsx", "utf8");
const selector = fs.readFileSync("components/MonthSelector.tsx", "utf8");
const translations = fs.readFileSync("constants/i18n.ts", "utf8");

assert.match(history, /<MonthSelector[^>]*showMovementCount/, "Historial activa el conteo dentro de la lista de meses");
assert.match(home, /<MonthSelector[^>]*showMovementCount/, "Inicio activa el conteo dentro de la lista de meses");
assert.doesNotMatch(reports, /<MonthSelector[^>]*showMovementCount/, "Reportes conserva su selector actual sin el conteo solicitado");
assert.doesNotMatch(history, /monthMovementLabel|subtitle=\{/, "el conteo no aparece bajo el selector cerrado");
assert.match(selector, /compactPersonalTransferRows\(grouped\[key\]\)\.length/, "el conteo coincide con las tarjetas visibles y no duplica transferencias agrupadas");
assert.match(selector, /monthMovementCounts\[key\] === 1[\s\S]*?monthPicker\.oneMovement[\s\S]*?monthPicker\.manyMovements/, "cada mes muestra debajo la cantidad con singular/plural correcto");
for (const key of ["monthPicker.oneMovement", "monthPicker.manyMovements"]) {
  assert.equal(translations.split(`"${key}":`).length - 1, 3, `${key} está traducida en español, inglés y portugués`);
}

console.log("Inicio e Historial: cada mes muestra su conteo dentro de la lista; otras pantallas no cambian.");

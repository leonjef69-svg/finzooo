import assert from "node:assert/strict";
import fs from "node:fs";

const history = fs.readFileSync("screens/History.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const reports = fs.readFileSync("screens/Reports.tsx", "utf8");
const selector = fs.readFileSync("components/MonthSelector.tsx", "utf8");
const translations = fs.readFileSync("constants/i18n.ts", "utf8");

assert.match(history, /<MonthSelector[^>]*showMovementCount/, "Historial activa el conteo dentro de la lista de meses");
assert.match(home, /<MonthSelector[^>]*showMovementCount/, "Inicio activa el conteo dentro de la lista de meses");
assert.match(reports, /<MonthSelector[^>]*showMovementCount/, "Reportes también muestra cuántos movimientos hay en cada mes");
assert.doesNotMatch(history, /monthMovementLabel|subtitle=\{/, "el conteo no aparece bajo el selector cerrado");
assert.match(selector, /personalMonthlyMovementCounts\(transactions, months\)/, "el conteo usa las mismas filas visibles y agrupadas que Personal");
assert.match(home, /personalMovementRowsByDay\(monthTx\)/, "la lista de Personal y el conteo comparten el mismo agrupamiento de filas");
assert.doesNotMatch(selector, /compactPersonalTransferRows\(grouped\[key\]\)\.length/, "no suma movimientos ocultos ni agrupa transferencias de distintos días como una sola");
assert.match(selector, /saldoLibre\(personalBalance, reservedSavings\)/, "el saldo mensual resta lo reservado en metas, igual que Personal");
assert.match(selector, /monthMovementCounts\[key\] === 1[\s\S]*?monthPicker\.oneMovement[\s\S]*?monthPicker\.manyMovements/, "cada mes muestra debajo la cantidad con singular/plural correcto");
for (const key of ["monthPicker.oneMovement", "monthPicker.manyMovements"]) {
  assert.equal(translations.split(`"${key}":`).length - 1, 3, `${key} está traducida en español, inglés y portugués`);
}

console.log("Personal, Historial y Reportes: conteos de filas visibles por mes y saldo libre coherente con las metas.");

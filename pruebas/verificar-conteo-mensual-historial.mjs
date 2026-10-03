import assert from "node:assert/strict";
import fs from "node:fs";

const history = fs.readFileSync("screens/History.tsx", "utf8");
const selector = fs.readFileSync("components/MonthSelector.tsx", "utf8");
const translations = fs.readFileSync("constants/i18n.ts", "utf8");

assert.match(history, /compactPersonalTransferRows\(allMonthTx\)\.length/, "el conteo corresponde a las tarjetas visibles del mes y no duplica transferencias agrupadas");
assert.match(history, /subtitle=\{monthMovementLabel\}/, "el conteo del mes se muestra debajo de su nombre en Historial");
assert.match(selector, /\{subtitle \? <Text[\s\S]*?\{subtitle\}<\/Text> : null\}/, "el selector presenta el subtítulo sin alterar Inicio ni Reportes");
for (const key of ["history.monthMovementOne", "history.monthMovementMany"]) {
  assert.equal(translations.split(`"${key}":`).length - 1, 3, `${key} está traducida en español, inglés y portugués`);
}

console.log("Historial: el mes muestra su conteo visible y el selector conserva el diseño de las demás pantallas.");

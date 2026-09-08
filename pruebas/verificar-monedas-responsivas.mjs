import fs from "node:fs";
import assert from "node:assert/strict";

const formato = fs.readFileSync("utils/format.ts", "utf8");
const reports = fs.readFileSync("screens/Reports.tsx", "utf8");
const daily = fs.readFileSync("components/DailyBarsChart.tsx", "utf8");
const donut = fs.readFileSync("components/DonutChart.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const friendlyName = fs.readFileSync("utils/friendlyName.ts", "utf8");

assert.match(formato, /currencyDecimals/);
assert.match(formato, /fmtCompact/);
assert.match(formato, /PUNTO_PARA_MILES/);
assert.match(formato, /"CLP"/);
assert.match(reports, /fmtCompact/);
assert.match(reports, /minimumFontScale/);
// La muestra llena debe ser solo de desarrollo y alimentar ambas gráficas
// sin crear movimientos ficticios ni reemplazar las cuentas del reporte.
assert.match(reports, /__DEV__\s*&&/);
assert.match(reports, /Array\.from\(\{ length: 31 \}/);
assert.match(reports, /shownBarData/);
assert.match(reports, /shownDaily/);
assert.doesNotMatch(reports, /setTransactions\([^)]*preview/i);
assert.match(reports, /\? "<1%"/, "los gastos pequeños no se muestran falsamente como 0%");
assert.ok(!reports.includes("Fino IA"), "Reportes ya no muestra Fino IA");
assert.ok(
  reports.lastIndexOf('t("reports.byDayTitle")') < reports.lastIndexOf('t("reports.byMonth")'),
  "el gasto diario aparece antes del gasto mensual",
);
assert.match(daily, /fmtAxis/);
assert.match(donut, /MIN_VISIBLE_FRACTION/, "la dona conserva visibles los segmentos menores al 1%");
assert.doesNotMatch(home, /home\.greeting|friendlyName\(userName\)/, "Inicio no desperdicia alto con un saludo");
assert.match(home, /w-\[140px\]/, "el mes tiene un ancho compacto y estable en la cabecera");
assert.ok(
  home.indexOf("<ThemeToggleButton />") < home.lastIndexOf("<Bell"),
  "apariencia y avisos quedan en esquinas opuestas",
);
assert.match(home, /adjustsFontSizeToFit/);
assert.match(friendlyName, /includes\("@"\)/);

console.log("✓ Las monedas grandes usan formato compacto y no deforman reportes.");

import fs from "node:fs";
import assert from "node:assert/strict";

const formato = fs.readFileSync("utils/format.ts", "utf8");
const reports = fs.readFileSync("screens/Reports.tsx", "utf8");
const dailyCalendar = fs.readFileSync("components/DailyActivityCalendar.tsx", "utf8");
const donut = fs.readFileSync("components/DonutChart.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const monthSelector = fs.readFileSync("components/MonthSelector.tsx", "utf8");

assert.match(formato, /currencyDecimals/);
assert.match(formato, /fmtCompact/);
assert.match(formato, /PUNTO_PARA_MILES/);
assert.match(formato, /"CLP"/);
assert.match(reports, /fmtCompact/);
assert.match(reports + donut, /minimumFontScale/);
// La muestra llena debe ser solo de desarrollo y alimentar ambas gráficas
// sin crear movimientos ficticios ni reemplazar las cuentas del reporte.
assert.match(reports, /__DEV__\s*&&/);
assert.match(reports, /new Date\(month\.y, month\.m \+ 1, 0\)\.getDate\(\)/);
assert.match(reports, /shownBarData/);
assert.match(reports, /shownDaily/);
assert.doesNotMatch(reports, /setTransactions\([^)]*preview/i);
assert.ok(!reports.includes("Fino IA"), "Reportes ya no muestra Fino IA");
assert.ok(
  reports.indexOf("<DailyActivityCalendar") < reports.indexOf('t("reports.byMonth")'),
  "el calendario diario aparece antes del gasto mensual",
);
assert.match(dailyCalendar, /numberOfLines=\{2\}/);
assert.doesNotMatch(dailyCalendar, /minimumFontScale=\{0\.68\}/);
assert.doesNotMatch(home, /home\.greeting|friendlyName\(userName\)/, "Inicio no desperdicia alto con un saludo");
assert.match(home, /<MonthSelector\b/, "Inicio usa el selector de meses reutilizable");
assert.match(monthSelector, /max-w-\[132px\]/, "el mes tiene un ancho compacto y estable en la cabecera");
assert.doesNotMatch(home, /ThemeToggleButton/, "Inicio no repite un icono para cambiar la apariencia");
assert.match(home, /adjustsFontSizeToFit/);

console.log("✓ Las monedas grandes usan formato compacto y no deforman reportes.");

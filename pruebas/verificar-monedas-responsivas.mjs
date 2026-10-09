import fs from "node:fs";
import assert from "node:assert/strict";

const formato = fs.readFileSync("utils/format.ts", "utf8");
const reports = fs.readFileSync("screens/Reports.tsx", "utf8");
const daily = fs.readFileSync("components/DailyBarsChart.tsx", "utf8");
const donut = fs.readFileSync("components/DonutChart.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const monthSelector = fs.readFileSync("components/MonthSelector.tsx", "utf8");

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
assert.match(donut, /textoPorcentajeRosquilla/, "la gráfica muestra el porcentaje real y conserva las categorías menores a 1%");
assert.match(donut, /const orbitY = count === 1 \? 126 :/, "con una sola categoría se separa la etiqueta para que la línea del gráfico sea visible");
assert.match(donut, /const height = count === 1 \? 280 :/, "la separación de la etiqueta única no recorta el gráfico");
assert.match(donut, /strokeWidth=\{1\.8\}/, "los conectores curvos tienen grosor visible también con varias categorías");
assert.match(donut, /strokeOpacity=\{1\}/, "los conectores conservan todo su contraste");
assert.ok(
  (donut.match(/stroke=\{item\.color\}/g) ?? []).length >= 2,
  "cada conector conserva el mismo color que su porción de la dona",
);
assert.ok(!reports.includes("Fino IA"), "Reportes ya no muestra Fino IA");
assert.ok(
  reports.lastIndexOf('t("reports.byDayTitle")') < reports.lastIndexOf('t("reports.byMonth")'),
  "el gasto diario aparece antes del gasto mensual",
);
assert.match(daily, /fmtAxis/);
assert.match(donut, /ajustarValoresRosquilla/, "los segmentos pequeños se realzan sin perder el peso de la categoría dominante");
const donutGeometry = fs.readFileSync("utils/donutGeometry.ts", "utf8");
assert.match(donutGeometry, /MINIMUM_VISUAL_FRACTION = 0\.03/, "las porciones mínimas parten de un tamaño que se distingue");
assert.match(donutGeometry, /MAX_SMALL_VISUAL_SHARE = 0\.18/, "las categorías pequeñas comparten un tope visual global");
assert.doesNotMatch(home, /home\.greeting|friendlyName\(userName\)/, "Inicio no desperdicia alto con un saludo");
assert.match(home, /<MonthSelector\b/, "Inicio usa el selector de meses reutilizable");
assert.match(monthSelector, /max-w-\[132px\]/, "el mes tiene un ancho compacto y estable en la cabecera");
assert.doesNotMatch(home, /ThemeToggleButton/, "Inicio no repite un icono para cambiar la apariencia");
assert.match(home, /adjustsFontSizeToFit/);

console.log("✓ Las monedas grandes usan formato compacto y no deforman reportes.");

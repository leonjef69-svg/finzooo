import fs from "node:fs";
import assert from "node:assert/strict";

const formato = fs.readFileSync("utils/format.ts", "utf8");
const reports = fs.readFileSync("screens/Reports.tsx", "utf8");
const daily = fs.readFileSync("components/DailyBarsChart.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const friendlyName = fs.readFileSync("utils/friendlyName.ts", "utf8");

assert.match(formato, /currencyDecimals/);
assert.match(formato, /fmtCompact/);
assert.match(formato, /PUNTO_PARA_MILES/);
assert.match(formato, /"CLP"/);
assert.match(reports, /fmtCompact/);
assert.match(reports, /minimumFontScale/);
assert.match(daily, /fmtAxis/);
assert.match(home, /friendlyName/);
assert.match(home, /adjustsFontSizeToFit/);
assert.match(friendlyName, /includes\("@"\)/);

console.log("✓ Las monedas grandes usan formato compacto y no deforman reportes.");

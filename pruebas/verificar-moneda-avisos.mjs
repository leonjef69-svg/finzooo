import fs from "node:fs";

const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const effect = context.match(/useEffect\(\(\) => \{\s*if \(!ready\) return;\s*saveJSON\(STORAGE_KEYS\.pagosProgramados,[\s\S]*?\n  \}, \[([^\]]+)\]\);/);

if (!effect) throw new Error("No se encontró la programación de avisos del calendario");
if (!effect[1].split(",").map((part) => part.trim()).includes("userCurrency")) {
  throw new Error("Cambiar la moneda debe actualizar los avisos ya programados");
}
if (!/const formatForNotification = \(amount: number\) => formatAmount\(amount, currencySymbolFor\(userCurrency\), userCurrency\);/.test(effect[0])) {
  throw new Error("Los avisos deben formatear los montos con la moneda actual");
}

console.log("Los avisos del calendario se actualizan al cambiar la moneda");

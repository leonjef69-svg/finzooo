import fs from "node:fs";

const codigo = fs.readFileSync("utils/duplicates.ts", "utf8");
if (!codigo.includes("daysBetween(existing.date, incoming.date) > 14")) {
  console.error("FALLA: cada fila importada todavía recorre y compara todo el historial.");
  process.exit(1);
}
console.log("Todo bien: los duplicados se buscan en una ventana cercana de fechas");

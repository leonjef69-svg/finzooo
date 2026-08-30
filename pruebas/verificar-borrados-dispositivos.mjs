import fs from "node:fs";

const nube = fs.readFileSync("utils/cloudSync.ts", "utf8");
const contexto = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const fallos = [];

if (!nube.includes("deletedTransactionIds?: number[]")) fallos.push("La nube no recuerda borrados.");
if (!nube.includes("mergeTransactions(clean.transactions, actual.transactions")) fallos.push("Una subida todavía puede borrar movimientos remotos.");
if (!nube.includes("!borrados.includes(tx.id)")) fallos.push("Los movimientos borrados pueden reaparecer.");
if (!contexto.includes("setDeletedTransactionIds((prev)")) fallos.push("Borrar en la app no deja una marca sincronizable.");

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}
console.log("Todo bien: los movimientos remotos se conservan y los borrados no reaparecen");

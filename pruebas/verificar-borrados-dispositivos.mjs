import fs from "node:fs";

const nube = fs.readFileSync("utils/cloudSync.ts", "utf8");
const contexto = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const fallos = [];

if (!nube.includes("deletedTransactionIds?: number[]")) fallos.push("La nube no recuerda borrados.");
if (!nube.includes("mergeTransactionCopies(clean.transactions, actual.transactions")) fallos.push("La subida no usa el protocolo común de copias.");
if (!nube.includes("deletedTransactionIds: records.deletedIds")) fallos.push("La subida no conserva los borrados efectivos.");
if (!contexto.includes("prepareTransactionMutation(source.transactions") || !contexto.includes("STORAGE_KEYS.cloudSyncMeta], async")) fallos.push("El borrado no prepara y guarda su comprobante junto al movimiento.");

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}
console.log("Contrato estático de copias/borrados y lote local presente; SDK/ciclo/SQLite se comprueban aparte. No es Android.");

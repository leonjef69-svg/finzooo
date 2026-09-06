import fs from "node:fs";

const storage = fs.readFileSync("utils/storage.ts", "utf8");
const contexto = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const textos = fs.readFileSync("constants/i18n.ts", "utf8");
const fallos = [];

if (!storage.includes("export function subscribeStorageWriteErrors")) {
  fallos.push("El guardado local no permite informar sus fallos.");
}
if (!storage.includes(".catch(() => {\n      reportStorageWriteError();")) {
  fallos.push("El guardado agrupado todavía oculta sus errores.");
}
if (!contexto.includes("subscribeStorageWriteErrors(() =>")) {
  fallos.push("La app no escucha los errores del almacenamiento.");
}
if ((textos.match(/"toast\.localSaveFailed"/g) ?? []).length !== 3) {
  fallos.push("El aviso de guardado debe existir en los tres idiomas.");
}

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}

console.log("Guardado local: un fallo real ya no se presenta como éxito.");

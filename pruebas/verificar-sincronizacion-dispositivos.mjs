import fs from "node:fs";

const contexto = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const fallos = [];

if (!contexto.includes('state === "active"')) {
  fallos.push("Fino no resincroniza al volver al primer plano.");
}
if (!contexto.includes("mergeTransactions(locales, cloud.transactions)")) {
  fallos.push("Los movimientos de otro dispositivo reemplazan la lista en vez de fusionarse.");
}
if (!contexto.includes("void sincronizarMovimientos();")) {
  fallos.push("La sincronización no se ejecuta al entrar con una sesión existente.");
}

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}
console.log("Todo bien: Fino recoge movimientos de otros dispositivos al entrar y regresar");

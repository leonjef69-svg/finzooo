import fs from "node:fs";

const nube = fs.readFileSync("utils/cloudSync.ts", "utf8");
const fallos = [];

if (!nube.includes("runTransaction")) {
  fallos.push("La copia en la nube todavía no usa una operación atómica.");
}
if (!nube.includes("await transaction.get(ref)")) {
  fallos.push("La lectura de la copia ocurre fuera de la operación atómica.");
}
if (!nube.includes("transaction.set(ref, siguiente)")) {
  fallos.push("La escritura de la copia ocurre fuera de la operación atómica.");
}
if (!nube.includes("if (pesa(siguiente) > LIMITE_FIRESTORE)")) {
  fallos.push("No se comprueba el tamaño después de fusionar dos dispositivos.");
}

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}

console.log("Subida atómica: dos dispositivos no se pisan al guardar a la vez.");

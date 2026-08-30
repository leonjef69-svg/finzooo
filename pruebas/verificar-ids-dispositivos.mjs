import fs from "node:fs";

const codigo = fs.readFileSync("utils/id.ts", "utf8");
const fallos = [];

if (/lastId\s*=\s*now\s*>\s*lastId\s*\?\s*now/.test(codigo)) {
  fallos.push("El identificador todavía depende únicamente de Date.now().");
}
if (!codigo.includes("Math.random() * 4096")) {
  fallos.push("Falta separar los identificadores creados por dispositivos distintos.");
}
if (!codigo.includes("now * 4096")) {
  fallos.push("El identificador dejó de conservar el orden temporal.");
}

if (fallos.length) {
  fallos.forEach((fallo) => console.error("FALLA:", fallo));
  process.exit(1);
}
console.log("Todo bien: dos dispositivos no dependen solo del mismo milisegundo");

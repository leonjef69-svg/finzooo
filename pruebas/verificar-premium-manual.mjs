import fs from "fs";

const archivo = fs.readFileSync("utils/cloudSync.ts", "utf8");

const fallos = [];

if (!archivo.includes("export function conservarPremiumManual")) {
  fallos.push("Falta la función que protege el Premium manual.");
}

if (!archivo.includes("actualEnLaNube?.isPremium === true")) {
  fallos.push("No se comprueba si Firebase ya tenía Premium verdadero.");
}

if (!archivo.includes("return { ...siguiente, isPremium: true };")) {
  fallos.push("No se conserva isPremium:true cuando ya estaba en la nube.");
}

if (!archivo.includes("const snap = await transaction.get(ref);")) {
  fallos.push("saveCloudData no lee el documento actual dentro de la operación atómica.");
}

if (!archivo.includes("let siguiente = conservarPremiumManual(actual, clean);")) {
  fallos.push("saveCloudData no protege Premium antes de escribir.");
}

if (fallos.length) {
  for (const fallo of fallos) console.error("FALLA:", fallo);
  process.exit(1);
}

console.log("OK premium manual protegido");

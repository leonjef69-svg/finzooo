import fs from "node:fs";

const home = fs.readFileSync("screens/Home.tsx", "utf8");
const fallos = [];

if (!/accessibilityLabel="Abrir notificaciones"/.test(home)) {
  fallos.push("la campana no explica que abre las notificaciones");
}
if (!/onPress=\{\(\) => setAvisosAbiertos\(\(value\) => !value\)\}/.test(home)) {
  fallos.push("la campana no abre y cierra su panel");
}
if (!/Importación pendiente[\s\S]*Próxima exportación/.test(home)) {
  fallos.push("el panel no reúne importaciones y exportaciones comprobables");
}
if (!/\{hayNotificaciones \? \([\s\S]*bg-rose-500[\s\S]*\) : null\}/.test(home)) {
  fallos.push("el punto rojo no representa todos los avisos reales");
}

if (fallos.length) {
  console.error(fallos.map((f) => `FALLA: ${f}`).join("\n"));
  process.exit(1);
}

console.log("La campana reúne avisos reales sin sacar al usuario de Inicio");

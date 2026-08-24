import fs from "node:fs";

const home = fs.readFileSync("screens/Home.tsx", "utf8");
const fallos = [];

if (!/accessibilityLabel=\{t\("calendario\.titulo"\)\}/.test(home)) {
  fallos.push("la campana no explica que abre el calendario");
}
if (!/onPress=\{\(\) => irUnaVez\("\/calendario"\)\}/.test(home)) {
  fallos.push("la campana sigue sin abrir el calendario");
}
if (!/\{hayPagosUrgentes \? \([\s\S]*bg-rose-500[\s\S]*\) : null\}/.test(home)) {
  fallos.push("el punto rojo sigue apareciendo aunque no haya pagos urgentes");
}

if (fallos.length) {
  console.error(fallos.map((f) => `FALLA: ${f}`).join("\n"));
  process.exit(1);
}

console.log("La campana abre el calendario y solo avisa cuando corresponde");

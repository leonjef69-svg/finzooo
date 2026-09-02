import fs from "node:fs";
import assert from "node:assert/strict";

const home = fs.readFileSync("screens/Home.tsx", "utf8");

assert.match(
  home,
  /\{fmt\(budget\)\}/,
  "el presupuesto debe enseñar el monto exacto escrito por el usuario",
);
assert.doesNotMatch(
  home,
  /\{fmtCompact\(budget\)\}/,
  "el presupuesto no debe redondear 1,359 como 1.4 mil",
);

console.log("El presupuesto del Inicio conserva el monto exacto.");

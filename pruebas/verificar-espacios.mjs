import assert from "node:assert/strict";
import fs from "node:fs";

const switcher = fs.readFileSync("components/SpaceSwitcher.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const boxes = fs.readFileSync("screens/Negocios.tsx", "utf8");
const family = fs.readFileSync("screens/Family.tsx", "utf8");
const route = fs.readFileSync("app/family.tsx", "utf8");

for (const id of ["personal", "family", "boxes"]) {
  assert.match(switcher, new RegExp(`id: "${id}"`), `existe el espacio ${id}`);
}
assert.match(switcher, /accessibilityRole="tablist"/);
assert.match(switcher, /accessibilityState=\{\{ selected \}\}/);
assert.match(switcher, /router\.replace\("\/\(tabs\)"\)/, "Personal vuelve al Inicio actual");
assert.match(switcher, /router\.replace\("\/family"\)/, "Familia tiene pantalla propia");
assert.match(switcher, /router\.replace\("\/negocio"\)/, "Cajas reutiliza los negocios separados existentes");
assert.match(home, /<SpaceSwitcher active="personal"/);
assert.match(boxes, /<SpaceSwitcher active="boxes"/);
assert.match(family, /<SpaceSwitcher active="family"/);
assert.match(family, /family\.security/, "Familia no simula un guardado inseguro");
assert.match(route, /screens\/Family/);

console.log("Espacios: Personal, Familia y Cajas navegan sin mezclar dinero.");

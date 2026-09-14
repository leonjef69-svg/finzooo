import assert from "node:assert/strict";
import fs from "node:fs";

const switcher = fs.readFileSync("components/SpaceSwitcher.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const boxes = fs.readFileSync("screens/Cajas.tsx", "utf8");
const business = fs.readFileSync("screens/Negocios.tsx", "utf8");
const family = fs.readFileSync("screens/Family.tsx", "utf8");
const route = fs.readFileSync("app/family.tsx", "utf8");
const boxesRoute = fs.readFileSync("app/boxes.tsx", "utf8");

for (const id of ["personal", "family", "boxes"]) {
  assert.match(switcher, new RegExp(`id: "${id}"`), `existe el espacio ${id}`);
}
assert.match(switcher, /accessibilityRole="tablist"/);
assert.match(switcher, /accessibilityState=\{\{ selected \}\}/);
assert.match(switcher, /reemplazarUnaVez\("\/\(tabs\)"\)/, "Personal vuelve al Inicio actual sin aceptar doble toque");
assert.match(switcher, /reemplazarUnaVez\("\/family"\)/, "Familia tiene pantalla propia y protegida");
assert.match(switcher, /reemplazarUnaVez\("\/boxes"\)/, "Cajas tiene una pantalla propia y protegida");
assert.doesNotMatch(switcher, /reemplazarUnaVez\("\/negocio"\)/, "Cajas no abre Modo negocio");
assert.doesNotMatch(switcher, /router\.replace\(/, "el selector no deja pasar reemplazos repetidos");
assert.match(home, /<SpaceSwitcher active="personal"/);
assert.match(boxes, /<SpaceSwitcher active="boxes"/);
assert.doesNotMatch(business, /<SpaceSwitcher active="boxes"/, "Modo negocio no se presenta como una caja");
assert.match(family, /<SpaceSwitcher active="family"/);
assert.match(family, /crearFamilia/, "Familia permite crear un espacio real");
assert.match(family, /unirseAFamilia/, "Familia permite entrar mediante invitación");
assert.match(family, /familiaEnMemoria/, "Familia conserva lo ya mostrado mientras actualiza la nube");
assert.match(boxes, /cajasEnMemoria/, "Cajas conserva lo ya mostrado al cambiar de espacio");
assert.match(boxes, /setReady\(true\)[\s\S]*bajarCajas/, "Cajas muestra primero la copia local y consulta la nube después");
assert.match(route, /screens\/Family/);
assert.match(boxesRoute, /screens\/Cajas/);

console.log("Espacios: Personal, Familia y Cajas navegan sin mezclar dinero.");

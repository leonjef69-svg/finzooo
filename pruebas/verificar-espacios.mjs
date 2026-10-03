import assert from "node:assert/strict";
import fs from "node:fs";

const switcher = fs.readFileSync("components/SpaceSwitcher.tsx", "utf8");
const home = fs.readFileSync("screens/Home.tsx", "utf8");
const boxes = fs.readFileSync("screens/Cajas.tsx", "utf8");
const business = fs.readFileSync("screens/Negocios.tsx", "utf8");
const family = fs.readFileSync("screens/Family.tsx", "utf8");
const route = fs.readFileSync("app/family.tsx", "utf8");
const boxesRoute = fs.readFileSync("app/boxes.tsx", "utf8");
const boxesMemory = fs.readFileSync("utils/cajasMemoria.ts", "utf8");
const layout = fs.readFileSync("app/_layout.tsx", "utf8");

for (const id of ["personal", "family", "boxes"]) {
  assert.match(switcher, new RegExp(`id: "${id}"`), `existe el espacio ${id}`);
}
assert.match(switcher, /accessibilityRole="tablist"/);
assert.match(switcher, /accessibilityState=\{\{ selected \}\}/);
assert.match(switcher, /reemplazarUnaVez\("\/\(tabs\)"\)/, "Personal vuelve al Inicio actual sin aceptar doble toque");
assert.match(switcher, /reemplazarUnaVez\("\/family"\)/, "Familia tiene pantalla propia y protegida");
assert.match(switcher, /reemplazarUnaVez\("\/boxes"\)/, "Cajas tiene una pantalla propia y protegida");
assert.match(layout, /<Stack\.Screen name="family"/, "la ruta principal de Familia queda registrada en el navegador raíz");
assert.match(layout, /<Stack\.Screen name="boxes"/, "la ruta principal de Cajas queda registrada en el navegador raíz");
assert.doesNotMatch(switcher, /reemplazarUnaVez\("\/negocio"\)/, "Cajas no abre Modo negocio");
assert.doesNotMatch(switcher, /router\.replace\(/, "el selector no deja pasar reemplazos repetidos");
assert.match(home, /<SpaceSwitcher active="personal"/);
for (const [screen, source] of [["Personal", home], ["Familia", family], ["Cajas", boxes]]) {
  assert.match(source, /<ArrowUp size=\{19\}/, `${screen} distingue ingresos con flecha hacia arriba`);
  assert.match(source, /<ArrowDown size=\{19\}/, `${screen} distingue gastos con flecha hacia abajo`);
}
assert.match(home, /mainSpent > 0 \? <Animated\.View/, "Inicio oculta la tarjeta de gastos hasta que exista un gasto");
assert.match(home, /mainIncome > 0 \? <Animated\.View/, "Inicio oculta la tarjeta de ingresos hasta que exista un ingreso");
const summaryRowStart = home.indexOf("{(mainSpent > 0 || mainIncome > 0) && (");
const summaryCards = home.slice(summaryRowStart, home.indexOf("<View className=\"px-4 mt-3 mb-2 flex-row", summaryRowStart));
assert.match(home, /\{\(mainSpent > 0 \|\| mainIncome > 0\) && \(/, "la fila de totales no deja hueco si no hay gastos ni ingresos");
assert.match(summaryCards, /<View className="flex-row gap-2\.5">\s*\{mainSpent/, "gastos e ingresos comparten una fila independiente");
assert.equal((summaryCards.match(/style=\{\{ flex: 1, minWidth: 0 \}\}/g) ?? []).length, 2, "cada tarjeta comparte el espacio disponible y una sola ocupa la fila completa");
assert.doesNotMatch(summaryCards, /flexBasis:\s*[^}]*48%/, "evita anchos porcentuales que sumados al espacio entre tarjetas las apilen");
assert.match(boxes, /<SpaceSwitcher active="boxes"/);
assert.doesNotMatch(business, /<SpaceSwitcher active="boxes"/, "Modo negocio no se presenta como una caja");
assert.match(family, /<SpaceSwitcher active="family"/);
assert.match(family, /crearFamilia/, "Familia permite crear un espacio real");
assert.match(family, /unirseAFamilia/, "Familia permite entrar mediante invitación");
assert.match(family, /familiaEnMemoria/, "Familia conserva lo ya mostrado mientras actualiza la nube");
assert.match(boxes, /leerCajasEnMemoria/, "Cajas conserva lo ya mostrado al cambiar de espacio");
assert.match(boxesMemory, /limpiarCajasEnMemoria/, "la caché de Cajas se puede vaciar al cambiar de cuenta");
assert.match(boxes, /setReady\(true\)[\s\S]*bajarCajas/, "Cajas muestra primero la copia local y consulta la nube después");
assert.match(route, /screens\/Family/);
assert.match(boxesRoute, /screens\/Cajas/);

console.log("Espacios: Personal, Familia y Cajas navegan sin mezclar dinero.");

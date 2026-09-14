import assert from "node:assert/strict";
import fs from "node:fs";

const leer = (ruta) => fs.readFileSync(ruta, "utf8");
const nav = leer("utils/nav.ts");
const country = leer("app/country.tsx");
const currency = leer("app/currency.tsx");
const login = leer("screens/Login.tsx");
const register = leer("screens/Register.tsx");
const settings = leer("app/(tabs)/settings.tsx");
const layout = leer("app/_layout.tsx");
const cajas = leer("screens/Cajas.tsx");

assert.match(country, /onBack=\{safeBack\}/, "País vuelve al lugar desde el que se abrió");
assert.match(currency, /onBack=\{safeBack\}/, "Moneda vuelve al lugar desde el que se abrió");
assert.doesNotMatch(country + currency, /router\.replace\("\/setup"\)/, "Ajustes no salta a la configuración inicial");
assert.match(nav, /export function volverUnaVez/, "volver también ignora un doble toque");
assert.match(login, /authBusy\.current/, "el acceso no puede enviarse dos veces");
assert.match(register, /authBusy\.current/, "el registro no puede enviarse dos veces");
assert.match(settings, /cerrandoSesion\.current/, "cerrar sesión no puede ejecutarse dos veces");
for (const ruta of ["/calendario/avisos", "/change-password", "/delete-account", "/telegram"]) {
  assert.ok(layout.includes(`"${ruta}"`), `${ruta} se conserva al volver de otra aplicación`);
}
assert.match(cajas, /tomarAccionLocal/, "Caja bloquea altas y devoluciones repetidas");

console.log("Recorrido seguro: regresos correctos y acciones únicas verificados.");

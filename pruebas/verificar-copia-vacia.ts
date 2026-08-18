// ENTRAR CON UNA CUENTA SIN COPIA NO PUEDE PASAR EN SILENCIO (18/08/2026)
//
// Lo que pasó: tiene tres cuentas —dos de Google y una de Hotmail—. Sus movimientos estaban
// a salvo en la nube de una, entró con otra, y la app le enseñó una pantalla vacía sin decir
// nada. Desde fuera eso se ve EXACTAMENTE igual que "la app perdió mis datos", y esa fue la
// conclusión que sacó. Media tarde en descubrir que no había nada roto.
//
// Esta prueba vigila las tres mitades del arreglo, y las tres fallan contra la versión
// anterior porque el aviso no existía:
//
//   1. Que se avise cuando la nube no devolvió nada.
//   2. Que NO se avise a quien acaba de instalar la app: ahí "no hay copia" es lo normal y
//      el aviso solo asustaría.
//   3. Que se siga leyendo lo del celular DESPUÉS del aviso. Si el aviso sustituyera a esa
//      lectura, entrar con la cuenta equivocada dejaría la pantalla vacía de verdad — el
//      arreglo habría causado el problema que describe.
import fs from "fs";
import path from "path";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const raiz = process.cwd();
const login = fs.readFileSync(path.join(raiz, "app", "login.tsx"), "utf8");
const textos = fs.readFileSync(path.join(raiz, "constants", "i18n.ts"), "utf8");

console.log("\nEl aviso existe y sale cuando toca");

ok(
  /login\.sinCopiaTitulo/.test(login),
  "al entrar sin copia en la nube, la app lo dice en vez de callarse"
);
ok(
  /if \(hasOnboarded\) \{\s*\n?\s*Alert\.alert\(t\("login\.sinCopiaTitulo"\)/.test(login),
  "y solo a quien ya usaba la app: al recién llegado, no tener copia es lo normal"
);

// El aviso va DESPUÉS del intento de nube y ANTES de leer el celular: si se colara en medio
// del camino que devuelve datos, avisaría a quien sí los recuperó.
const iAviso = login.indexOf("login.sinCopiaTitulo");
const iNube = login.indexOf("hydrateFromCloud(user.uid)");
const iDisco = login.indexOf("reloadPersistedData()");
ok(iNube !== -1 && iNube < iAviso, "el aviso llega después de haber intentado la nube");
ok(iDisco !== -1 && iAviso < iDisco, "y antes de leer lo del celular, que se sigue leyendo igual");

// Lo que de verdad no puede pasar: que el arreglo se lleve por delante la lectura del disco.
ok(
  /await reloadPersistedData\(\);/.test(login),
  "lo guardado en el celular se sigue cargando: el aviso NO reemplaza a nada"
);

console.log("\nQué dice el aviso");

const cuerpo = textos.match(/"login\.sinCopiaTexto":\s*\n?\s*"([^"]+)"/)?.[1] ?? "";
ok(cuerpo !== "", "el aviso tiene texto");
ok(
  /no se borró nada|nothing was deleted|nada foi apagado/i.test(cuerpo),
  "y lo primero que dice es que no se borró nada, que es el miedo real"
);
ok(
  /otra cuenta|another account|outra conta/i.test(cuerpo),
  "y dice cuál es la salida: probar con otra cuenta"
);

// Los tres idiomas, o en pantalla sale el nombre de la clave.
for (const clave of ["login.sinCopiaTitulo", "login.sinCopiaTexto"]) {
  const veces = textos.split(`"${clave}"`).length - 1;
  ok(veces === 3, `«${clave}» está en los tres idiomas (${veces})`);
}

console.log(
  fallos === 0
    ? "\nTodo bien: una cuenta sin copia lo dice, y no borra nada\n"
    : `\n${fallos} fallas\n`
);
process.exit(fallos === 0 ? 0 : 1);

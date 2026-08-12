// EL REGISTRO AUTOMATICO SOLO DONDE EXISTE YAPE (11/08/2026)
//
// Decision suya: *"el registro automatico solo estara disponible en pais Peru y Bolivia y sus
// monedas; si no esta en ninguno de los 2, ocultalo. Ejemplo: yo pongo Colombia o Argentina, no
// deben poder visualizar ni usar esa funcion"*.
//
// Y es correcto: Fino lee AVISOS DE YAPE, y Yape no esta en Colombia, Argentina, Chile,
// Mexico, Brasil, España ni Estados Unidos. Ahi la funcion no falla — es que no tiene nada que
// leer. Lo grave de enseñarla no es que no sirva: es que alguien la enciende, da un permiso
// para leer TODAS sus notificaciones, y se queda esperando movimientos que no van a llegar.
//
// LO QUE ESTA PRUEBA VIGILA DE VERDAD son las PUERTAS, que son tres y no una. Esconder una
// funcion en un sitio y dejarla abierta por otro es la costura donde se cuelan los fallos de
// este proyecto, y ya van varios.
import fs from "fs";
import path from "path";
import { hayRegistroAutomatico } from "../utils/dondeHayYape.ts";

const RAIZ = process.cwd();
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- DONDE SI Y DONDE NO ---");
{
  ok(hayRegistroAutomatico("PEN") === true, "Peru si");
  ok(hayRegistroAutomatico("BOB") === true, "Bolivia si");
  for (const moneda of ["COP", "ARS", "CLP", "MXN", "BRL", "EUR", "USD"]) {
    ok(hayRegistroAutomatico(moneda) === false, `${moneda} no`);
  }
  // Una moneda que no existe tampoco: ante la duda, no se enseña. Enseñar de mas hace que
  // alguien de un permiso de leer sus notificaciones para nada.
  ok(hayRegistroAutomatico("") === false, "y sin moneda, tampoco");
  ok(hayRegistroAutomatico("XYZ") === false, "ni con una moneda desconocida");
}

console.log("\n--- LAS TRES PUERTAS, TODAS CERRADAS ---");
{
  // 1. LA FILA DE AJUSTES, que es por donde se entra normalmente.
  const ajustes = leer("screens/Settings.tsx");
  const antesDeLaFila = ajustes.slice(
    Math.max(0, ajustes.indexOf("Icon={Zap}") - 400),
    ajustes.indexOf("Icon={Zap}")
  );
  ok(/hayRegistroAutomatico\(userCurrency\) && \(/.test(antesDeLaFila), "1. la fila de Ajustes se esconde");

  // 2. LA PANTALLA, a la que se puede llegar sin pasar por la fila: quedandosela abierta y
  //    cambiando de pais en otra, o volviendo atras a una que ya estaba en la pila.
  const ruta = leer("app/auto-capture.tsx");
  ok(/hayRegistroAutomatico\(userCurrency\)/.test(ruta), "2. la pantalla comprueba la moneda");
  ok(/router\.replace\("\/\(tabs\)"\)/.test(ruta), "   y manda a Inicio si no toca");
  ok(/if \(blocked \|\| !disponible\) return null/.test(ruta), "   sin dibujarla ni un instante");

  // 3. EL INTERRUPTOR DEL PANEL DEL NEGOCIO —"los yapeos entran aqui"—, que es la misma
  //    funcion por otro camino. Sin esto quedaba un interruptor que reparte algo que no llega.
  const panel = leer("screens/PanelNegocio.tsx");
  ok(/hayRegistroAutomatico\(userCurrency\) && \(/.test(panel), "3. el interruptor del negocio se esconde");
}

console.log("\n--- Y NO SE APAGA NADA DE LO QUE YA ESTABA ---");
{
  // Esconder la puerta no es borrar lo capturado ni apagar el servicio. Quien lo tenia
  // encendido y se cambia de pais deja de ver la funcion, pero sus movimientos siguen ahi.
  const ruta = leer("app/auto-capture.tsx");
  ok(!/setAutoCaptureOn\(false\)|setEnabled\(false\)/.test(ruta), "no apaga la captura al esconderla");
  const util = leer("utils/dondeHayYape.ts");
  ok(!/storage|save|delete/i.test(util), "y la comprobacion no toca nada guardado");
}

console.log(fallos === 0 ? "\nTodo bien: la funcion solo se ve donde tiene sentido" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);

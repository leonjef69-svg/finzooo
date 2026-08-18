// LA PANTALLA DE REGISTRO AUTOMÁTICO, REDISEÑADA (18/08/2026)
//
// Lo que pidió, con las capturas delante: *"siento que tiene mucho texto y muchas cosas de
// más; el usuario normal solo quiere usarlo y no leer todo o complicarse por averiguar cada
// botón"*. Y al ver la maqueta: *"solo debería salir los yapes, no otras notificaciones"*.
//
// Esta prueba vigila las cuatro cosas que, si se rompen, no dan ningún error y solo se ven
// usando la app:
//
//   1. Que el registro guarde el NOMBRE y la DIRECCIÓN de cada yapeo. Sin eso la lista no
//      puede decir "María Quispe · +S/ 50" y vuelve a enseñar la frase entera de Yape, que
//      es lo que se acaba de quitar. Falla contra la versión anterior: antes no existían.
//   2. Que salgan solo los yapes de verdad, y que un "ya lo tenías" cuente como yape. Es un
//      yapeo real, simplemente ya anotado a mano: mandarlo abajo lo haría desaparecer de la
//      lista y parecería que no llegó.
//   3. Que los descartados SIGAN ESTANDO. Esconder no es borrar, y aquí no es una manía:
//      si un yapeo dejara de registrarse por confundirse con publicidad, ese es el único
//      sitio donde se puede ver. Ya se documentó una vez que hacía falta.
//   4. Que el enlace diga QUÉ son. "Descartados" a secas, en una app de dinero, se lee como
//      pagos que no entraron — lo dijo él antes de que se entregara.
import fs from "fs";
import path from "path";
import { processCaptured } from "@/utils/autoCapture";
import type { Transaction } from "@/types";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const raiz = process.cwd();
const pantalla = fs.readFileSync(path.join(raiz, "screens", "AutoCapture.tsx"), "utf8");
const textos = fs.readFileSync(path.join(raiz, "constants", "i18n.ts"), "utf8");

const AHORA = new Date("2026-08-18T16:00:00").getTime();
const aviso = (text: string, at: number = AHORA) => ({
  package: "com.bcp.innovacxion.yapeapp",
  title: "Yape!",
  text,
  postedAt: at,
});

// ---------------------------------------------------------------------------
// 1. EL REGISTRO GUARDA QUIÉN Y EN QUÉ DIRECCIÓN
// ---------------------------------------------------------------------------
console.log("\nLo que se guarda de cada yapeo");

const entrada = processCaptured(
  [aviso("Confirmación de Pago Yape! MARIA QUISPE te envió un pago por S/ 50")],
  [],
  {},
  (k: string) => k,
  AHORA
);
const registrado = entrada.log.find((e) => e.result === "added");
ok(registrado != null, "un yapeo que entra se registra");
ok(
  registrado?.name != null && registrado.name.length > 0,
  "y guarda el nombre de quien te yapeó, para poder enseñarlo sin la frase entera"
);
ok(registrado?.type === "income", "y que el dinero ENTRÓ, para pintarlo en verde y con +");
ok(registrado?.amount === 50, "con su monto");

// El nombre tiene que ser el MISMO que lleva el movimiento. Si se dedujeran por separado, la
// lista podría decir una cosa y el movimiento otra, y no habría forma de saber cuál vale.
const mov = entrada.toAdd[0];
ok(
  registrado?.name === (mov?.merchant || mov?.description),
  "y es el mismo nombre que el del movimiento, no uno deducido aparte"
);

// ---------------------------------------------------------------------------
// 2. QUÉ ENTRA EN LA LISTA Y QUÉ NO
// ---------------------------------------------------------------------------
console.log("\nQué sale en «Últimos yapes»");

const publicidad = processCaptured(
  [aviso("Jefferson, tu Crédito Yape te espera. Tienes un Crédito Yape de hasta S/2,000 preaprobado")],
  [],
  {},
  (k: string) => k,
  AHORA
);
const anuncio = publicidad.log[0];
ok(anuncio != null && anuncio.result !== "added", "la publicidad de Yape no se registra como movimiento");
ok(anuncio?.name == null, "y no trae nombre, porque no hay nadie que te haya yapeado");

ok(
  /function esUnYape/.test(pantalla),
  "la pantalla separa los yapes de lo demás en un solo sitio"
);
ok(
  /esUnYape[\s\S]{0,200}result === "added"[\s\S]{0,60}result === "duplicate"/.test(pantalla),
  "y cuenta como yape tanto el registrado como el «ya lo tenías»: los dos son plata que se movió"
);
ok(
  /const yapes = log\.filter\(esUnYape\)/.test(pantalla) &&
    /const descartados = log\.filter\(\(e\) => !esUnYape\(e\)\)/.test(pantalla),
  "las dos listas salen de la MISMA pregunta, así que ningún aviso puede caer en las dos ni en ninguna"
);

// ---------------------------------------------------------------------------
// 3. LOS DESCARTADOS SIGUEN ALCANZABLES
// ---------------------------------------------------------------------------
console.log("\nLos descartados no se borraron");

ok(
  /verDescartados &&\s*\n?\s*descartados\.map/.test(pantalla),
  "los avisos descartados se siguen pudiendo ver, detrás del toque"
);
ok(
  /entry\.text \|\| t\("autoCapture\.logHidden"\)/.test(pantalla),
  "con su texto, que es lo que sirve para saber por qué un yapeo no se reconoció"
);

// ---------------------------------------------------------------------------
// 4. EL ENLACE DICE QUÉ SON
// ---------------------------------------------------------------------------
console.log("\nCómo se llama ese enlace");

const etiqueta = textos.match(/"autoCapture\.descartados": "([^"]+)"/)?.[1] ?? "";
ok(etiqueta !== "", "el enlace tiene su texto");
ok(
  !/^Descartados/i.test(etiqueta),
  "y NO se llama solo «Descartados»: en una app de dinero eso se lee como pagos que no entraron"
);
ok(
  /pagos|payments|pagamentos/i.test(etiqueta),
  "dice que eran avisos que no eran pagos, que es lo que de verdad son"
);

// ---------------------------------------------------------------------------
// 5. LO QUE SE FUE DETRÁS DE UN TOQUE, Y SIGUE EXISTIENDO
// ---------------------------------------------------------------------------
console.log("\nLo que dejó de ocupar la pantalla cada día");

for (const clave of ["autoCapture.privacyBody", "autoCapture.statusSeen", "autoCapture.pasos.probar"]) {
  ok(pantalla.includes(clave), `«${clave}» sigue en la pantalla, no se borró`);
}
ok(
  /verQueSeLee &&/.test(pantalla) && /verAyuda &&/.test(pantalla),
  "pero los tres viven detrás de un toque, no a la vista todos los días"
);
// El bloque de estado tiene que traer su arreglo dentro. Separarlos es lo que hacía que se
// leyera "desconectado" sin saber qué hacer.
ok(
  /falta\.\$\{estado\}\.boton/.test(pantalla),
  "y cuando algo falla, el botón que lo arregla va DENTRO del aviso"
);

console.log(
  fallos === 0
    ? "\nTodo bien: la lista enseña solo yapes y nada se perdió\n"
    : `\n${fallos} fallas\n`
);
process.exit(fallos === 0 ? 0 : 1);

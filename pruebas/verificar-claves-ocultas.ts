// UN AVISO DE CLAVE SE ANOTA, PERO SU TEXTO NO SE GUARDA
//
// La pantalla de registro automatico guarda el texto de cada aviso que mira,
// tambien de los que descarta. Para un Yape que no se entendio eso es justo
// lo que hace falta ver. Pero entre los descartados van los de clave, y
// "Tu codigo de verificacion es 4821" quedaba escrito en el celular y a la
// vista de cualquiera que lo agarrara desbloqueado.
//
// Se detecto el 02/08/2026 al revisar por que salia el aviso de clave en la
// pantalla. Nadie lo habia pedido: salio de mirar que se estaba guardando.
//
// LO QUE HAY QUE GARANTIZAR, Y NO ES "NO GUARDAR NADA"
//
// El aviso TIENE que seguir apareciendo. Si un yapeo dejara de entrar por
// confundirse con uno de estos, hay que poder verlo en la pantalla. Lo que no
// puede quedar es la frase.
import { processCaptured } from "@/utils/autoCapture";
import { esAvisoDeSeguridad } from "@/utils/notificationParser";

const t = (k: string) => k;
const YAPE = "com.bcp.innovacxion.yapeapp";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const aviso = (titulo: string, texto: string) => ({
  package: YAPE,
  title: titulo,
  text: texto,
  postedAt: Date.now() - 60000,
});

console.log("\n--- EL AVISO SE ANOTA, LA FRASE NO ---");
{
  const { toAdd, log } = processCaptured(
    [aviso("Operación en curso", "Hemos generado y autocompletado la clave")],
    [],
    {},
    t
  );
  ok(toAdd.length === 0, "no se registra como movimiento");
  ok(log.length === 1, "pero SI queda anotado que llego");
  ok(log[0].text === "", "y su texto no se guarda");
  ok(log[0].result === "notMoney", "con el mismo motivo de siempre");
}

console.log("\n--- UN CODIGO NO DEJA EL NUMERO ESCRITO ---");
{
  const { log } = processCaptured([aviso("Yape", "Tu código de verificación es 4821")], [], {}, t);
  ok(log.length === 1, "queda anotado");
  ok(!log[0].text.includes("4821"), "y el codigo no aparece por ningun lado");
  ok(log[0].text === "", "no se guarda nada del texto");
}

console.log("\n--- LO QUE NO ES DELICADO SI SE SIGUE VIENDO ---");
{
  // Un sorteo tambien se descarta, pero su texto no tiene nada que ocultar y
  // ayuda a entender que llego. Esconderlo todo dejaria la pantalla inutil.
  const { log } = processCaptured([aviso("Yape", "Participa en el sorteo de S/ 1000")], [], {}, t);
  ok(log.length === 1 && log[0].text.includes("sorteo"), "un sorteo si conserva su texto");
}

console.log("\n--- Y UN YAPE QUE NO SE ENTIENDE, TAMBIEN ---");
{
  // Este es el caso para el que existe la pantalla: hay que poder leer el
  // texto tal cual llego para ver que palabra falta reconocer.
  const { log } = processCaptured([aviso("Yape", "Movimiento raro de S/ 30 sin verbo")], [], {}, t);
  ok(log.length === 1, "queda anotado");
  ok(log[0].text.includes("Movimiento raro"), "y su texto se conserva entero");
}

console.log("\n--- UN YAPEO NORMAL NO SE TOCA ---");
{
  const { toAdd, log } = processCaptured(
    [aviso("Confirmación de Pago", "Yape! JUAN PEREZ te envió un pago por S/ 20")],
    [],
    {},
    t
  );
  ok(toAdd.length === 1, "se registra");
  ok(log[0].text.includes("JUAN PEREZ"), "y su texto se ve, que es lo util");
}

console.log("\n--- LA LISTA DE DELICADOS ---");
{
  for (const texto of [
    "Tu código de verificación es 1234",
    "Tu código de seguridad",
    "Tu clave temporal vence pronto",
    "No compartas tu clave con nadie",
    "Operación en curso",
    "Hemos generado y autocompletado la clave",
  ]) {
    ok(esAvisoDeSeguridad("", texto), `delicado: "${texto.slice(0, 38)}"`);
  }
  ok(!esAvisoDeSeguridad("", "Te yapearon S/ 50 de Juan"), "y un yapeo normal no lo es");
  ok(!esAvisoDeSeguridad("", "Participa en el sorteo"), "ni un sorteo");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

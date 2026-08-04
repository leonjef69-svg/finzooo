// VARIOS YAPES SEGUIDOS: UNO DETRAS DE OTRO, NO TODOS A LA VEZ
//
// Preguntado el 02/08/2026: "en un negocio le yapean varias veces, la voz lo
// leeria rapidamente? se pondria lento?".
//
// Al mirarlo habia un fallo de verdad: hablar() creaba un motor de voz NUEVO
// por cada aviso. QUEUE_ADD encola dentro de SU motor, asi que cinco motores
// son cinco colas independientes: los cinco yapes hablaban a la vez y no se
// entendia ninguno. Justo el caso de un negocio.
//
// Ahora hay UN motor, se reutiliza, y las frases se encolan de verdad.
//
// Esta prueba lee el .kt: lo que hay que garantizar son propiedades del
// codigo (un solo motor, cola compartida, apagado diferido), no una cuenta.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const kt = fs.readFileSync(
  path.join(RAIZ, "modules/notification-reader/android/src/main/java/com/finzo/notificationreader/FinzoNotificationListener.kt"),
  "utf8"
);

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- UN SOLO MOTOR DE VOZ ---");
{
  // El fallo era este: "TextToSpeech(" dentro de hablar(), una vez por aviso.
  const veces = (kt.match(/TextToSpeech\(applicationContext/g) || []).length;
  ok(veces === 1, `el motor se crea en un solo sitio (${veces})`);

  ok(/private var motor: TextToSpeech\? = null/.test(kt), "y vive en el servicio, no dentro de hablar()");
  // Sin esta guarda, encenderlo al conectar y encenderlo al hablar crearian
  // dos motores, y dos motores son dos colas: justo el fallo que se arreglo.
  const prep = kt.slice(kt.indexOf("private fun prepararVoz"));
  ok(/if \(motor != null\) return/.test(prep.slice(0, 300)), "solo se crea si no habia uno");
}

console.log("\n--- LAS FRASES HACEN COLA ---");
{
  ok(kt.includes("porDecir"), "hay una cola de frases pendientes");
  ok(kt.includes("QUEUE_ADD"), "se encolan, no se pisan");
  ok(/porDecir\.add\(texto\)/.test(kt), "cada aviso entra en la cola");

  // Lo que llega mientras el motor arranca no se puede perder: arrancar tarda,
  // y en una rafaga los primeros avisos caen justo en ese hueco.
  ok(/vaciarCola\(\)/.test(kt), "y al terminar de arrancar se dicen todas las que esperaban");
  ok(/"finzo-" \+ System\.nanoTime\(\)/.test(kt), "cada frase lleva su propio identificador");
}

console.log("\n--- Y NO SE PISAN POR VENIR DE HILOS DISTINTOS ---");
{
  // onNotificationPosted lo llama Android desde hilos distintos. Dos avisos a
  // la vez tocando la misma cola es justo lo que rompe en una rafaga.
  ok(/private val mano = Handler\(hiloVoz\.looper\)/.test(kt), "todo lo de la voz pasa por un solo hilo");
  ok(/mano\.post \{/.test(kt), "incluido lo que llega desde el servicio");
}

console.log("\n--- Y ESE HILO NO ES EL DE LA PANTALLA ---");
{
  // Estaba en el hilo principal, que es donde Android dibuja y donde Finzo se
  // despierta para registrar el yapeo. Al llegar un yape pasan las dos cosas a
  // la vez, y hablar quedaba EN LA COLA detras de todo ese trabajo: la
  // notificacion aparecia y la voz llegaba segundos despues.
  ok(!kt.includes("Looper.getMainLooper()"), "la voz NO va por el hilo principal");
  ok(/HandlerThread\("finzo-voz"\)/.test(kt), "tiene su propio hilo");
  ok(/\.apply \{ start\(\) \}/.test(kt), "arrancado al crearse, no a la primera frase");
  ok(/hiloVoz\.quitSafely\(\)/.test(kt), "y se cierra si Android tira el servicio");
}

console.log("\n--- EL MOTOR SE QUEDA CALIENTE: LA VOZ, SIN ESPERA ---");
{
  // Arrancar el motor de voz tarda 2 a 4 segundos —es Android despertando su
  // sistema de voz, no Finzo pensando— y eso se OIA: la notificacion aparecia
  // y la voz llegaba despues.
  //
  // Se apagaba tras un minuto sin usarse, asi que ese retraso volvia cada vez
  // que pasaba un rato. Decision del usuario el 02/08/2026: sin limite, que
  // hable en el momento siempre. Cuesta algo de bateria y se acepta.
  ok(!kt.includes("ESPERA_APAGADO"), "no hay apagado por tiempo");
  ok(!kt.includes("postDelayed"), "ni nada programado para apagarlo");

  // Y se enciende ANTES del primer yapeo, en cuanto Android engancha el
  // servicio. Si se esperara al primer aviso, ese primero seguiria tardando.
  const conecta = kt.slice(kt.indexOf("override fun onListenerConnected"));
  const cuerpo = conecta.slice(0, conecta.indexOf("override fun onListenerDisconnected"));
  ok(cuerpo.includes("prepararVoz()"), "el motor se enciende al conectar el servicio");
  ok(cuerpo.includes("isSpeakEnabled"), "pero solo si la voz esta encendida");

  // Lo unico que lo suelta: que Android tire el servicio.
  ok(/override fun onDestroy/.test(kt), "y se suelta si Android tira el servicio");
  ok(/soltarVoz\(\)/.test(kt), "con su apagado de verdad");
}

console.log("\n--- LO DE OTRAS APPS NI SE ANOTA ---");
{
  // Reportado: seguia saliendo en la pantalla "No es un movimiento -
  // Operacion en curso. Hemos generado y autocompletado la clave", de
  // Scotiabank. Estaba bien descartado, pero se anotaba igual — y con su
  // texto, que en un aviso de clave es lo que no se quiere guardar.
  const auto = fs.readFileSync(path.join(RAIZ, "utils/autoCapture.ts"), "utf8");
  ok(auto.includes("esAppVigilada"), "processCaptured comprueba de que app viene");

  const bucle = auto.slice(auto.indexOf("for (const n of ordered)"));
  const iSalta = bucle.indexOf("esAppVigilada");
  const iPreview = bucle.indexOf("const preview");
  ok(iSalta !== -1 && iSalta < iPreview, "y lo salta ANTES de guardar su texto");
  ok(/if \(!esAppVigilada\(n\.package\)\) continue;/.test(bucle), "sin dejar entrada en el registro");
}

console.log("\n--- Y LA PANTALLA YA NO PROMETE BANCOS ---");
{
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  const es = i18n.slice(i18n.indexOf('"autoCapture.privacyBody"'));
  const texto = es.slice(0, es.indexOf("\n", es.indexOf(":")) + 200);
  ok(!/Plin, bancos/.test(texto), "el texto de privacidad no sigue diciendo Plin y bancos");
  ok(/Solo los avisos de Yape/.test(texto), "dice que solo mira Yape");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

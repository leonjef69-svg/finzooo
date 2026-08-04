// EL YAPEO SE REGISTRA EN EL MOMENTO, NO CUANDO A LA APP LE TOQUE MIRAR
//
// Pedido el 02/08/2026: "que se registre de inmediato". Antes la app
// preguntaba "¿llego algo?" cada ocho segundos; con la pantalla delante, el
// movimiento tardaba en salir y eso se ve como que no se registro.
//
// Ahora el servicio de Android AVISA en cuanto captura el aviso.
//
// POR QUE ESTA PRUEBA MIRA EL CODIGO Y NO LAS CUENTAS
//
// Aqui no hay ninguna cuenta que comprobar: el fallo posible es que las dos
// mitades no queden unidas —el servicio avisando a un vacio, o la app
// escuchando algo que nadie manda—. Eso no lo caza ni el compilador (son dos
// lenguajes distintos) ni una prueba de calculo.
//
// Es el mismo tipo de fallo que costo la tarde entera dos veces hoy: la voz
// muda por un espacio, y la pantalla vieja porque nadie releia el disco. Las
// dos veces cada mitad estaba bien y lo que fallaba era la union.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const KT = path.join(RAIZ, "modules/notification-reader/android/src/main/java/com/finzo/notificationreader");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const listener = fs.readFileSync(path.join(KT, "FinzoNotificationListener.kt"), "utf8");
const modulo = fs.readFileSync(path.join(KT, "NotificationReaderModule.kt"), "utf8");
const puente = fs.readFileSync(path.join(RAIZ, "modules/notification-reader/index.ts"), "utf8");
const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");

console.log("\n--- EL SERVICIO AVISA ---");
{
  ok(listener.includes("NotificationReaderModule.avisarDeCaptura()"), "el servicio avisa a la app al capturar");

  // Y el aviso va DESPUES de guardar en el buzon. Al reves, la app podria
  // ponerse a vaciar un buzon donde el yapeo todavia no esta.
  const iGuarda = listener.indexOf("NotificationStore.add(");
  const iAvisa = listener.indexOf("avisarDeCaptura()");
  ok(iGuarda !== -1 && iAvisa > iGuarda, "avisa DESPUES de dejarlo en el buzon, no antes");
}

console.log("\n--- PERO NO POR LOS DOS CAMINOS A LA VEZ ---");
{
  // Si avisa a la app Y ademas despierta el trabajo de fondo, se levanta un
  // proceso para nada. Peor: con la app delante, Android prohibe arrancar ese
  // trabajo.
  ok(
    /if\s*\(!NotificationReaderModule\.avisarDeCaptura\(\)\)\s*\{\s*registrarYa\(\)/.test(listener),
    "el trabajo de fondo solo se despierta si NO habia nadie escuchando"
  );
}

console.log("\n--- LA APP CERRADA SIGUE REGISTRANDO ---");
{
  // Lo de arriba no puede haberse llevado por delante el camino de siempre:
  // con la app cerrada no hay a quien avisar, y el yapeo tiene que
  // registrarse igual.
  ok(listener.includes("registrarYa()"), "el camino del trabajo de fondo sigue existiendo");
  ok(
    listener.includes("FinzoCaptureService::class.java"),
    "y sigue apuntando al servicio que despierta a Finzo"
  );
}

console.log("\n--- EL MODULO SABE SI HAY ALGUIEN ESCUCHANDO ---");
{
  ok(modulo.includes("Events(EVENTO)"), "declara el aviso");
  ok(modulo.includes("OnStartObserving"), "se apunta cuando la app empieza a escuchar");
  ok(modulo.includes("OnStopObserving"), "y se borra cuando deja de hacerlo");
  ok(modulo.includes("@Volatile"), "la marca es volatile: la escriben dos hilos distintos");

  // Si esto lanzara, se cae el servicio de notificaciones de Android y con el
  // la funcion entera, en silencio.
  const cuerpo = modulo.slice(modulo.indexOf("fun avisarDeCaptura"));
  ok(/catch\s*\(e:\s*Throwable\)/.test(cuerpo.slice(0, 500)), "y avisar nunca puede tumbar el servicio");
}

console.log("\n--- LA APP LO ESCUCHA Y RECOGE AL INSTANTE ---");
{
  ok(puente.includes('Native.addListener("onCapture"'), "el puente se suscribe al aviso");
  ok(puente.includes("export function onCapture"), "y lo ofrece a la app");

  // Con un APK anterior esto no existe. Tiene que devolver algo que se pueda
  // dar de baja igual, o la app reventaria al cerrar la pantalla.
  const fn = puente.slice(puente.indexOf("export function onCapture"));
  ok(fn.slice(0, 400).includes("remove: () => {}"), "con un APK anterior devuelve una baja que no hace nada");

  ok(ctx.includes("notificationReader.onCapture("), "la app se suscribe");
  ok(/onCapture\(\(\) => \{\s*collect\(\);/.test(ctx), "y al llegar el aviso recoge en el momento");
  ok(ctx.includes("alLlegar.remove()"), "y se da de baja al soltar la pantalla");
}

console.log("\n--- EL REPASO CADA POCO SE QUEDA ---");
{
  // Es la red: cubre el APK anterior, y el aviso que llego con la app
  // cerrada. Quitarlo por tener ya el aviso instantaneo dejaria sin registrar
  // justo los casos que hoy si funcionan.
  ok(ctx.includes("setInterval(collect, 8000)"), "sigue el repaso cada ocho segundos");
  ok(ctx.includes('AppState.addEventListener("change"'), "y la recogida al volver al frente");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

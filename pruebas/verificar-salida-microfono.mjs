// AL TERMINAR DE DICTAR, SALIR DE FINZO — NO QUEDARSE EN INICIO
//
// El microfono del escritorio abre "finzo://voice" directo, sin pasar por el
// resto de la app. Eso ya funcionaba. Lo que no: al cerrar, se usaba safeBack,
// que SIN pantalla anterior manda a Inicio.
//
// Y entrando desde el widget nunca hay pantalla anterior. Asi que dictar un
// gasto de diez segundos terminaba con la persona dentro de Finzo, teniendo
// que salir a mano. Justo lo que el widget existe para evitar.
//
// LO QUE ESTA PRUEBA VIGILA DE VERDAD
//
// Que se GUARDE antes de salir. Los guardados se agrupan con un retardo corto
// para no cifrar la lista entera en cada toque; al cerrar la app de golpe no
// hay ese "momento despues". Sin el flush, el gasto recien dictado se queda en
// memoria y no llega al disco NUNCA.
//
// Es un fallo que no se ve probando: se dicta, se ve el mensaje de guardado,
// se cierra, y el movimiento no esta. Y solo pasa cuando se entra por el
// widget.
import fs from "fs";
import path from "path";

const RAIZ = "C:/Users/User/Videos/Fino control de gastos diarios/PresupuestoApp";
const voz = fs.readFileSync(path.join(RAIZ, "app/voice.tsx"), "utf8");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- SIN PANTALLA ANTERIOR, SE SALE DE FINZO ---");
{
  ok(voz.includes("BackHandler.exitApp()"), "se cierra la app en vez de ir a Inicio");
  ok(voz.includes("router.canGoBack()"), "pero solo si de verdad no hay a donde volver");
  ok(!/onClose=\{safeBack\}/.test(voz), "ya no se usa safeBack, que llevaba a Inicio");

  // Si se entro desde dentro de la app, cerrar tiene que devolver a la
  // pantalla de antes, no cerrar Finzo entera.
  ok(/router\.back\(\)/.test(voz), "y entrando desde la app se vuelve atras normal");
}

console.log("\n--- SE GUARDA ANTES DE SALIR ---");
{
  ok(voz.includes("flushPendingSaves"), "se vacia lo que estuviera esperando su turno");

  const fn = voz.slice(voz.indexOf("async function cerrar"));
  const cuerpo = fn.slice(0, fn.indexOf("\n}"));
  const iFlush = cuerpo.indexOf("flushPendingSaves");
  const iSalir = cuerpo.indexOf("BackHandler.exitApp");
  ok(iFlush !== -1 && iSalir !== -1 && iFlush < iSalir, "y se guarda ANTES de cerrar, no despues");
  ok(/await flushPendingSaves/.test(cuerpo), "esperando a que termine de escribir");
}

console.log("\n--- LA PANTALLA SIGUE ABRIENDOSE DIRECTA ---");
{
  // Lo de arriba no puede haberse llevado por delante lo que ya funcionaba:
  // el widget abre finzo://voice y el microfono arranca solo.
  // Con parentesis: la LLAMADA. El nombre suelto aparece en el comentario que
  // explica por que no se usa, y buscarlo sin mas daba por roto algo correcto.
  ok(!voz.includes("useRedirectIfOrphaned("), "sin el guard que mandaria a Inicio al entrar por el widget");
  ok(voz.includes("hasOnboarded"), "pero sigue protegida de dictar sin haber configurado la app");

  const entry = fs.readFileSync(path.join(RAIZ, "screens/VoiceEntry.tsx"), "utf8");
  ok(/useState<Stage>\("listening"\)/.test(entry), "y el microfono empieza escuchando solo");
}


console.log("\n--- ENTRANDO POR EL WIDGET NO SE VE FINZO DETRAS ---");
{
  // El fondo de la tarjeta es negro al 70%, asi que dejaba asomar lo de
  // detras. Dentro de la app eso esta bien —dice "es un panel encima de donde
  // estabas"—. Pero entrando por el widget, lo de detras es el Inicio de Finzo
  // recien abierto, y verlo es justo lo que hace sentir "me metio en la app".
  const entry2 = fs.readFileSync(path.join(RAIZ, "screens/VoiceEntry.tsx"), "utf8");
  ok(entry2.includes("fondoOpaco"), "la tarjeta sabe si debe tapar del todo");
  ok(
    entry2.includes('fondoOpaco ? "bg-slate-950" : "bg-black/70"'),
    "opaco desde el widget, translucido desde dentro"
  );

  ok(voz.includes("fondoOpaco={desdeWidget}"), "y la pantalla se lo pasa");
  ok(voz.includes("!router.canGoBack()"), "sabiendo si hay pantalla anterior");

  // Se calcula al montar y no en cada dibujado: tras dictar un gasto el
  // historial puede cambiar, y el fondo no puede cambiar a media conversacion.
  ok(voz.includes("const [desdeWidget] = useState"), "y se decide una sola vez, al abrir");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

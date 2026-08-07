import { useEffect, useRef } from "react";
import { AppState, View } from "react-native";
import { Stack, router, useNavigationContainerRef, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import "react-native-reanimated";
import "../global.css";
import { AppDataProvider, useAppData } from "@/contexts/AppDataContext";
import { flushPendingSaves } from "@/utils/storage";
import { getPendingImport, setPendingImport } from "@/utils/pendingImport";
import { isAppLocked } from "@/utils/lockState";
import AppLockGate from "@/components/AppLockGate";
import CelebrationOverlay from "@/components/CelebrationOverlay";
import Toast from "@/components/Toast";
import * as incomingFile from "@/modules/incoming-file";
import * as Notifications from "expo-notifications";
import {
  alreadyHandledTap,
  buildFileName,
  claveDeEjecucion,
  isAutoRunDue,
  loadSchedule,
  markTapHandled,
  monthForSchedule,
  saveSchedule,
  toDateKey,
} from "@/utils/scheduledExport";

// Que el aviso de exportación se vea aunque Finzo esté abierta. Por defecto
// expo-notifications los calla cuando la app está en primer plano, y entonces
// a quien tenga la app abierta a las 9:00 no le llegaría nada.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function GlobalOverlays() {
  const { celebrateGoal, clearCelebration, toast } = useAppData();
  return (
    <>
      <CelebrationOverlay goalName={celebrateGoal} onClose={clearCelebration} />
      <Toast text={toast} />
    </>
  );
}

// Dos cosas que dependen de entrar/salir de la app:
//
//  1. Al VOLVER: regresa siempre a Inicio (el saldo disponible) — nunca
//     deja a la persona a medio camino en "Agregar movimiento" u otra
//     pantalla.
//  2. Al SALIR: escribe de inmediato lo que estuviera esperando su turno
//     de guardarse. Los guardados se agrupan con un retardo corto para no
//     cifrar todo el conjunto de datos en cada toque (ver utils/storage),
//     y esto garantiza que cerrar la app justo después de un cambio no
//     alcance a perderlo.
// Pantallas que NO deben cerrarse cuando la app vuelve al frente.
//
// La regla general (volver a Inicio al regresar) existe para no dejar a
// nadie a medio camino en una pantalla de hace horas. Pero estas dos hacen
// que Android tome el control un instante como parte de su propio
// funcionamiento, y la app lo confunde con "se fue y volvió":
//
//   /auto-capture → manda a los ajustes de Android a dar el permiso.
//   /voice        → al abrir el micrófono, el servicio de voz de Google
//                   toma el foco. Sin esta excepción, la pantalla se
//                   cerraba sola al segundo, sin dar tiempo a hablar.
//   /scan-receipt → la cámara y la galería son aplicaciones aparte. Sin
//                   esta excepción, la pantalla se cerraba al volver de
//                   tomar la foto y el escaneo se perdía sin decir nada:
//                   la persona veía Inicio y no sabía si había funcionado.
//   /import       → el selector de archivos también es otra aplicación, y
//                   el archivo elegido se perdía igual.
//   /export-pdf   → el menú de compartir es otra aplicación. Al cerrarlo
//                   sin elegir nada, la pantalla se cerraba y aparecía
//                   Inicio: había que volver a entrar y a elegir mes,
//                   formato y qué exportar desde cero.
//   /category-style → abre la galeria para elegir la imagen de una
//                   categoria. Al volver, la pantalla se cerraba y la foto
//                   se perdia sin decir nada.
//   /nueva-categoria → desde el 05/08/2026 tambien deja poner una foto propia,
//                   asi que abre camara y galeria. Sin esta excepcion, volver
//                   de tomar la foto cerraba la pantalla y se perdia el nombre
//                   y el color que la persona ya llevaba escritos.
//   /scheduled-export → al elegir una frecuencia se pide el permiso de
//                   avisos, y ese cuadro lo dibuja Android encima de la app.
//                   Sin esta excepción, conceder el permiso mandaba a Inicio
//                   justo en el primer toque de la pantalla.
//
// La regla para añadir una pantalla aquí: si abre una aplicación de Android
// (cámara, galería, archivos, ajustes, voz) Y todavía le queda trabajo por
// hacer al volver, tiene que estar en esta lista. Lo comprueba el auditor
// auditar-pantallas-externas.mjs, para que no se vuelva a olvidar.
const KEEP_ON_RETURN = [
  "/auto-capture",
  "/voice",
  "/scan-receipt",
  "/import",
  "/export-pdf",
  "/scheduled-export",
  "/category-style",
  "/nueva-categoria",
];

/**
 * "Estoy abriendo un archivo que llegó de fuera, no me mandes a Inicio".
 *
 * Existe porque dos reglas de la app se peleaban y ganaba la equivocada:
 *
 *   AppLifecycleEffects dice "al volver al frente, vuelve a Inicio", para no
 *   dejar a nadie a medio camino en una pantalla de hace horas. Salvo que la
 *   pantalla esté en KEEP_ON_RETURN.
 *
 *   IncomingFileEffect dice "abre Importar con este archivo".
 *
 * Compartir un estado de cuenta a Finzo dispara las DOS a la vez: Android
 * trae la app al frente (regla 1) y le entrega el archivo (regla 2). Y aunque
 * /import está en KEEP_ON_RETURN, esa lista se consulta contra la pantalla en
 * la que la app CREE que está, que en ese instante sigue siendo Inicio: la
 * pantalla de importar acaba de pedirse y todavía no ha llegado. Así que la
 * regla 1 no la reconoce, manda a Inicio, y la importación se va con ella.
 *
 * Desde fuera: tocabas Finzo en el menú de compartir, la app se abría en
 * Inicio, y ahí se acababa todo.
 *
 * Una bandera y no un pathname porque el problema es justo ese: el pathname
 * va un paso por detrás. Esto se enciende en el mismo instante en que el
 * archivo aparece, sin esperar a nada.
 *
 * Y NO es un cronómetro. Lo fue —dos segundos y medio tras pedir la
 * navegación— y se quedaba corto justo en el caso peor: con el bloqueo
 * activado, entre que aparece el candado y la persona termina de poner su
 * PIN pasan más de dos segundos y medio, así que la bandera se bajaba sola
 * y la regla de Inicio se llevaba la importación igual.
 *
 * Ahora se mira si TODAVÍA hay un archivo esperando. Deja de estar puesta
 * cuando Importar carga el archivo de verdad, que es el único momento en que
 * se puede dar por hecho.
 */
function abriendoArchivoEntrante(): boolean {
  return getPendingImport() !== null;
}

/**
 * Abre Importar cuando Finzo se ha lanzado con un archivo desde otra app
 * ("Compartir → Finzo" o "Abrir con → Finzo" sobre un estado de cuenta).
 *
 * Se mira al arrancar y cada vez que la app vuelve al frente: si ya estaba
 * abierta, Android no la reinicia, solo le entrega el archivo nuevo.
 *
 * consumePendingFile() solo entrega el archivo UNA vez, así que si en ese
 * momento no se puede abrir Importar hay que guardarlo y reintentar — no
 * dejarlo caer, que es lo que hacía antes.
 */
function IncomingFileEffect() {
  const { ready, hasOnboarded } = useAppData();
  const navigationRef = useNavigationContainerRef();
  // El archivo recogido que todavía no se ha podido abrir.
  //
  // Antes se recogía y, si la navegación aún no estaba lista, se dejaba
  // caer: `return` y a otra cosa. Como el módulo nativo solo lo entrega UNA
  // vez, ese archivo se perdía para siempre. Y era el caso NORMAL, no el
  // raro: al llegar desde otra app, Finzo arranca de cero y este efecto
  // corre en cuanto los datos están listos, que es antes de que el sistema
  // de pantallas pueda recibir órdenes.
  //
  // Desde fuera se veía así: tocas Finzo en el menú de compartir, la app se
  // abre, y no pasa nada. Sin error, sin aviso, sin pantalla de importar.
  const pending = useRef<incomingFile.IncomingFile | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    // Cuántas vueltas se sigue PREGUNTANDO por el archivo cuando la primera
    // respuesta es "no hay nada".
    //
    // Esto era un fallo: en cuanto consumePendingFile devolvía null, se daba
    // por hecho que no había archivo y se dejaba de insistir para siempre.
    // Pero null también significa "todavía no puedo mirar" — la parte nativa
    // necesita la pantalla de la app ya montada para leer con qué se abrió, y
    // en un arranque desde cero eso puede tardar un instante más que el
    // JavaScript.
    //
    // Con el bloqueo activado el arranque es aún más lento, así que la
    // primera pregunta caía justo en ese hueco: se respondía "no hay nada",
    // se dejaba de preguntar, y el archivo se quedaba sin recoger.
    //
    // Diez vueltas de 300 ms son tres segundos preguntando. Pasado eso, si de
    // verdad no hay archivo, se para: seguir preguntando dos minutos en cada
    // arranque normal de la app sería gastar batería para nada.
    const VUELTAS_BUSCANDO = 10;
    let vueltasSinArchivo = 0;

    function intentar(): boolean {
      if (!pending.current) pending.current = incomingFile.consumePendingFile();
      const file = pending.current;
      if (!file) {
        vueltasSinArchivo++;
        // Se sigue preguntando un rato antes de darlo por hecho.
        return vueltasSinArchivo >= VUELTAS_BUSCANDO;
      }

      // Se apunta EN CUANTO aparece el archivo, no al navegar.
      // consumePendingFile es inmediato, así que para cuando el aviso de
      // "la app volvió al frente" llega a AppLifecycleEffects, esto ya está
      // puesto y no manda a Inicio. Por eso este componente se dibuja antes
      // que aquel: quien escucha primero, avisa primero.
      //
      // Y si la navegación no llega a ocurrir —o ocurre y algo la deshace—,
      // Inicio enseñará el aviso para abrirlo a mano. Lo limpia Importar
      // cuando CARGA el archivo, no cuando se pide abrirla.
      setPendingImport(file);

      // Con el candado puesto no se navega. El cuadro de la huella lo dibuja
      // Android encima de la app, y al cerrarse la app cree que volvió del
      // segundo plano y se manda sola a Inicio: abrir Importar por debajo
      // solo consigue que se lo lleve por delante. Se espera y se abre justo
      // después de desbloquear, que es cuando se puede ver.
      if (isAppLocked()) return false;

      if (!hasOnboarded || !navigationRef.isReady()) return false;
      // Se suelta ANTES de navegar: si el push fallara, insistir en bucle
      // sería peor que perder la importación.
      pending.current = null;
      router.push({ pathname: "/import", params: { uri: file.uri, name: file.name } });
      return true;
    }

    // Se reintenta hasta que se pueda de verdad: hasta que la navegación
    // esté en pie Y el candado esté quitado.
    //
    // Antes eran tres segundos y se rendía. Con el bloqueo activado eso no
    // llegaba ni de lejos: Android trae la app al frente, aparece el
    // candado, y mientras la persona pone su huella o su PIN el reintento ya
    // se había dado por vencido. Al desbloquear salía Inicio y del archivo
    // no quedaba rastro.
    //
    // Ahora son dos minutos, que es tiempo de sobra para desbloquear sin
    // prisa. El tope existe igual: sin él, un archivo que nunca se pueda
    // abrir dejaría un temporizador dando vueltas para siempre.
    function insistir(intentosRestantes: number) {
      if (cancelled) return;
      if (intentar()) return;
      if (intentosRestantes > 0) {
        setTimeout(() => insistir(intentosRestantes - 1), 300);
      }
      // Si se acaban los intentos no se hace nada más: el archivo sigue
      // apuntado en pendingImport y el aviso de Inicio se encarga.
    }

    insistir(400); // 400 × 300 ms = dos minutos
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") insistir(60);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [ready, hasOnboarded, navigationRef]);

  return null;
}

// El mismo nombre de archivo que enseña la pantalla de recordatorios. Se
// calcula cada vez y no se guarda ya hecho a propósito: guardado se quedaría
// con la fecha del día en que se configuró.
//
// Vive fuera del componente para no crearse de nuevo en cada dibujado, que es
// lo que obligaría a meterla en las dependencias del efecto y a volver a
// registrar el escuchador de avisos sin motivo.
function typeLabelFor(type: "all" | "expense" | "income", t: (k: string) => string) {
  if (type === "expense") return t("exportPdf.expenses");
  if (type === "income") return t("exportPdf.income");
  return t("exportPdf.all");
}

/**
 * Lo que pasa cuando llega la hora de un recordatorio de exportación.
 *
 * Tres caminos, y son distintos a propósito:
 *
 *  1. Se toca el aviso → se abre la pantalla de exportar con el mes, el
 *     formato, qué exportar, el destino y el nombre del archivo ya puestos.
 *     Queda darle al botón. Y se arma la repesca, por si se distrae.
 *  2. El destino es Drive → no hace falta tocar nada. Al abrir la app se
 *     sube sola, sin pantalla: la exportación corre en silencio y se cierra
 *     al terminar. Drive es el único destino que puede hacerlo, porque es el
 *     único que no necesita que alguien elija a quién mandar el archivo.
 *  3. Se exporta de verdad → el exportador retira la repesca.
 *
 * Lo de subir "al abrir la app" y no a la hora exacta no es un atajo: armar
 * un PDF necesita un WebView, y un WebView necesita la app en pantalla. Ver
 * la explicación larga en utils/scheduledExport.ts.
 */
function ScheduledExportEffect() {
  const { ready, hasOnboarded, isPremium, t } = useAppData();
  const navigationRef = useNavigationContainerRef();

  // Una sola comprobación por arranque. Sin esto, cada vuelta al frente
  // dispararía otra subida mientras la anterior sigue en marcha.
  const checked = useRef(false);

  useEffect(() => {
    if (!ready || !hasOnboarded || !isPremium) return;

    function abrirExportar(response: Notifications.NotificationResponse) {
      if (response.notification.request.content.data?.screen !== "export") return;
      loadSchedule().then(async (s) => {
        if (!navigationRef.isReady()) return;
        router.push({
          pathname: "/export-pdf",
          params: {
            month: monthForSchedule(s, new Date()),
            format: s.format,
            type: s.type,
            dest: s.destination,
            name: buildFileName({
              mode: s.fileNameMode,
              custom: s.fileName,
              typeLabel: typeLabelFor(s.type, t),
              dateKey: toDateKey(new Date()),
              extension: s.format,
            }),
          },
        });
      });
    }

    // Al tocar el aviso con la app ya abierta o en segundo plano.
    const sub = Notifications.addNotificationResponseReceivedListener(abrirExportar);

    // Y al tocarlo con la app CERRADA del todo, que es el caso normal a las
    // 9 de la mañana. Ahí el toque abre la app desde cero, y para cuando el
    // escuchador de arriba queda registrado el aviso ya se entregó: sin esto,
    // tocar el recordatorio abría Finzo en Inicio y no pasaba nada más. Justo
    // lo que la función entera existe para evitar.
    Notifications.getLastNotificationResponseAsync().then(async (last) => {
      if (!last) return;
      // Ese método no olvida nunca: devuelve el último aviso tocado aunque
      // hayan pasado días y aunque ahora se esté abriendo la app desde el
      // icono. Se comprueba que no se haya atendido ya, o la pantalla de
      // exportar saltaría sola en cada arranque a partir del primer toque.
      const cuando = last.notification.date;
      if (await alreadyHandledTap(cuando)) return;
      markTapHandled(cuando);
      abrirExportar(last);
    });

    // La copia que se guarda sola, sin tocar nada.
    if (!checked.current) {
      checked.current = true;
      loadSchedule().then((s) => {
        const now = new Date();
        if (!isAutoRunDue(s, now)) return;
        if (!navigationRef.isReady()) return;
        // Se apunta ANTES de exportar, no después. Si se apuntara después y
        // la subida fallara a medias, al reabrir la app volvería a intentarlo
        // en bucle. Perder una copia es molesto; repetirla sin parar hasta
        // que alguien lo note, peor.
        saveSchedule({ ...s, lastAutoRun: claveDeEjecucion(s, now) });
        router.push({
          pathname: "/export-pdf",
          params: {
            month: monthForSchedule(s, now),
            format: s.format,
            type: s.type,
            // El destino que la persona eligió, no "drive" fijo. Con el fijo,
            // quien eligiera la carpeta del teléfono recibía su copia en Drive.
            dest: s.destination,
            auto: "1",
            silent: "1",
            name: buildFileName({
              mode: s.fileNameMode,
              custom: s.fileName,
              typeLabel: typeLabelFor(s.type, t),
              dateKey: toDateKey(now),
              extension: s.format,
            }),
          },
        });
      });
    }

    return () => sub.remove();
  }, [ready, hasOnboarded, isPremium, navigationRef, t]);

  return null;
}

function AppLifecycleEffects() {
  const { hasOnboarded } = useAppData();
  const prevState = useRef(AppState.currentState);
  const navigationRef = useNavigationContainerRef();
  // En qué pantalla está la persona ahora mismo. Se guarda en una "caja"
  // para poder leerlo desde el escuchador de abajo sin tener que volver a
  // registrarlo cada vez que se cambia de pantalla.
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const cameFromBackground = /inactive|background/.test(prevState.current);
      if (cameFromBackground && nextState === "active" && hasOnboarded && navigationRef.isReady()) {
        // Si viene un archivo de fuera, la app no vuelve a Inicio: está a
        // punto de abrir Importar. Consultar KEEP_ON_RETURN aquí no bastaría
        // —esa lista se compara con la pantalla en la que la app cree estar,
        // que en este instante sigue siendo Inicio porque la de importar
        // todavía no ha llegado—. Ver la explicación en la bandera.
        if (!abriendoArchivoEntrante() && !KEEP_ON_RETURN.includes(pathnameRef.current)) {
          router.dismissTo("/(tabs)");
        }
      }
      if (nextState === "background" || nextState === "inactive") {
        flushPendingSaves();
      }
      prevState.current = nextState;
    });
    return () => sub.remove();
  }, [hasOnboarded, navigationRef]);

  return null;
}

export const unstable_settings = {
  anchor: "index",
};

function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  // Mismo color que bg-white / dark:bg-slate-900 (Tailwind). Se usa como
  // fondo nativo de las pantallas de tipo "modal", para que el instante
  // antes de que React pinte su contenido ya se vea del color correcto.
  const screenBg = colorScheme === "dark" ? "#0f172a" : "#ffffff";

  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            {/* transaction/new y transaction/[id]/edit muestran AddSheet, una
                pantalla LLENA y opaca. Van con "modal" normal —no
                "transparentModal"— porque transparentModal en Android está
                pensado para paneles que ocupan SOLO PARTE de la pantalla
                (como AddChooser, más abajo): le da al contenido una ventana
                nativa que en la práctica resultó ser más chica que la
                pantalla completa. Nada que hiciéramos en React —ni
                "position: absolute, inset 0"— podía arreglarlo, porque el
                límite que se veía (Inicio asomando con su lista y su botón
                "+") estaba FUERA de esa ventana, a nivel del sistema
                operativo, no dentro de nuestra propia jerarquía de vistas.
                Volvimos a "modal", que sí reserva una ventana del tamaño
                real del dispositivo.
                Para el destello blanco (que fue la razón original del
                cambio a transparentModal): en vez de quitar el fondo nativo
                por completo, se le da el color correcto del tema con
                "contentStyle" — así el instante antes de que React pinte su
                contenido, el fondo nativo YA es del color correcto, en vez
                de blanco por defecto. */}
            <Stack.Screen
              name="transaction/new"
              options={{ presentation: "modal", contentStyle: { backgroundColor: screenBg } }}
            />
            <Stack.Screen
              name="transaction/[id]/edit"
              options={{ presentation: "modal", contentStyle: { backgroundColor: screenBg } }}
            />
            {/* "Nueva categoría" se apila ENCIMA de esas dos, y sin declararla
                tomaba la animación por defecto de Android: el cambio se sentía
                brusco.
                Se desliza desde la derecha, que es lo que hace una pantalla
                que se apila encima, y al volver se desliza de vuelta sola.
                SE PROBÓ EL FUNDIDO Y EL USUARIO LO QUITÓ (05/08/2026). Se
                anota para no volver a proponerlo: sobre el papel es más suave,
                pero al usarlo la pantalla aparece de la nada y el fundido se
                nota como un parpadeo, no como un movimiento.
                La animación la corre el sistema, no nuestro código, así que
                sigue siendo suave aunque la pantalla esté armando sus iconos
                en ese momento.
                Y el fondo del tema en "contentStyle" por lo mismo que las de
                arriba: en el instante previo a que React pinte, el fondo
                nativo ya es del color correcto en vez del blanco por defecto,
                que es la otra mitad de lo que se veía brusco. */}
            <Stack.Screen
              name="nueva-categoria"
              options={{
                animation: "slide_from_right",
                contentStyle: { backgroundColor: screenBg },
              }}
            />
            {/* "Elegir categoría" se apila igual que la de arriba y por los
                mismos motivos, así que lleva la misma animación: si una se
                deslizara y la otra no, pasar de una a la otra se sentiría como
                dos apps distintas. */}
            <Stack.Screen
              name="elegir-categoria"
              options={{
                animation: "slide_from_right",
                contentStyle: { backgroundColor: screenBg },
              }}
            />
            {/* La pantalla de voz pasó de ocupar todo a ser un panel encima
                de lo que hubiera, con el resto oscurecido. Por eso ahora va
                con "transparentModal" —el caso para el que sirve, según la
                nota de arriba— y con el fondo transparente explícito, para
                que en el instante previo a dibujarse se vea lo de detrás y
                no un rectángulo de color. */}
            <Stack.Screen
              name="voice"
              options={{ presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }}
            />

            {/* Estas SÍ son paneles que ocupan solo parte de la pantalla
                (fondo oscuro translúcido, se ve Inicio difuminado detrás) —
                para ellas "transparentModal" es el uso correcto y ya
                funciona bien: evita el mismo destello blanco sin el
                problema de ventana recortada, porque su contenido real
                nunca pretendió cubrir el dispositivo entero.

                contentStyle transparent explícito: sin esto, el instante
                antes de que React pinte el panel (con su propio overlay
                oscuro translúcido), Android puede mostrar de fondo el color
                por defecto del tema en vez de dejar ver Inicio — un destello
                vacío del mismo tipo que el destello blanco de "Nuevo
                movimiento", solo que oscuro (por eso pasaba desapercibido
                en modo oscuro). Confirmado con la app real al abrir el
                panel de "Agregar gasto/ingreso" desde Inicio. */}
            <Stack.Screen
              name="transaction/choose"
              options={{ presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }}
            />
            <Stack.Screen
              name="savings/form"
              options={{ presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }}
            />
            <Stack.Screen
              name="savings/move"
              options={{ presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }}
            />
            <Stack.Screen
              name="savings/picker"
              options={{ presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }}
            />
            <Stack.Screen
              name="export-pdf"
              options={{ presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }}
            />
            <Stack.Screen
              name="import"
              options={{ presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }}
            />
          </Stack>
          <GlobalOverlays />
          {/* IncomingFileEffect va ANTES que AppLifecycleEffects, y el orden
              importa de verdad: los dos escuchan el aviso de "la app volvió
              al frente", y se les llama en el orden en que se registraron.
              Así, cuando llega un archivo compartido, este levanta su bandera
              antes de que el otro decida mandar a Inicio. Al revés, la
              importación se perdía. */}
          <IncomingFileEffect />
          <AppLifecycleEffects />
          <ScheduledExportEffect />
          {/* Va aquí, el último de todos, para quedar POR ENCIMA de todo lo
              demás — incluidos los paneles modales. Si fuera una pantalla de
              navegación, bastaría el botón "atrás" de Android para
              saltárselo. */}
          <AppLockGate />
          <ThemedStatusBar />
        </View>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}

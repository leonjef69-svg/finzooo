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
import AppLockGate from "@/components/AppLockGate";
import CelebrationOverlay from "@/components/CelebrationOverlay";
import Toast from "@/components/Toast";
import * as incomingFile from "@/modules/incoming-file";
import * as Notifications from "expo-notifications";
import {
  alreadyHandledTap,
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
];

/**
 * Abre Importar cuando Finzo se ha lanzado con un archivo desde otra app
 * ("Compartir → Finzo" o "Abrir con → Finzo" sobre un estado de cuenta).
 *
 * Se mira al arrancar y cada vez que la app vuelve al frente: si ya estaba
 * abierta, Android no la reinicia, solo le entrega el archivo nuevo.
 *
 * consumePendingFile() solo entrega el archivo UNA vez, así que no hace
 * falta llevar la cuenta aquí de lo que ya se importó.
 */
function IncomingFileEffect() {
  const { ready, hasOnboarded } = useAppData();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    // Sin la app configurada no hay dónde importar: el archivo se recoge
    // igual (para no dejarlo pendiente) pero no se hace nada con él.
    if (!ready) return;

    function check() {
      const file = incomingFile.consumePendingFile();
      if (!file) return;
      if (!hasOnboarded || !navigationRef.isReady()) return;
      router.push({ pathname: "/import", params: { uri: file.uri, name: file.name } });
    }

    check();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") check();
    });
    return () => sub.remove();
  }, [ready, hasOnboarded, navigationRef]);

  return null;
}

/**
 * Lo que pasa cuando llega la hora de una exportación programada.
 *
 * Dos caminos, y son distintos a propósito:
 *
 *  1. Se toca el aviso → se abre la pantalla de exportar con el mes, el
 *     formato, qué exportar y el destino ya puestos. Queda darle al botón.
 *  2. El destino es Drive → no hace falta tocar nada. Al abrir la app se
 *     sube sola, sin pantalla: la exportación corre en silencio y se cierra
 *     al terminar. Drive es el único destino que puede hacerlo, porque es el
 *     único que no necesita que alguien elija a quién mandar el archivo.
 *
 * Lo de subir "al abrir la app" y no a la hora exacta no es un atajo: armar
 * un PDF necesita un WebView, y un WebView necesita la app en pantalla. Ver
 * la explicación larga en utils/scheduledExport.ts.
 */
function ScheduledExportEffect() {
  const { ready, hasOnboarded, isPremium } = useAppData();
  const navigationRef = useNavigationContainerRef();
  // Una sola comprobación por arranque. Sin esto, cada vuelta al frente
  // dispararía otra subida mientras la anterior sigue en marcha.
  const checked = useRef(false);

  useEffect(() => {
    if (!ready || !hasOnboarded || !isPremium) return;

    function abrirExportar(response: Notifications.NotificationResponse) {
      if (response.notification.request.content.data?.screen !== "export") return;
      loadSchedule().then((s) => {
        if (!navigationRef.isReady()) return;
        router.push({
          pathname: "/export-pdf",
          params: {
            month: monthForSchedule(s, new Date()),
            format: s.format,
            type: s.type,
            dest: s.destination,
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

    // La subida sola a Drive.
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
        saveSchedule({ ...s, lastAutoRun: toDateKey(now) });
        router.push({
          pathname: "/export-pdf",
          params: {
            month: monthForSchedule(s, now),
            format: s.format,
            type: s.type,
            dest: "drive",
            auto: "1",
            silent: "1",
          },
        });
      });
    }

    return () => sub.remove();
  }, [ready, hasOnboarded, isPremium, navigationRef]);

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
        if (!KEEP_ON_RETURN.includes(pathnameRef.current)) {
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
              name="edit-budget"
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
          <AppLifecycleEffects />
          <IncomingFileEffect />
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

import { useEffect, useRef } from "react";
import { AppState, View } from "react-native";
import { Stack, router, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import "react-native-reanimated";
import "../global.css";
import { AppDataProvider, useAppData } from "@/contexts/AppDataContext";
import CelebrationOverlay from "@/components/CelebrationOverlay";
import Toast from "@/components/Toast";

function GlobalOverlays() {
  const { celebrateGoal, clearCelebration, toast } = useAppData();
  return (
    <>
      <CelebrationOverlay goalName={celebrateGoal} onClose={clearCelebration} />
      <Toast text={toast} />
    </>
  );
}

// Cada vez que se sale de la app (se manda a segundo plano) y se vuelve a
// entrar, regresa siempre a Inicio (el saldo disponible) — nunca deja a la
// persona a medio camino en "Agregar movimiento" u otra pantalla.
function ResetToHomeOnResume() {
  const { hasOnboarded } = useAppData();
  const prevState = useRef(AppState.currentState);
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const cameFromBackground = /inactive|background/.test(prevState.current);
      if (cameFromBackground && nextState === "active" && hasOnboarded && navigationRef.isReady()) {
        router.dismissTo("/(tabs)");
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

            {/* Estas SÍ son paneles que ocupan solo parte de la pantalla
                (fondo oscuro translúcido, se ve Inicio difuminado detrás) —
                para ellas "transparentModal" es el uso correcto y ya
                funciona bien: evita el mismo destello blanco sin el
                problema de ventana recortada, porque su contenido real
                nunca pretendió cubrir el dispositivo entero. */}
            <Stack.Screen name="transaction/choose" options={{ presentation: "transparentModal" }} />
            <Stack.Screen name="edit-budget" options={{ presentation: "transparentModal" }} />
            <Stack.Screen name="savings/form" options={{ presentation: "transparentModal" }} />
            <Stack.Screen name="savings/move" options={{ presentation: "transparentModal" }} />
            <Stack.Screen name="savings/picker" options={{ presentation: "transparentModal" }} />
            <Stack.Screen name="export-pdf" options={{ presentation: "transparentModal" }} />
            <Stack.Screen name="import" options={{ presentation: "transparentModal" }} />
          </Stack>
          <GlobalOverlays />
          <ResetToHomeOnResume />
          <ThemedStatusBar />
        </View>
      </AppDataProvider>
    </SafeAreaProvider>
  );
}

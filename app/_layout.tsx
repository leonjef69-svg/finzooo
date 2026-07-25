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
  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            {/* transaction/new y transaction/[id]/edit muestran AddSheet, que
                ahora es una pantalla llena y opaca — "modal" normal es
                correcto porque no hay nada transparente detrás que se vea. */}
            <Stack.Screen name="transaction/new" options={{ presentation: "modal" }} />
            <Stack.Screen name="transaction/[id]/edit" options={{ presentation: "modal" }} />

            {/* El resto son hojas con fondo oscuro translúcido (se ve la
                pantalla de atrás difuminada). Con "modal" a secas, Android
                pinta primero un fondo BLANCO opaco por defecto y recién un
                instante después la hoja translúcida — eso es el destello
                blanco. "transparentModal" no pinta ningún fondo propio: se
                ve la pantalla de atrás desde el primer fotograma. */}
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

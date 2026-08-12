import { router } from "expo-router";
import VoiceEntry from "@/screens/VoiceEntry";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useNavigateWhenReady } from "@/utils/nav";

// Pantalla propia (y no un panel dentro de otra) a propósito: el ícono de
// micrófono de la pantalla de inicio del celular abre justo esta dirección,
// "finzo://voice", sin pasar por el resto de la app.
//
// OJO: esta pantalla NO usa useRedirectIfOrphaned, y es intencional.
//
// Ese guard existe para pantallas que nunca deberían ser la primera que se
// ve al abrir la app, y funciona comprobando si hay una pantalla anterior a
// la que volver. Aquí eso lo rompería todo: cuando se entra desde el
// widget, la app arranca DIRECTO aquí y no hay nada detrás — el guard lo
// leería como un error y mandaría a Inicio, que es exactamente lo que el
// widget existe para evitar.
//
// La protección que sí hace falta es otra: que nadie acabe dictando gastos
// sin haber configurado la app. Eso es lo que revisa el bloque de abajo.
export default function VoiceRoute() {
  const { ready, hasOnboarded, isPremium } = useAppData();

  // EL MICRÓFONO ES PREMIUM DESDE EL 11/08/2026, y esta es la puerta que no se puede dejar
  // abierta. El widget del escritorio de Android abre esta dirección SIN pasar por la app: si
  // alguien lo colocó cuando tenía Premium y luego se le acaba, el ícono sigue en su pantalla
  // de inicio. Sin esta comprobación, ese ícono sería un micrófono Premium funcionando gratis
  // para siempre — y no habría forma de enterarse, porque no se pasa por ninguna pantalla que
  // lo mire.
  useNavigateWhenReady(
    ready && !hasOnboarded
      ? () => router.replace("/onboarding")
      : ready && hasOnboarded && !isPremium
        ? () => router.replace("/(tabs)")
        : null,
    [ready, hasOnboarded, isPremium]
  );

  // Mientras se cargan los datos guardados no se dibuja nada: si el
  // micrófono se abriera antes, podría guardar un movimiento en una lista
  // que todavía está vacía y perderse al terminar de cargar.
  if (!ready || !hasOnboarded || !isPremium) return null;

  return <VoiceEntry onClose={safeBack} />;
}

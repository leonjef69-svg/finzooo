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
  const { ready, hasOnboarded } = useAppData();

  useNavigateWhenReady(
    ready && !hasOnboarded ? () => router.replace("/onboarding") : null,
    [ready, hasOnboarded]
  );

  // Mientras se cargan los datos guardados no se dibuja nada: si el
  // micrófono se abriera antes, podría guardar un movimiento en una lista
  // que todavía está vacía y perderse al terminar de cargar.
  if (!ready || !hasOnboarded) return null;

  return <VoiceEntry onClose={safeBack} />;
}

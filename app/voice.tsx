import VoiceEntry from "@/screens/VoiceEntry";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

// Pantalla propia (y no un panel dentro de otra) a propósito: más adelante
// el ícono de micrófono de la pantalla de inicio del celular va a abrir
// justo esta dirección, "finzo://voice", sin pasar por el resto de la app.
export default function VoiceRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <VoiceEntry onClose={safeBack} />;
}

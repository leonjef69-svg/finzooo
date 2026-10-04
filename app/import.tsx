import ImportSheet from "@/screens/ImportSheet";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";
import { usePendingImport } from "@/utils/pendingImport";

export default function ImportRoute() {
  const { t, isPremium } = useAppData();
  // El archivo compartido se recibe por el módulo nativo y queda en memoria.
  // Nunca se acepta una ruta de archivo desde la dirección: un enlace externo
  // no debe poder hacer que Fino lea ni borre archivos del teléfono.
  const incoming = usePendingImport();

  // Al llegar desde otra app, Fino arranca DIRECTO aquí y no hay ninguna
  // pantalla detrás. El guardián de pantallas huérfanas lo leería como un
  // error y mandaría a Inicio, justo lo contrario de lo que se quiere.
  const blocked = useRedirectIfOrphaned(incoming != null);
  if (blocked) return null;

  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("importSheet.title")}
        description={t("importSheet.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => irUnaVez("/premium")}
      />
    );
  }

  return <ImportSheet onClose={safeBack} incoming={incoming} />;
}

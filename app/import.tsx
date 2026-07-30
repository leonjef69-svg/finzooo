import { router, useLocalSearchParams } from "expo-router";
import ImportSheet from "@/screens/ImportSheet";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function ImportRoute() {
  const { t, isPremium } = useAppData();
  // Cuando se llega desde "Compartir → Finzo", el archivo viene en la
  // dirección de la pantalla y se carga solo.
  const { uri, name } = useLocalSearchParams<{ uri?: string; name?: string }>();
  const incoming = uri && name ? { uri, name } : null;

  // Al llegar desde otra app, Finzo arranca DIRECTO aquí y no hay ninguna
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
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  return <ImportSheet onClose={safeBack} incoming={incoming} />;
}

import { router } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import Negocios from "@/screens/Negocios";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function NegocioRoute() {
  const { t, isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // EL MODO NEGOCIO ES PREMIUM. Decisión suya del 07/08/2026.
  //
  // El candado va aquí, en la puerta de la pantalla, igual que en importar, exportar, metas y
  // los límites por categoría. Ese es el patrón de la app y no hay motivo para inventar otro:
  // una comprobación dentro de la pantalla dejaría el negocio a medio dibujar.
  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("negocios.title")}
        description={t("negocios.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  return <Negocios onBack={safeBack} />;
}

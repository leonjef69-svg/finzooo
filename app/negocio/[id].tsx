import { router, useLocalSearchParams } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import PanelNegocio from "@/screens/PanelNegocio";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function PanelNegocioRoute() {
  const { t, isPremium, negocios } = useAppData();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // EL CANDADO, igual que en la lista de negocios y en los productos. Va en la puerta de la
  // pantalla y no dentro: una comprobación de por medio dejaría el panel a medio dibujar.
  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("panel.title")}
        description={t("negocios.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  // SIN NEGOCIO NO HAY PANEL, y se vuelve en vez de enseñar totales de la nada. Pasa de
  // verdad: se borra el negocio desde otro celular y la nube lo quita con esta pantalla
  // abierta. Es lo mismo que hace la pantalla de productos, y por lo mismo.
  const negocio = id ? negocios.find((n) => n.id === id) : undefined;
  if (!negocio) {
    safeBack();
    return null;
  }

  return <PanelNegocio negocioId={negocio.id} onBack={safeBack} />;
}

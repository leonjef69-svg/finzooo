import { useLocalSearchParams } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import NuevaVenta from "@/screens/NuevaVenta";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";

export default function NuevaVentaRoute() {
  const { t, isPremium, negocios } = useAppData();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // EL CANDADO, igual que en el panel, la lista y los productos. En la puerta, no dentro.
  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("venta.title")}
        description={t("negocios.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => irUnaVez("/premium")}
      />
    );
  }

  // SIN NEGOCIO NO SE REGISTRA NADA, y se vuelve. Aquí importa más que en el panel: guardar
  // una venta de un negocio que ya no existe la dejaría huérfana, contando en ningún sitio y
  // sin forma de verla ni de borrarla.
  const negocio = id ? negocios.find((n) => n.id === id) : undefined;
  if (!negocio) {
    safeBack();
    return null;
  }

  return <NuevaVenta negocioId={negocio.id} onBack={safeBack} />;
}

import { router, useLocalSearchParams } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import MovimientoNegocio from "@/screens/MovimientoNegocio";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function MovimientoNegocioRoute() {
  const { t, isPremium, negocios } = useAppData();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // EL CANDADO, igual que en el panel, la venta, los productos y la lista.
  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("caja.title")}
        description={t("negocios.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  // SIN NEGOCIO NO SE ANOTA NADA: un gasto de un negocio que ya no existe no contaria en
  // ningun saldo y no habria forma de verlo ni de borrarlo.
  const negocio = id ? negocios.find((n) => n.id === id) : undefined;
  if (!negocio) {
    safeBack();
    return null;
  }

  return <MovimientoNegocio negocioId={negocio.id} onBack={safeBack} />;
}

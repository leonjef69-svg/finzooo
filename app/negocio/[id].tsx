import { router, useLocalSearchParams } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import PanelNegocio from "@/screens/PanelNegocio";
import { useAppData } from "@/contexts/AppDataContext";
import { candadoPremium, puedeTocar } from "@/utils/candado";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function PanelNegocioRoute() {
  const { t, isPremium, negocios } = useAppData();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  /**
   * EL CANDADO, PERO SIN DEJAR A NADIE FUERA DE SU PROPIO NEGOCIO.
   *
   * Quien ya creó un negocio puede verlo aunque se le acabe la prueba: registrar es lo que
   * cuesta Premium, mirar lo que ya anotó no. Ver utils/candado.
   *
   * Sin negocios no hay nada que enseñar, así que ahí el candado sigue cerrado y hace su
   * trabajo: explicar para qué sirve Premium en vez de abrir una pantalla vacía.
   */
  const estado = candadoPremium(isPremium, negocios.length > 0);
  if (estado === "cerrado") {
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

  return <PanelNegocio negocioId={negocio.id} onBack={safeBack} soloLectura={!puedeTocar(estado)} />;
}

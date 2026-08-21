import { useLocalSearchParams } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import Productos from "@/screens/Productos";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";

export default function ProductosRoute() {
  const { t, isPremium, negocios } = useAppData();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // El candado, igual que en la lista de negocios y en el resto de lo Premium.
  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("productos.title")}
        description={t("negocios.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => irUnaVez("/premium")}
      />
    );
  }

  // SIN NEGOCIO NO HAY PANTALLA, y se vuelve en vez de dibujar una vacía.
  //
  // Puede pasar de verdad: se entra a los productos, se borra el negocio desde otro celular y
  // la nube lo quita mientras esta pantalla está abierta. Sin esto quedaría una lista de
  // productos de un negocio que ya no existe, y guardar ahí crearía productos huérfanos.
  const negocio = id ? negocios.find((n) => n.id === id) : undefined;
  if (!negocio) {
    safeBack();
    return null;
  }

  return <Productos negocioId={negocio.id} onBack={safeBack} />;
}

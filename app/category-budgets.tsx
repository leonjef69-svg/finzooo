import CategoryBudgets from "@/screens/CategoryBudgets";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { candadoPremium, puedeTocar } from "@/utils/candado";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";

export default function CategoryBudgetsRoute() {
  const { t, isPremium, categoryBudgets } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // VER LOS LÍMITES QUE YA PUSISTE ES GRATIS; cambiarlos es Premium. Sin ningún límite puesto
  // el candado sigue cerrado: la pantalla estaría vacía. Ver utils/candado.
  const estado = candadoPremium(isPremium, Object.keys(categoryBudgets).length > 0);
  if (estado === "cerrado") {
    return (
      <PremiumLocked
        title={t("categoryBudgets.title")}
        description={t("categoryBudgets.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => irUnaVez("/premium")}
      />
    );
  }

  return <CategoryBudgets onBack={safeBack} soloLectura={!puedeTocar(estado)} />;
}

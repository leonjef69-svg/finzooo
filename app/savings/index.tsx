import PremiumLocked from "@/components/PremiumLocked";
import SavingsList from "@/screens/SavingsList";
import { useAppData } from "@/contexts/AppDataContext";
import { candadoPremium, puedeTocar } from "@/utils/candado";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";

export default function SavingsIndexRoute() {
  const { t, isPremium, goals, disponible, apartado, libre, descuadre, monthLabel } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // VER LAS METAS QUE YA CREASTE ES GRATIS; crear y mover plata es Premium. Sin ninguna meta
  // el candado sigue cerrado: no hay nada que enseñar. Ver utils/candado.
  const estado = candadoPremium(isPremium, goals.length > 0);
  if (estado === "cerrado") {
    return (
      <PremiumLocked
        title={t("savingsList.title")}
        description={t("savingsLocked.description")}
        onBack={safeBack}
        onSeePremium={() => irUnaVez("/premium")}
      />
    );
  }

  return (
    <SavingsList
      goals={goals}
      onBack={safeBack}
      onAdd={() => irUnaVez("/savings/form")}
      onOpen={(id) => irUnaVez(`/savings/${id}`)}
      disponible={disponible}
      apartado={apartado}
      libre={libre}
      descuadre={descuadre}
      monthLabel={monthLabel}
      soloLectura={!puedeTocar(estado)}
      onAllocate={() => {
        if (goals.length === 0) irUnaVez("/savings/form");
        else irUnaVez("/savings/picker");
      }}
    />
  );
}

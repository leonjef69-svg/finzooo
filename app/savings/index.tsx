import { router } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import SavingsList from "@/screens/SavingsList";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function SavingsIndexRoute() {
  const { t, isPremium, goals, disponible, apartado, libre, descuadre, monthLabel } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("savingsList.title")}
        description={t("savingsLocked.description")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  return (
    <SavingsList
      goals={goals}
      onBack={safeBack}
      onAdd={() => router.push("/savings/form")}
      onOpen={(id) => router.push(`/savings/${id}`)}
      disponible={disponible}
      apartado={apartado}
      libre={libre}
      descuadre={descuadre}
      monthLabel={monthLabel}
      onAllocate={() => {
        if (goals.length === 0) router.push("/savings/form");
        else router.push("/savings/picker");
      }}
    />
  );
}

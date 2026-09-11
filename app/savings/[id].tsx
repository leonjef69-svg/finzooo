import { router, useLocalSearchParams } from "expo-router";
import SavingsDetail from "@/screens/SavingsDetail";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";

export default function SavingsDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, deleteGoal, isPremium } = useAppData();
  const goal = goals.find((g) => String(g.id) === id);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <SavingsDetail
      goal={goal}
      onBack={safeBack}
      onEdit={() => irUnaVez(isPremium ? `/savings/form?id=${id}` : "/premium")}
      onDelete={(goalId) => {
        if (!isPremium) return irUnaVez("/premium");
        deleteGoal(goalId);
        router.replace("/savings");
      }}
      onAdd={() => irUnaVez(isPremium ? `/savings/move?id=${id}&mode=add` : "/premium")}
      onWithdraw={() => irUnaVez(isPremium ? `/savings/move?id=${id}&mode=withdraw` : "/premium")}
    />
  );
}

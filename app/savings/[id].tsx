import { router, useLocalSearchParams } from "expo-router";
import SavingsDetail from "@/screens/SavingsDetail";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";

export default function SavingsDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, deleteGoal } = useAppData();
  const goal = goals.find((g) => String(g.id) === id);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <SavingsDetail
      goal={goal}
      onBack={safeBack}
      onEdit={() => irUnaVez(`/savings/form?id=${id}`)}
      onDelete={(goalId) => {
        deleteGoal(goalId);
        router.replace("/savings");
      }}
      onAdd={() => irUnaVez(`/savings/move?id=${id}&mode=add`)}
      onWithdraw={() => irUnaVez(`/savings/move?id=${id}&mode=withdraw`)}
    />
  );
}

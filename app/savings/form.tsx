import { router, useLocalSearchParams } from "expo-router";
import GoalFormSheet from "@/screens/GoalFormSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function SavingsFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { goals, addOrUpdateGoal } = useAppData();
  const goal = id ? goals.find((g) => String(g.id) === id) : undefined;
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <GoalFormSheet
      goal={goal}
      onClose={safeBack}
      onSave={(g) => {
        addOrUpdateGoal(g);
        router.replace(`/savings/${g.id}`);
      }}
    />
  );
}

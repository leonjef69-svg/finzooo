import { router } from "expo-router";
import GoalPickerSheet from "@/screens/GoalPickerSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function SavingsPickerRoute() {
  const { goals, autoSavings, addMoneyToGoal } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <GoalPickerSheet
      goals={goals}
      amount={autoSavings}
      onClose={safeBack}
      onPick={(goalId) => {
        addMoneyToGoal(autoSavings, goalId);
        router.replace(`/savings/${goalId}`);
      }}
    />
  );
}

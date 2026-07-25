import { useLocalSearchParams } from "expo-router";
import MoveMoneySheet from "@/screens/MoveMoneySheet";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function SavingsMoveRoute() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: string }>();
  const { goals, addMoneyToGoal, withdrawMoneyFromGoal } = useAppData();
  const goal = goals.find((g) => String(g.id) === id);
  const moveMode = mode === "withdraw" ? "withdraw" : "add";
  const blocked = useRedirectIfOrphaned();

  if (blocked || !goal) return null;

  return (
    <MoveMoneySheet
      mode={moveMode}
      goal={goal}
      onClose={safeBack}
      onConfirm={(amt) => {
        if (moveMode === "add") addMoneyToGoal(amt, goal.id);
        else withdrawMoneyFromGoal(goal.id, amt);
        safeBack();
      }}
    />
  );
}

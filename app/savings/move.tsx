import { useLocalSearchParams } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import MoveMoneySheet from "@/screens/MoveMoneySheet";
import { useAppData } from "@/contexts/AppDataContext";
import { irUnaVez, safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function SavingsMoveRoute() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: string }>();
  const { goals, addMoneyToGoal, withdrawMoneyFromGoal, isPremium, t } = useAppData();
  const goal = goals.find((g) => String(g.id) === id);
  const moveMode = mode === "withdraw" ? "withdraw" : "add";
  const blocked = useRedirectIfOrphaned();

  if (blocked || !goal) return null;
  if (!isPremium) return <PremiumLocked title={t("savingsList.title")} description={t("savingsLocked.description")} onBack={safeBack} onSeePremium={() => irUnaVez("/premium")} />;

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

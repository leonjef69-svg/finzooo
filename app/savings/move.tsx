import { useLocalSearchParams } from "expo-router";
import PremiumLocked from "@/components/PremiumLocked";
import MissingItem from "@/components/MissingItem";
import MoveMoneySheet from "@/screens/MoveMoneySheet";
import UseSavingsSheet from "@/screens/UseSavingsSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { irUnaVez, safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function SavingsMoveRoute() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode: string }>();
  const { goals, commitSavingsAction, isPremium, t } = useAppData();
  const goal = goals.find((g) => String(g.id) === id);
  const moveMode = mode === "withdraw" ? "withdraw" : "add";
  const blocked = useRedirectIfOrphaned();

  if (blocked) return null;
  if (!goal) return <MissingItem onBack={safeBack} />;
  if (!isPremium) return <PremiumLocked title={t("savingsList.title")} description={t("savingsLocked.description")} onBack={safeBack} onSeePremium={() => irUnaVez("/premium")} />;
  if (mode === "use") return <UseSavingsSheet goal={goal} onClose={safeBack} onSave={async transaction => {
    const saved = await commitSavingsAction({ kind: "use", goalId: goal.id, transaction }); if (saved) safeBack(); return saved;
  }} />;

  return (
    <MoveMoneySheet
      mode={moveMode}
      goal={goal}
      onClose={safeBack}
      onConfirm={async (amount) => {
        const saved = await commitSavingsAction({ kind: moveMode, goalId: goal.id, amount });
        if (saved) safeBack();
        return saved;
      }}
    />
  );
}

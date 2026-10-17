import { useLocalSearchParams } from "expo-router";
import GoalFormSheet from "@/screens/GoalFormSheet";
import PremiumLocked from "@/components/PremiumLocked";
import MissingItem from "@/components/MissingItem";
import { useAppData } from "@/contexts/AppDataContext";
import { irUnaVez, safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function SavingsFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { goals, commitSavingsAction, isPremium, t } = useAppData();
  const goal = id ? goals.find((g) => String(g.id) === id) : undefined;
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  if (id && !goal) return <MissingItem onBack={safeBack} />;
  if (!isPremium) return <PremiumLocked title={t("savingsList.title")} description={t("savingsLocked.description")} onBack={safeBack} onSeePremium={() => irUnaVez("/premium")} />;

  return (
    <GoalFormSheet
      goal={goal}
      onClose={safeBack}
      onSave={async (goal, initial, expectedSaved) => {
        const saved = await commitSavingsAction({ kind: id ? "edit" : "create", goal, initial, ...(id ? { saved: goal.saved, expectedSaved } : {}) });
        if (saved) safeBack();
        return saved;
      }}
    />
  );
}

import { router, useLocalSearchParams } from "expo-router";
import GoalFormSheet from "@/screens/GoalFormSheet";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { irUnaVez, safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function SavingsFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { goals, addOrUpdateGoal, isPremium, t } = useAppData();
  const goal = id ? goals.find((g) => String(g.id) === id) : undefined;
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  if (!isPremium) return <PremiumLocked title={t("savingsList.title")} description={t("savingsLocked.description")} onBack={safeBack} onSeePremium={() => irUnaVez("/premium")} />;

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

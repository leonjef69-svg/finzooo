import { router } from "expo-router";
import CategoryBudgets from "@/screens/CategoryBudgets";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function CategoryBudgetsRoute() {
  const { t, isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("categoryBudgets.title")}
        description={t("categoryBudgets.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  return <CategoryBudgets onBack={safeBack} />;
}

import { router } from "expo-router";
import ImportSheet from "@/screens/ImportSheet";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function ImportRoute() {
  const { t, isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("importSheet.title")}
        description={t("importSheet.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  return <ImportSheet onClose={safeBack} />;
}

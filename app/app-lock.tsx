import { router } from "expo-router";
import AppLockSettings from "@/screens/AppLockSettings";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function AppLockRoute() {
  const { t, isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("lock.settingsTitle")}
        description={t("lock.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  return <AppLockSettings onBack={safeBack} />;
}

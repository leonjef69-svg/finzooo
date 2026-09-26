import AppLockSettings from "@/screens/AppLockSettings";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";
import { isLockEnabled } from "@/utils/appLock";
import { useEffect, useState } from "react";

export default function AppLockRoute() {
  const { t, isPremium } = useAppData();
  const [lockWasEnabled, setLockWasEnabled] = useState<boolean | null>(null);
  const blocked = useRedirectIfOrphaned();
  useEffect(() => {
    if (isPremium) {
      setLockWasEnabled(null);
      return;
    }
    void isLockEnabled().then(setLockWasEnabled);
  }, [isPremium]);
  if (blocked) return null;

  if (!isPremium && lockWasEnabled !== true) {
    return (
      <PremiumLocked
        title={t("lock.settingsTitle")}
        description={t("lock.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => irUnaVez("/premium")}
      />
    );
  }

  return <AppLockSettings onBack={safeBack} allowEnable={isPremium} />;
}

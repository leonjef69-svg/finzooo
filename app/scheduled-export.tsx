import { router } from "expo-router";
import ScheduledExportSettings from "@/screens/ScheduledExportSettings";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function ScheduledExportRoute() {
  const { t, isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // Va con Premium porque exportar ya lo está: programar la exportación sin
  // poder exportar no serviría de nada.
  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("schedExport.title")}
        description={t("exportPdf.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  return <ScheduledExportSettings onBack={safeBack} />;
}

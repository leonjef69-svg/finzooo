import { router, useLocalSearchParams } from "expo-router";
import ExportPdfSheet from "@/screens/ExportPdfSheet";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function ExportPdfRoute() {
  const { t, isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  // Mes que puede venir de la orden por voz: "/export-pdf?month=2026-01".
  const { month } = useLocalSearchParams<{ month?: string }>();
  if (blocked) return null;

  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("exportPdf.exportDataTitle")}
        description={t("exportPdf.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => router.push("/premium")}
      />
    );
  }

  return <ExportPdfSheet onClose={safeBack} initialMonth={month} />;
}

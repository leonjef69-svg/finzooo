import { router, useLocalSearchParams } from "expo-router";
import ExportPdfSheet from "@/screens/ExportPdfSheet";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function ExportPdfRoute() {
  const { t, isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  // Lo que puede venir de la orden por voz:
  // "/export-pdf?month=2026-01&format=pdf&auto=1"
  const { month, format, auto, dest } = useLocalSearchParams<{
    month?: string;
    format?: string;
    auto?: string;
    dest?: string;
  }>();
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

  return (
    <ExportPdfSheet
      onClose={safeBack}
      initialMonth={month}
      initialFormat={format === "csv" ? "csv" : "pdf"}
      autoExport={auto === "1"}
      destination={dest === "drive" ? "drive" : "share"}
    />
  );
}

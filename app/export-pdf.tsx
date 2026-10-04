import { useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import ExportPdfSheet from "@/screens/ExportPdfSheet";
import PremiumLocked from "@/components/PremiumLocked";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";
import { takeQueuedExport, type PendingExport } from "@/utils/pendingExport";
import { useAppLocked } from "@/utils/lockState";

export default function ExportPdfRoute() {
  const { t, isPremium } = useAppData();
  const blocked = useRedirectIfOrphaned();
  const locked = useAppLocked();
  // Una URL puede traer cualquier parámetro. Solo un token impredecible que
  // Fino acaba de crear permite ejecutar una orden automática. Lo demás se
  // ignora: un enlace externo abre como mucho el formulario manual.
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const queuedRef = useRef<{ token: string | undefined; value: PendingExport | null } | null>(null);
  const token = typeof intent === "string" ? intent : undefined;
  if (queuedRef.current?.token !== token || queuedRef.current === null) {
    queuedRef.current = { token, value: takeQueuedExport(token) };
  }
  const queued = queuedRef.current.value;
  if (blocked || locked) return null;

  if (!isPremium) {
    return (
      <PremiumLocked
        title={t("exportPdf.exportDataTitle")}
        description={t("exportPdf.lockedDescription")}
        onBack={safeBack}
        onSeePremium={() => irUnaVez("/premium")}
      />
    );
  }

  return (
    <ExportPdfSheet
      onClose={safeBack}
      initialMonth={queued?.month}
      initialFormat={queued?.format ?? "pdf"}
      initialType={queued?.type ?? "all"}
      autoExport={queued?.auto === true}
      initialCharts={queued?.charts === true}
      destination={queued?.destination ?? "share"}
      silent={queued?.silent === true}
      fileName={queued?.fileName}
      recipientName={queued?.recipientName}
      initialSpaceId={queued?.spaceId}
      scheduledRunKey={queued?.runKey}
    />
  );
}

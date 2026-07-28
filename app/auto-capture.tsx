import { useEffect } from "react";
import AutoCapture from "@/screens/AutoCapture";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function AutoCaptureRoute() {
  const { refreshAutoCapture } = useAppData();
  const blocked = useRedirectIfOrphaned();

  // Al entrar se vuelve a preguntar por el permiso: puede haber cambiado en
  // los ajustes de Android desde la última vez que se miró.
  useEffect(() => {
    refreshAutoCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (blocked) return null;
  return <AutoCapture onBack={safeBack} />;
}

import CalendarioPagos from "@/screens/CalendarioPagos";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function CalendarioRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <CalendarioPagos onBack={safeBack} />;
}

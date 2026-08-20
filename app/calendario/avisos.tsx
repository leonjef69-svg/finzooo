import AvisosDelCalendario from "@/screens/AvisosDelCalendario";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function AvisosRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <AvisosDelCalendario onBack={safeBack} />;
}

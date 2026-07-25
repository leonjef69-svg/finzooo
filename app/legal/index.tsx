import Legal from "@/screens/Legal";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function LegalRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <Legal onBack={safeBack} />;
}

import AppInfo from "@/screens/AppInfo";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function AboutRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <AppInfo onBack={safeBack} />;
}

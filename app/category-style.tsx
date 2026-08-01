import CategoryCustomize from "@/screens/CategoryCustomize";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function CategoryStyleRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <CategoryCustomize onBack={safeBack} />;
}

import CategoryBudgets from "@/screens/CategoryBudgets";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function CategoryBudgetsRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <CategoryBudgets onBack={safeBack} />;
}

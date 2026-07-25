import EditBudgetSheet from "@/screens/EditBudgetSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function EditBudgetRoute() {
  const { budget, setBudgetForCurrentMonth } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return (
    <EditBudgetSheet
      current={budget}
      onClose={safeBack}
      onSave={(amount) => {
        setBudgetForCurrentMonth(amount);
        safeBack();
      }}
    />
  );
}

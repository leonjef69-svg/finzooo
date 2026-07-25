import { useLocalSearchParams } from "expo-router";
import AddSheet from "@/screens/AddSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function NewTransactionRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { month, addOrUpdateTransaction } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <AddSheet
      initialType={type === "income" ? "income" : "expense"}
      currentMonth={month}
      onClose={safeBack}
      onSave={(t) => {
        addOrUpdateTransaction(t);
        safeBack();
      }}
    />
  );
}

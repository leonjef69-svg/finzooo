import { router, useLocalSearchParams } from "expo-router";
import AddSheet from "@/screens/AddSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { month, transactions, addOrUpdateTransaction } = useAppData();
  const transaction = transactions.find((t) => String(t.id) === id);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <AddSheet
      transaction={transaction}
      currentMonth={month}
      onClose={safeBack}
      onSave={(t) => {
        addOrUpdateTransaction(t);
        router.dismissTo("/(tabs)");
      }}
    />
  );
}

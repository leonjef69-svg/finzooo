import { router, useLocalSearchParams } from "expo-router";
import AddSheet from "@/screens/AddSheet";
import MissingItem from "@/components/MissingItem";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { month, transactions, addOrUpdateTransaction } = useAppData();
  const transaction = transactions.find((t) => String(t.id) === id);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  if (!transaction) return <MissingItem onBack={safeBack} />;

  return (
    <AddSheet
      transaction={transaction}
      currentMonth={month}
      onClose={safeBack}
      onSave={(t) => {
        if (addOrUpdateTransaction(t, false, true)) router.dismissTo("/(tabs)");
      }}
    />
  );
}

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import AddSheet from "@/screens/AddSheet";
import MissingItem from "@/components/MissingItem";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { month, transactions, addOrUpdateTransaction } = useAppData();
  const transaction = transactions.find((t) => String(t.id) === id);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  if (!transaction || transaction.internalTransfer) return <MissingItem onBack={safeBack} />;

  return (
    <AddSheet
      transaction={transaction}
      currentMonth={month}
      onClose={safeBack}
      onSave={async (t) => {
        const saved = await addOrUpdateTransaction(t, false, true);
        if (saved && mounted.current) router.dismissTo("/(tabs)");
        return saved;
      }}
    />
  );
}

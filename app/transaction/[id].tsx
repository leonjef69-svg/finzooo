import { useLocalSearchParams } from "expo-router";
import Detail from "@/screens/Detail";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned, irUnaVez } from "@/utils/nav";

export default function TransactionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, deleteTransaction } = useAppData();
  const transaction = transactions.find((t) => String(t.id) === id);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <Detail
      transaction={transaction}
      onBack={safeBack}
      onEdit={() => irUnaVez(`/transaction/${id}/edit`)}
      onDelete={(txId) => {
        deleteTransaction(txId);
        safeBack();
      }}
    />
  );
}

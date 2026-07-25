import { router } from "expo-router";
import History from "@/screens/History";
import { useAppData } from "@/contexts/AppDataContext";

export default function HistoryTab() {
  const { transactions, month } = useAppData();
  return (
    <History
      transactions={transactions}
      month={month}
      onOpenDetail={(id) => router.push(`/transaction/${id}`)}
    />
  );
}

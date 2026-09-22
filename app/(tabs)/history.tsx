import { irUnaVez } from "@/utils/nav";
import History from "@/screens/History";
import { useAppData } from "@/contexts/AppDataContext";

export default function HistoryTab() {
  const { transactions, month, setMonth } = useAppData();
  return (
    <History
      transactions={transactions}
      month={month}
      setMonth={setMonth}
      onOpenDetail={(id) => irUnaVez(`/transaction/${id}`)}
    />
  );
}

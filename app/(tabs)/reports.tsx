import Reports from "@/screens/Reports";
import { irUnaVez } from "@/utils/nav";
import { useAppData } from "@/contexts/AppDataContext";

export default function ReportsTab() {
  const { transactions, month } = useAppData();
  return (
    <Reports
      transactions={transactions}
      month={month}
      onSeePremium={() => irUnaVez("/premium")}
    />
  );
}

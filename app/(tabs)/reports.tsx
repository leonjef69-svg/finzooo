import Reports from "@/screens/Reports";
import { useAppData } from "@/contexts/AppDataContext";

export default function ReportsTab() {
  const { transactions, month } = useAppData();
  return (
    <Reports
      transactions={transactions}
      month={month}
    />
  );
}

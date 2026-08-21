import { View } from "react-native";
import { irUnaVez } from "@/utils/nav";
import Home from "@/screens/Home";
import FAB from "@/components/FAB";
import { useAppData } from "@/contexts/AppDataContext";

export default function HomeTab() {
  const {
    userName,
    month,
    setMonth,
    budget,
    spent,
    income,
    prevBalance,
    transactions,
    deleteTransactions,
  } = useAppData();

  return (
    <View className="flex-1 bg-white dark:bg-noche">
      <Home
        userName={userName}
        month={month}
        setMonth={setMonth}
        budget={budget}
        spent={spent}
        income={income}
        prevBalance={prevBalance}
        transactions={transactions}
        onOpenDetail={(id) => irUnaVez(`/transaction/${id}`)}
        onBulkDelete={deleteTransactions}
      />
      <FAB onPress={() => irUnaVez("/transaction/choose")} />
    </View>
  );
}

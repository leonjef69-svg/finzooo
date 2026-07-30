import { router } from "expo-router";
import { View } from "react-native";
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
    <View className="flex-1 bg-white dark:bg-slate-900">
      <Home
        userName={userName}
        month={month}
        setMonth={setMonth}
        budget={budget}
        spent={spent}
        income={income}
        prevBalance={prevBalance}
        transactions={transactions}
        onOpenDetail={(id) => router.push(`/transaction/${id}`)}
        onBulkDelete={deleteTransactions}
        onSeeAll={() => router.push("/(tabs)/history")}
      />
      <FAB onPress={() => router.push("/transaction/choose")} />
    </View>
  );
}

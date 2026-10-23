import { View } from "react-native";
import { irUnaVez } from "@/utils/nav";
import Home from "@/screens/Home";
import { useAppData } from "@/contexts/AppDataContext";

// La fila memorizada conserva su acción aunque cambie un aviso o el respaldo.
const abrirDetalleMovimiento = (id: number) => irUnaVez(`/transaction/${id}`);

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
        onOpenDetail={abrirDetalleMovimiento}
        onBulkDelete={deleteTransactions}
      />
    </View>
  );
}

import { router, useLocalSearchParams } from "expo-router";
import AddSheet from "@/screens/AddSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { useRedirectIfOrphaned } from "@/utils/nav";

export default function NewTransactionRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { month, addOrUpdateTransaction } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // Se llega aquí empujado (push) encima de transaction/choose, no en su
  // lugar (ver ese archivo) — así que "volver" siempre debe saltar directo
  // a Inicio, nunca de vuelta al panel de elegir tipo.
  return (
    <AddSheet
      initialType={type === "income" ? "income" : "expense"}
      currentMonth={month}
      onClose={() => router.dismissTo("/(tabs)")}
      onSave={(t) => {
        addOrUpdateTransaction(t);
        router.dismissTo("/(tabs)");
      }}
    />
  );
}

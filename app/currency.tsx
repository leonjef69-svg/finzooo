import { router } from "expo-router";
import CurrencyPicker from "@/screens/CurrencyPicker";
import { useAppData } from "@/contexts/AppDataContext";

export default function CurrencyRoute() {
  const { userCurrency, updateCurrency } = useAppData();
  return <CurrencyPicker current={userCurrency} onBack={() => router.replace("/setup")} onSelect={updateCurrency} />;
}

import CurrencyPicker from "@/screens/CurrencyPicker";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack } from "@/utils/nav";

export default function CurrencyRoute() {
  const { userCurrency, updateCurrency } = useAppData();
  return <CurrencyPicker current={userCurrency} onBack={safeBack} onSelect={updateCurrency} />;
}

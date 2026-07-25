import CurrencyPicker from "@/screens/CurrencyPicker";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function CurrencyRoute() {
  const { userCurrency, updateCurrency } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <CurrencyPicker current={userCurrency} onBack={safeBack} onSelect={updateCurrency} />;
}

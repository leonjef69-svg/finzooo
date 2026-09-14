import CountryPicker from "@/screens/CountryPicker";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack } from "@/utils/nav";

export default function CountryRoute() {
  const { updateCountry } = useAppData();
  return <CountryPicker onBack={safeBack} onSelect={updateCountry} />;
}

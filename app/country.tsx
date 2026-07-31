import CountryPicker from "@/screens/CountryPicker";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function CountryRoute() {
  const { updateCountry } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <CountryPicker onBack={safeBack} onSelect={updateCountry} />;
}

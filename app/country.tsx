import { router } from "expo-router";
import CountryPicker from "@/screens/CountryPicker";
import { useAppData } from "@/contexts/AppDataContext";

export default function CountryRoute() {
  const { updateCountry } = useAppData();
  return <CountryPicker onBack={() => router.replace("/setup")} onSelect={updateCountry} />;
}

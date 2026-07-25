import LanguagePicker from "@/screens/LanguagePicker";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function LanguageRoute() {
  const { userLanguage, updateLanguage } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <LanguagePicker current={userLanguage} onBack={safeBack} onSelect={updateLanguage} />;
}

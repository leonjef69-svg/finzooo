import ThemePicker from "@/screens/ThemePicker";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function ThemeRoute() {
  const { themeMode, updateThemeMode } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <ThemePicker current={themeMode} onBack={safeBack} onSelect={updateThemeMode} />;
}

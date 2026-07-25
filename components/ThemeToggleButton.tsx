import { TouchableOpacity } from "react-native";
import { Sun, Moon } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useAppData } from "@/contexts/AppDataContext";

export default function ThemeToggleButton() {
  const { colorScheme } = useColorScheme();
  const { updateThemeMode } = useAppData();
  return (
    <TouchableOpacity
      onPress={() => updateThemeMode(colorScheme === "dark" ? "light" : "dark")}
      className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
    >
      {colorScheme === "dark" ? <Sun size={18} color="#94a3b8" /> : <Moon size={18} color="#475569" />}
    </TouchableOpacity>
  );
}

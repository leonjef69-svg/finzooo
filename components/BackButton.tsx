import { TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";

export default function BackButton({ onPress, onDark = false }: { onPress: () => void; onDark?: boolean }) {
  const { colorScheme } = useColorScheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={8}
      className={`w-10 h-10 rounded-full items-center justify-center ${onDark ? "bg-white/95" : "bg-slate-100 dark:bg-noche-2"}`}
    >
      <ChevronLeft size={20} color={onDark ? "#334155" : colorScheme === "dark" ? "#cbd5e1" : "#334155"} />
    </TouchableOpacity>
  );
}

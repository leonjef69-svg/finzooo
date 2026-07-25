import { TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";

export default function BackButton({ onPress }: { onPress: () => void }) {
  const { colorScheme } = useColorScheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
    >
      <ChevronLeft size={20} color={colorScheme === "dark" ? "#cbd5e1" : "#334155"} />
    </TouchableOpacity>
  );
}

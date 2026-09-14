import { TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useRef } from "react";

export default function BackButton({ onPress, onDark = false }: { onPress: () => void; onDark?: boolean }) {
  const { colorScheme } = useColorScheme();
  const ultimoToque = useRef(0);
  function volver() {
    const ahora = Date.now();
    if (ahora - ultimoToque.current < 1000) return;
    ultimoToque.current = ahora;
    onPress();
  }
  return (
    <TouchableOpacity
      onPress={volver}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={8}
      className={`w-10 h-10 rounded-full items-center justify-center ${onDark ? "bg-white/95" : "bg-slate-100 dark:bg-noche-2"}`}
    >
      <ChevronLeft size={20} color={onDark ? "#334155" : colorScheme === "dark" ? "#cbd5e1" : "#334155"} />
    </TouchableOpacity>
  );
}

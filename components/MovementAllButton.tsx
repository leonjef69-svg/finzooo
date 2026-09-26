import { ListFilter } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity } from "react-native";

export default function MovementAllButton({ label, activeFilter, onPress }: {
  label: string;
  activeFilter: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activeFilter) {
      scale.stopAnimation();
      scale.setValue(1);
      return;
    }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.035, duration: 550, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 550, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [activeFilter, scale]);

  return <Animated.View className="min-w-0 flex-1" style={{ transform: [{ scale }] }}>
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Mostrar todos: ${label}`}
      accessibilityHint={activeFilter ? "Quita el filtro y muestra todos los movimientos" : "Ya se muestran todos los movimientos"}
      onPress={onPress}
      className={`min-h-10 flex-row items-center justify-center gap-1.5 rounded-xl border px-2.5 ${activeFilter
        ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950"
        : "border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche-2"}`}
    >
      <ListFilter size={17} color={activeFilter ? "#2563eb" : "#475569"} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className={`text-[14px] font-extrabold ${activeFilter
        ? "text-blue-700 dark:text-blue-300"
        : "text-slate-800 dark:text-slate-100"}`}>{label}</Text>
    </TouchableOpacity>
  </Animated.View>;
}

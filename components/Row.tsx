import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useColorScheme } from "nativewind";
import type { IconComponent } from "@/constants/categories";
import { CARD_SHADOW } from "@/constants/style";

export default function Row({
  Icon,
  label,
  hint,
  right,
  onPress,
  danger,
}: {
  Icon: IconComponent;
  label: string;
  /**
   * Una línea chica debajo del nombre, para lo que hay que saber SIN entrar.
   *
   * Es opcional y casi ninguna fila la usa: si la usaran todas, Ajustes pasaría a ser una
   * pared de texto y dejaría de leerse. Vale la pena solo cuando de no verlo se sigue un
   * malentendido — como no saber que los yapeos están cayendo en el negocio.
   */
  hint?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className="w-full flex-row items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 border-[1.5px] border-slate-200 dark:border-slate-700"
      style={CARD_SHADOW}
    >
      <View className={`w-9 h-9 rounded-xl items-center justify-center ${danger ? "bg-rose-50" : "bg-slate-50 dark:bg-slate-800"}`}>
        <Icon size={16} color={danger ? "#f43f5e" : "#64748b"} />
      </View>
      <View className="flex-1">
        <Text
          className={`text-left text-sm font-bold ${danger ? "text-rose-500" : ""}`}
          style={!danger ? { color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" } : undefined}
        >
          {label}
        </Text>
        {hint ? (
          <Text className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {right}
    </TouchableOpacity>
  );
}

import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useColorScheme } from "nativewind";
import type { IconComponent } from "@/constants/categories";
import { CARD_SHADOW } from "@/constants/style";

export default function Row({
  Icon,
  label,
  right,
  onPress,
  danger,
}: {
  Icon: IconComponent;
  label: string;
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
      <Text
        className={`flex-1 text-left text-sm font-bold ${danger ? "text-rose-500" : ""}`}
        style={!danger ? { color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" } : undefined}
      >
        {label}
      </Text>
      {right}
    </TouchableOpacity>
  );
}

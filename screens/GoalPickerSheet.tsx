import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, PiggyBank } from "lucide-react-native";
import { GOAL_COLOR_HEX } from "@/constants/colors";
import { useAppData } from "@/contexts/AppDataContext";
import type { Goal } from "@/types";
import { useColorScheme } from "nativewind";

export default function GoalPickerSheet({
  goals,
  amount,
  onClose,
  onPick,
}: {
  goals: Goal[];
  amount: number;
  onClose: () => void;
  onPick: (id: number) => void;
}) {
  const { fmt, t } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  return (
    <View className="absolute inset-0 z-40 justify-end">
      <TouchableOpacity className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
      <View
        className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-3"
        style={{ maxHeight: "80%", paddingBottom: 32 + insets.bottom }}
      >
        <View className="items-center mb-3">
          <View className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </View>
        <View className="flex-row items-center justify-between mb-1">
          <Text className="font-extrabold text-slate-900 dark:text-slate-100 text-base">{t("goalPicker.title")}</Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <X size={16} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">
          {t("goalPicker.subtitle", { amount: fmt(amount) })}
        </Text>
        <View className="gap-2.5">
          {goals.map((g, i) => {
            const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
            const color = GOAL_COLOR_HEX[i % GOAL_COLOR_HEX.length];
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => onPick(g.id)}
                className="flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5"
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: color.bg }}
                >
                  <PiggyBank size={18} color={color.fg} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-slate-900 dark:text-slate-100" numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-300">
                    {t("savingsList.savedOfTarget", { saved: fmt(g.saved), target: fmt(g.target) })} ·{" "}
                    {Math.round(pct)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

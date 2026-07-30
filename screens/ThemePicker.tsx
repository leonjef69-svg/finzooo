import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Sun, Moon, Smartphone } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import type { ThemeMode } from "@/contexts/AppDataContext";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

const THEME_OPTIONS: { id: ThemeMode; labelKey: string; Icon: typeof Sun }[] = [
  { id: "light", labelKey: "theme.light", Icon: Sun },
  { id: "dark", labelKey: "theme.dark", Icon: Moon },
  { id: "system", labelKey: "theme.system", Icon: Smartphone },
];

export default function ThemePicker({
  current,
  onBack,
  onSelect,
}: {
  current: ThemeMode;
  onBack: () => void;
  onSelect: (id: ThemeMode) => void;
}) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#94a3b8" : "#334155";
  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("theme.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">{t("theme.subtitle")}</Text>
        <View className="gap-2.5">
          {THEME_OPTIONS.map((opt) => {
            const selected = opt.id === current;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => {
                  onSelect(opt.id);
                  onBack();
                }}
                className={`flex-row items-center justify-between rounded-2xl p-4 border ${
                  selected
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 items-center justify-center">
                    <opt.Icon size={17} color={iconColor} />
                  </View>
                  <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{t(opt.labelKey)}</Text>
                </View>
                {selected && <Check size={18} color="#059669" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

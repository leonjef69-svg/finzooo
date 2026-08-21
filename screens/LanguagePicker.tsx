import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { LANGUAGES } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

export default function LanguagePicker({
  current,
  onBack,
  onSelect,
}: {
  current: string;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("language.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">{t("language.subtitle")}</Text>
        <View className="gap-2.5">
          {LANGUAGES.map((l) => {
            const selected = l.id === current;
            return (
              <TouchableOpacity
                key={l.id}
                onPress={() => {
                  onSelect(l.id);
                  onBack();
                }}
                className={`flex-row items-center justify-between rounded-2xl p-4 border-[1.5px] ${
                  selected
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950"
                    : "border-slate-200 dark:border-noche-borde bg-white dark:bg-noche-2"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-noche-2 items-center justify-center">
                    <Text className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                      {l.id.toUpperCase()}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{l.label}</Text>
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

import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "@/contexts/AppDataContext";

export default function MissingItem({ onBack }: { onBack: () => void }) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white dark:bg-noche items-center justify-center px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="w-full" style={{ maxWidth: 420 }}>
        <Text accessibilityRole="header" className="text-base font-bold text-center text-slate-900 dark:text-slate-100">
          {t("common.missingTitle")}
        </Text>
        <Text className="text-sm text-center mt-2 text-slate-500 dark:text-slate-300">
          {t("common.missingBody")}
        </Text>
        <TouchableOpacity onPress={onBack} accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          className="mt-5 rounded-xl py-3 px-5 bg-emerald-600 items-center">
          <Text className="font-bold text-white">{t("common.back")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

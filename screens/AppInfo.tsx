import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles, Wallet } from "lucide-react-native";
import { LEGAL_CONTACT_EMAIL } from "@/constants/legal";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

const APP_VERSION = "1.0.0";

export default function AppInfo({ onBack }: { onBack: () => void }) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  const WHATS_NEW = [
    t("appInfo.whatsNewItem1"),
    t("appInfo.whatsNewItem2"),
    t("appInfo.whatsNewItem3"),
  ];
  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("appInfo.title")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="items-center pt-4 pb-6">
          <View className="w-16 h-16 rounded-2xl bg-emerald-600 items-center justify-center mb-4">
            <Wallet size={28} color="#ffffff" strokeWidth={2.2} />
          </View>
          <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Finzo</Text>
          <Text className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {t("appInfo.version", { version: APP_VERSION })}
          </Text>
        </View>

        <View className="px-6">
          <Text className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-center">
            {t("appInfo.description")}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-300 text-center mt-6">
            {t("appInfo.questions", { email: LEGAL_CONTACT_EMAIL })}
          </Text>
        </View>

        <View className="h-px bg-slate-100 dark:bg-slate-800 mx-6 mt-8 mb-6" />

        <View className="px-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Sparkles size={16} color="#059669" />
            <Text className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t("appInfo.whatsNew", { version: APP_VERSION })}
            </Text>
          </View>
          <View className="gap-2">
            {WHATS_NEW.map((item, i) => (
              <View key={i} className="flex-row gap-2 pl-1">
                <Text className="text-emerald-600">•</Text>
                <Text className="text-sm text-slate-600 dark:text-slate-300 flex-1 leading-relaxed">{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from "@/constants/legal";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

export default function Legal({ onBack }: { onBack: () => void }) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("settings.legal")}</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-3">{t("legal.privacyHeader")}</Text>
        <Text className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{PRIVACY_POLICY}</Text>

        <View className="h-px bg-slate-100 dark:bg-slate-800 my-8" />

        <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-3">{t("legal.termsHeader")}</Text>
        <Text className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{TERMS_AND_CONDITIONS}</Text>
      </ScrollView>
    </View>
  );
}

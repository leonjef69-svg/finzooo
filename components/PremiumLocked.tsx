import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Lock, Crown } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

export default function PremiumLocked({
  title,
  description,
  onBack,
  onSeePremium,
}: {
  title: string;
  description: string;
  onBack: () => void;
  onSeePremium: () => void;
}) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</Text>
        <View className="w-10" />
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-16 h-16 rounded-3xl bg-amber-50 items-center justify-center mb-5">
          <Lock size={26} color="#f59e0b" />
        </View>
        <Text className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-2 text-center">
          {t("savingsLocked.premiumFeature")}
        </Text>
        <Text className="text-sm text-slate-600 dark:text-slate-200 leading-relaxed mb-6 text-center">
          {description}
        </Text>
        <TouchableOpacity
          onPress={onSeePremium}
          className="bg-amber-400 px-6 py-3.5 rounded-2xl flex-row items-center gap-2"
        >
          {/* El fondo del botón es ámbar SIEMPRE (no cambia con el modo
              oscuro), así que el texto debe quedarse oscuro siempre. Con
              "dark:text-slate-100" se volvía casi blanco sobre amarillo y
              no se leía. */}
          <Crown size={18} color="#0f172a" />
          <Text className="text-slate-900 font-extrabold">{t("savingsLocked.seePremium")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

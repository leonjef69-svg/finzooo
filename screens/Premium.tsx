import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  ChevronLeft,
  Crown,
  FileDown,
  FileUp,
  Sheet,
  PieChart,
  PiggyBank,
  Ban,
  BrainCircuit,
  Check,
  Sparkles,
  CheckCircle2,
} from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";

export default function Premium({
  onBack,
  isPremium,
  onUpgrade,
}: {
  onBack: () => void;
  isPremium: boolean;
  onUpgrade: () => void;
}) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();

  const FREE_PERKS = [
    t("premium.freeTransactions"),
    t("premium.freeHistory"),
    t("premium.freeReports"),
    t("premium.freeBudget"),
    t("premium.freeSearch"),
    t("premium.freeTheme"),
    t("premium.freeSync"),
  ];

  const PREMIUM_PERKS = [
    { Icon: PieChart, label: t("premium.perkCategoryBudgets") },
    { Icon: PiggyBank, label: t("premium.perkSavingsGoals") },
    { Icon: BrainCircuit, label: t("premium.perkAI") },
    { Icon: FileDown, label: t("premium.perkExportPdf") },
    { Icon: Sheet, label: t("premium.perkExportExcel") },
    { Icon: FileUp, label: t("premium.perkImport") },
    { Icon: Ban, label: t("premium.perkNoAds") },
  ];

  return (
    <LinearGradient
      colors={["#0f172a", "#064e3b"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <TouchableOpacity
          onPress={onBack}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
        >
          <ChevronLeft size={20} color="#ffffff" />
        </TouchableOpacity>
        <View className="w-10" />
      </View>
      <View className="px-6 items-center pt-2 pb-6">
        <View className="w-16 h-16 rounded-3xl bg-amber-400 items-center justify-center mb-4">
          <Crown size={28} color="#ffffff" />
        </View>
        <Text className="text-white text-xl font-extrabold">{t("premium.title")}</Text>
        <Text className="text-emerald-100 text-sm mt-1">{t("premium.subtitle")}</Text>
      </View>
      <ScrollView className="px-6 flex-1" contentContainerClassName="gap-4 pb-4">
        <View className="bg-white/5 border border-white/10 rounded-3xl p-5">
          <Text className="text-white text-base font-extrabold mb-3">{t("premium.freeSectionTitle")}</Text>
          <View className="gap-3">
            {FREE_PERKS.map((label) => (
              <View key={label} className="flex-row items-center gap-3">
                <Check size={16} color="#6ee7b7" />
                <Text className="text-sm text-white/80 flex-1">{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="bg-amber-400/10 border-2 border-amber-400/40 rounded-3xl p-5">
          <View className="flex-row items-center gap-2 mb-1">
            <Crown size={16} color="#fcd34d" />
            <Text className="text-amber-300 text-base font-extrabold">{t("premium.premiumSectionTitle")}</Text>
          </View>
          <Text className="text-white/50 text-xs mb-3">{t("premium.premiumSectionSubtitle")}</Text>
          <View className="gap-2.5">
            {PREMIUM_PERKS.map(({ Icon, label }) => (
              <View key={label} className="flex-row items-center gap-3 bg-white/10 rounded-2xl p-3">
                <View className="w-8 h-8 rounded-lg bg-white/10 items-center justify-center">
                  <Icon size={15} color="#fcd34d" />
                </View>
                <Text className="text-sm font-semibold text-white flex-1">{label}</Text>
                <Sparkles size={13} color="#fcd34d" />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View className="px-6 pb-8 pt-4">
        <TouchableOpacity
          onPress={isPremium ? undefined : onUpgrade}
          disabled={isPremium}
          className={`w-full py-4 rounded-2xl items-center ${
            isPremium ? "bg-emerald-500 flex-row justify-center gap-2" : "bg-amber-400"
          }`}
        >
          {isPremium ? (
            <>
              <CheckCircle2 size={18} color="#ffffff" />
              <Text className="text-white font-extrabold">{t("premium.alreadyPremium")}</Text>
            </>
          ) : (
            <Text className="text-slate-900 font-extrabold">{t("premium.upgrade")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

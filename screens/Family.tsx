import BackButton from "@/components/BackButton";
import SpaceSwitcher from "@/components/SpaceSwitcher";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack } from "@/utils/nav";
import { ShieldCheck, UsersRound } from "lucide-react-native";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Family() {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <BackButton onPress={safeBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("family.title")}</Text>
        <View className="w-10" />
      </View>
      <SpaceSwitcher active="family" />
      <View className="mx-5 mt-3 items-center rounded-3xl border-[1.5px] border-emerald-200 bg-emerald-50 px-6 py-7 dark:border-emerald-800 dark:bg-emerald-950/30">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
          <UsersRound size={27} color="#ffffff" />
        </View>
        <Text className="mt-4 text-center text-lg font-extrabold text-slate-900 dark:text-slate-100">{t("family.preparingTitle")}</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-slate-600 dark:text-slate-300">{t("family.preparingBody")}</Text>
        <View className="mt-5 flex-row items-start gap-2 rounded-2xl bg-white px-4 py-3 dark:bg-noche-2">
          <ShieldCheck size={18} color="#059669" />
          <Text className="flex-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">{t("family.security")}</Text>
        </View>
      </View>
    </View>
  );
}

import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUpRight, ArrowDownRight, Mic, ScanLine } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useAppData } from "@/contexts/AppDataContext";

export default function AddChooser({
  onClose,
  onPick,
  onVoice,
  onScan,
}: {
  onClose: () => void;
  onPick: (type: "expense" | "income") => void;
  onVoice: () => void;
  onScan: () => void;
}) {
  const { t } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  return (
    <View className="absolute inset-0 z-40 justify-end">
      <TouchableOpacity className="absolute inset-0 bg-slate-900/40" activeOpacity={1} onPress={onClose} />
      <View className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-3" style={{ paddingBottom: 32 + insets.bottom }}>
        <View className="items-center mb-4">
          <View className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </View>
        <TouchableOpacity
          onPress={() => onPick("expense")}
          className="w-full flex-row items-center gap-4 bg-rose-50 dark:bg-slate-800 rounded-2xl p-4 mb-3"
        >
          <View className="w-11 h-11 rounded-xl bg-rose-500 items-center justify-center">
            <ArrowUpRight size={20} color="#ffffff" />
          </View>
          <View>
            <Text
              className="font-bold text-sm"
              style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
            >
              {t("addChooser.addExpense")}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-300">{t("addChooser.addExpenseHint")}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onPick("income")}
          className="w-full flex-row items-center gap-4 bg-emerald-50 dark:bg-slate-800 rounded-2xl p-4 mb-3"
        >
          <View className="w-11 h-11 rounded-xl bg-emerald-600 items-center justify-center">
            <ArrowDownRight size={20} color="#ffffff" />
          </View>
          <View>
            <Text
              className="font-bold text-sm"
              style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
            >
              {t("addChooser.addIncome")}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-300">{t("addChooser.addIncomeHint")}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onVoice}
          className="w-full flex-row items-center gap-4 bg-violet-50 dark:bg-slate-800 rounded-2xl p-4 mb-3"
        >
          <View className="w-11 h-11 rounded-xl bg-violet-500 items-center justify-center">
            <Mic size={20} color="#ffffff" />
          </View>
          <View>
            <Text
              className="font-bold text-sm"
              style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
            >
              {t("addChooser.addVoice")}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-300">{t("addChooser.addVoiceHint")}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onScan}
          className="w-full flex-row items-center gap-4 bg-emerald-50 dark:bg-slate-800 rounded-2xl p-4 mb-3"
        >
          <View className="w-11 h-11 rounded-xl bg-emerald-700 items-center justify-center">
            <ScanLine size={20} color="#ffffff" />
          </View>
          <View>
            <Text
              className="font-bold text-sm"
              style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
            >
              {t("addChooser.addScan")}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-300">{t("addChooser.addScanHint")}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} className="w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 items-center mt-1">
          <Text className="font-bold text-slate-600 dark:text-slate-200">{t("common.cancel")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

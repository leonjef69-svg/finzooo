import { ChevronDown } from "lucide-react-native";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import { catInfo } from "@/constants/categories";
import { useAppData } from "@/contexts/AppDataContext";

export function validSpaceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function SpaceMovementFields({ type, category, onOpenCategory, date, onDate, notes, onNotes }: {
  type: "ingreso" | "gasto" | null;
  category: string;
  onOpenCategory: () => void;
  date: string;
  onDate: (value: string) => void;
  notes: string;
  onNotes: (value: string) => void;
}) {
  const { t } = useAppData();
  const selected = catInfo(category);
  return <View className="mt-2 gap-2">
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: false }} accessibilityHint={type === "ingreso" ? t("boxes.income") : t("boxes.expense")} onPress={onOpenCategory} className="mt-2 min-h-11 flex-row items-center justify-between rounded-xl border border-slate-200 px-3 dark:border-noche-borde">
      <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("detail.category")}</Text>
      <View className="ml-3 min-w-0 flex-1 flex-row items-center justify-end gap-2">
        <CategoryAvatar id={category} size={19} />
        <Text numberOfLines={1} className="shrink text-right text-sm font-bold text-emerald-700 dark:text-emerald-300">{t(selected.label)}</Text>
        <ChevronDown size={15} color="#64748b" />
      </View>
    </TouchableOpacity>
    <View className="flex-row gap-2"><View className="flex-1"><Text className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("detail.date")}</Text><TextInput disableFullscreenUI accessibilityLabel={t("common.dateYmd")} value={date} onChangeText={onDate} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="AAAA-MM-DD" placeholderTextColor="#94a3b8" className="h-11 rounded-xl border border-slate-200 px-3 text-slate-900 dark:border-noche-borde dark:text-slate-100" /></View><View className="flex-1"><Text className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("detail.notes")}</Text><TextInput disableFullscreenUI accessibilityLabel={`${t("detail.notes")} · ${t("common.optional")}`} value={notes} onChangeText={onNotes} maxLength={300} placeholder={t("common.optional")} placeholderTextColor="#94a3b8" className="h-11 rounded-xl border border-slate-200 px-3 text-slate-900 dark:border-noche-borde dark:text-slate-100" /></View></View>
  </View>;
}

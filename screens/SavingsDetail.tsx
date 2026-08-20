import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pencil, Calendar, Minus, Plus, Trash2, PiggyBank } from "lucide-react-native";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fmtDate } from "@/utils/format";
import { useAppData } from "@/contexts/AppDataContext";
import type { Goal } from "@/types";
import BackButton from "@/components/BackButton";
import { useColorScheme } from "nativewind";

export default function SavingsDetail({
  goal,
  onBack,
  onEdit,
  onDelete,
  onAdd,
  onWithdraw,
}: {
  goal: Goal | undefined;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
  onWithdraw: () => void;
}) {
  const { fmt, t, monthNames } = useAppData();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  if (!goal) return null;
  const pct = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
  const remaining = Math.max(0, goal.target - goal.saved);

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("savingsDetail.title")}</Text>
        <TouchableOpacity
          onPress={onEdit}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-noche-2 items-center justify-center"
        >
          <Pencil size={16} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
        </TouchableOpacity>
      </View>
      <ScrollView className="flex-1">
        <View className="px-6 items-center pt-2 pb-4">
          <View className="w-16 h-16 rounded-3xl bg-emerald-50 items-center justify-center mb-4">
            <PiggyBank size={28} color="#059669" />
          </View>
          <Text className="text-lg font-extrabold text-slate-900 dark:text-slate-100 text-center">{goal.name}</Text>
          <View className={`mt-2 px-2.5 py-1 rounded-full ${goal.completed ? "bg-emerald-100" : "bg-amber-100"}`}>
            <Text className={`text-xs font-bold ${goal.completed ? "text-emerald-600" : "text-amber-600"}`}>
              {goal.completed ? t("savingsDetail.completed") : t("savingsDetail.inProgress")}
            </Text>
          </View>
        </View>

        <View className="px-6 mt-2">
          <View className="w-full h-3 bg-slate-100 dark:bg-noche-2 rounded-full overflow-hidden mb-2">
            <View className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
          </View>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              {t("savingsDetail.pctCompleted", { pct: Math.round(pct) })}
            </Text>
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-300">
              {t("savingsDetail.remaining", { amount: fmt(remaining) })}
            </Text>
          </View>
        </View>

        <View className="px-6 flex-row gap-3 mb-3">
          <View className="flex-1 bg-slate-50 dark:bg-noche-2 rounded-2xl p-3.5">
            <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold mb-1">{t("savingsDetail.saved")}</Text>
            <Text className="text-base font-extrabold text-emerald-600">{fmt(goal.saved)}</Text>
          </View>
          <View className="flex-1 bg-slate-50 dark:bg-noche-2 rounded-2xl p-3.5">
            <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold mb-1">{t("savingsDetail.target")}</Text>
            <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100">{fmt(goal.target)}</Text>
          </View>
        </View>

        <View className="px-6 flex-row items-center gap-3 bg-slate-50 dark:bg-noche-2 rounded-2xl p-3.5 mb-5">
          <Calendar size={16} color="#94a3b8" />
          <Text className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t("savingsDetail.createdOn", { date: fmtDate(goal.createdDate, monthNames) })}
          </Text>
        </View>

        <View className="px-6 flex-row gap-3">
          <TouchableOpacity
            onPress={onWithdraw}
            className="flex-1 py-3.5 rounded-2xl bg-rose-50 flex-row items-center justify-center gap-2"
          >
            <Minus size={16} color="#f43f5e" />
            <Text className="font-bold text-rose-500">{t("moveMoney.withdraw")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onAdd}
            className="flex-1 py-3.5 rounded-2xl bg-emerald-600 flex-row items-center justify-center gap-2"
          >
            <Plus size={16} color="#ffffff" />
            <Text className="font-bold text-white">{t("moveMoney.add")}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setConfirmDelete(true)}
          className="mt-5 mb-6 flex-row items-center justify-center gap-1.5"
        >
          <Trash2 size={13} color="#f43f5e" />
          <Text className="text-rose-500 text-xs font-bold">{t("savingsDetail.deleteGoal")}</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title={t("savingsDetail.confirmDeleteTitle")}
        message={t("savingsDetail.confirmDeleteMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(goal.id)}
      />
    </View>
  );
}

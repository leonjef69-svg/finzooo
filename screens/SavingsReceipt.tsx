import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PiggyBank } from "lucide-react-native";
import { useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import BackButton from "@/components/BackButton";
import { useAppData } from "@/contexts/AppDataContext";
import { fmtDate } from "@/utils/format";
import { irUnaVez } from "@/utils/nav";
import type { Transaction } from "@/types";

export default function SavingsReceipt({ transaction: tx, onBack, onDelete }: { transaction: Transaction; onBack: () => void; onDelete: (id: number) => Promise<boolean> }) {
  const { fmt, t, monthNames } = useAppData();
  const insets = useSafeAreaInsets();
  const [confirm, setConfirm] = useState(false), lock = useRef(false);
  return <View className="flex-1 bg-white px-5 dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center justify-between py-3"><BackButton onPress={onBack} /><Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("savings.label")}</Text><View className="w-10" /></View>
    <View className="mt-6 rounded-2xl bg-violet-50 p-5 dark:bg-violet-950">
      <PiggyBank size={28} color="#8b5cf6" />
      <Text className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">{t(tx.type === "expense" ? "savings.toGoal" : "savings.fromGoal", { name: tx.internalTransferSpaceName || tx.description })}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit className="mt-2 text-3xl font-extrabold text-violet-700 dark:text-violet-300">{tx.type === "expense" ? "− " : "+ "}{fmt(tx.amount)}</Text>
      <Text className="mt-3 text-sm text-slate-500 dark:text-slate-300">{fmtDate(tx.date, monthNames)}{tx.time ? ` · ${tx.time}` : ""}</Text>
    </View>
    <Text className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-200">{t("savings.receipt")}</Text>
    <Text className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-300">{t("savings.retained")}</Text>
    <TouchableOpacity onPress={() => irUnaVez("/savings")} className="mt-5 items-center rounded-xl bg-emerald-600 p-3"><Text className="font-bold text-white">{t("savings.viewGoals")}</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => setConfirm(true)} accessibilityRole="button" className="mt-3 items-center rounded-xl bg-rose-50 p-3 dark:bg-rose-950"><Text className="font-bold text-rose-500 dark:text-rose-300">{t("history.removeRecord")}</Text></TouchableOpacity>
    <ConfirmDialog visible={confirm} title={t("history.removeTitle")} message={t("history.removeSavingsBody")} confirmLabel={t("history.removeRecord")} cancelLabel={t("common.cancel")}
      onCancel={() => { if (!lock.current) setConfirm(false); }} onConfirm={async () => { if (lock.current) return; lock.current = true; try { if (await onDelete(tx.id)) setConfirm(false); } finally { lock.current = false; } }} />
  </View>;
}

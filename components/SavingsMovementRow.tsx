import { Text, TouchableOpacity, View } from "react-native";
import { CheckCircle2, Circle, PiggyBank } from "lucide-react-native";
import IconBadge from "@/components/IconBadge";
import type { Transaction } from "@/types";

/** El mismo recibo violeta en Inicio e Historial; no un gasto o ingreso. */
export default function SavingsMovementRow({ transaction: tx, fmt, t, onPress, timeLabel, selectMode = false, selected = false }: {
  transaction: Transaction;
  fmt: (value: number) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
  onPress: () => void;
  timeLabel?: string;
  selectMode?: boolean;
  selected?: boolean;
}) {
  const used = Boolean(tx.goalFundingAllocations?.length);
  return <TouchableOpacity onPress={onPress} accessibilityRole="button"
    accessibilityState={{ selected }}
    className={`mb-2.5 flex-row items-center gap-3 rounded-2xl border-[1.5px] bg-white p-3 dark:bg-noche-2 ${selected ? "border-emerald-400" : "border-violet-200 dark:border-violet-900"}`}>
    {selectMode && (selected ? <CheckCircle2 size={22} color="#059669" /> : <Circle size={22} color="#cbd5e1" />)}
    <IconBadge Icon={PiggyBank} color="#7c3aed" />
    <View className="min-w-0 flex-1">
      <Text className="text-sm font-bold text-slate-900 dark:text-slate-100" numberOfLines={2}>
        {t(used ? "savings.usedFor" : tx.type === "expense" ? "savings.toGoal" : "savings.fromGoal", { name: tx.internalTransferSpaceName || tx.description })}
      </Text>
      <Text className="mt-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">{t(used ? "savings.usedLabel" : "savings.label")}{timeLabel || tx.time ? ` · ${timeLabel || tx.time}` : ""}</Text>
    </View>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className="max-w-[42%] text-sm font-extrabold text-violet-700 dark:text-violet-300">
      {tx.type === "expense" ? "− " : "+ "}{fmt(tx.amount)}
    </Text>
  </TouchableOpacity>;
}

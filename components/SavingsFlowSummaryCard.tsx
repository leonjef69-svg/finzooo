import { Text, View } from "react-native";
import type { Goal } from "@/types";
import type { GoalFundingSummary } from "@/utils/savingsSummary";

function AmountCell({ label, amount, color, align = "left", fmt }: {
  label: string; amount: number; color: string; align?: "left" | "right"; fmt: (value: number) => string;
}) {
  return <View className={`min-w-0 flex-1 ${align === "right" ? "items-end" : "items-start"}`}>
    <Text className="text-[10px] leading-[13px] text-slate-500 dark:text-slate-300" numberOfLines={1}>{label}</Text>
    <Text className="mt-0.5 text-xs font-extrabold" style={{ color }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{fmt(amount)}</Text>
  </View>;
}

export default function SavingsFlowSummaryCard({
  goal, summary, view, fmt, t, testID,
}: {
  goal: Goal;
  summary: GoalFundingSummary;
  view: "personal" | "savings";
  fmt: (value: number) => string;
  t: (key: string) => string;
  testID?: string;
}) {
  return <View testID={testID} className="mb-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-noche-borde dark:bg-noche-2">
    <Text className="text-sm font-bold text-slate-900 dark:text-slate-100" numberOfLines={1}>{goal.name}</Text>
    <View className="mt-2 flex-row items-center gap-3">
      <AmountCell label={t(view === "personal" ? "savings.sentToSavings" : "savings.receivedFromPersonal")}
        amount={summary.received} color="#7c3aed" fmt={fmt} />
      {view === "savings" && <AmountCell label={t("goalForm.targetLabel")} amount={goal.target} color="#475569" align="right" fmt={fmt} />}
    </View>
    <View className="mt-1.5 flex-row items-center gap-3">
      <AmountCell label={t("savings.returnedToPersonal")} amount={summary.returned} color="#059669" fmt={fmt} />
      {view === "savings" && <AmountCell label={t("savings.currentInGoal")} amount={goal.saved} color="#0f766e" align="right" fmt={fmt} />}
    </View>
  </View>;
}

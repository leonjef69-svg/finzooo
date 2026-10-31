import { useState } from "react";
import { Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import type { Goal } from "@/types";
import type { GoalFundingSummary } from "@/utils/savingsSummary";

function SavingsSummaryHeader({ name, returnedLabel, allowInline }: { name: string; returnedLabel?: string; allowInline: boolean }) {
  const [size, setSize] = useState({ width: 0, name: 0, label: 0, nameLines: 0, labelLines: 0 });
  const update = (values: Partial<typeof size>) => setSize(previous =>
    Object.entries(values).every(([key, value]) => previous[key as keyof typeof size] === value)
      ? previous : { ...previous, ...values });
  // Se usa el espacio medido: también responde al tamaño de letra y al idioma.
  const measure = allowInline && Boolean(returnedLabel);
  const inline = Boolean(measure && size.width && size.name && size.label
    && size.nameLines === 1 && size.labelLines === 1 && size.name + size.label + 12 <= size.width);
  return <View onLayout={measure ? event => update({ width: Math.floor(event.nativeEvent.layout.width) }) : undefined}>
    <View className={inline ? "flex-row items-center justify-between gap-3" : undefined}>
      <Text className={`${inline ? "min-w-0 flex-1 " : ""}text-sm font-bold text-slate-900 dark:text-slate-100`}
        numberOfLines={1}>{name}</Text>
      {returnedLabel && <Text className={`${inline ? "shrink-0 text-right" : "mt-0.5"} text-[10px] font-semibold text-emerald-700 dark:text-emerald-300`}
        numberOfLines={inline ? 1 : undefined}>{returnedLabel}</Text>}
    </View>
    {measure && <View className="absolute left-0 right-0 opacity-0" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Medir sin recortar: Android limita también las líneas del evento
          cuando el texto visible lleva numberOfLines. No ocupa espacio. */}
      <Text className="text-sm font-bold" onTextLayout={event => update({ name: Math.ceil(event.nativeEvent.lines[0]?.width ?? 0), nameLines: event.nativeEvent.lines.length })}>{name}</Text>
      <Text className="text-[10px] font-semibold" onTextLayout={event => update({ label: Math.ceil(event.nativeEvent.lines[0]?.width ?? 0), labelLines: event.nativeEvent.lines.length })}>{returnedLabel}</Text>
    </View>}
  </View>;
}

function AmountCell({ label, amount, color, align = "left", inline = false, fmt }: {
  label: string; amount: number; color: string; align?: "left" | "right"; inline?: boolean; fmt: (value: number) => string;
}) {
  const { colorScheme } = useColorScheme();
  const darkAmounts: Record<string, string> = { "#7c3aed": "#c4b5fd", "#475569": "#c6bfb3", "#059669": "#81c39a", "#0f766e": "#8ac9b8" };
  return <View className={inline ? "min-w-0 flex-1 flex-row items-center justify-between gap-3" : `min-w-0 flex-1 ${align === "right" ? "items-end" : "items-start"}`}>
    <Text className={`${inline ? "min-w-0 flex-1 " : ""}text-[10px] leading-[13px] text-slate-500 dark:text-slate-300`} numberOfLines={1}>{label}</Text>
    <Text className={`${inline ? "max-w-[50%] text-right" : "mt-0.5"} text-xs font-extrabold`} style={{ color: colorScheme === "dark" ? darkAmounts[color] ?? color : color }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{fmt(amount)}</Text>
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
  return <View testID={testID} className="py-3">
    <SavingsSummaryHeader key={`${goal.name}:${view}`} name={goal.name} allowInline={view === "personal"}
      returnedLabel={goal.saved === 0 && summary.received > 0 && summary.returned === summary.received ? t("savings.fullyReturned") : undefined} />
    <View className="mt-2 flex-row items-center gap-3">
      <AmountCell label={t(view === "personal" ? "savings.sentToSavings" : "savings.receivedFromPersonal")}
        amount={summary.received} color="#7c3aed" inline fmt={fmt} />
      {view === "savings" && <AmountCell label={t("goalForm.targetLabel")} amount={goal.target} color="#475569" align="right" fmt={fmt} />}
    </View>
    <View className="mt-1.5 flex-row items-center gap-3">
      <AmountCell label={t("savings.returnedToPersonal")} amount={summary.returned} color="#059669" inline fmt={fmt} />
      {view === "savings" && <AmountCell label={t("savings.currentInGoal")} amount={goal.saved} color="#0f766e" align="right" fmt={fmt} />}
    </View>
  </View>;
}

import { useState } from "react";
import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useAppData } from "@/contexts/AppDataContext";
import { PAYMENT_METHODS, methodLabel } from "@/constants/i18n";

export type MovementFilter = "ingreso" | "gasto" | null;

export function SpaceTotals({ income, expense, filter, onFilter, format }: {
  income: number; expense: number; filter: MovementFilter;
  onFilter: (value: MovementFilter) => void; format: (value: number) => string;
}) {
  const { t } = useAppData();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  const total = (type: "ingreso" | "gasto", amount: number) => <TouchableOpacity
    accessibilityRole="button" accessibilityState={{ selected: filter === type }}
    accessibilityHint={t("spaces.tapToFilter")}
    onPress={() => onFilter(filter === type ? null : type)}
    className={`min-h-12 justify-center rounded-xl px-2 py-1 ${stacked ? "" : "flex-1"} ${filter === type ? "bg-black/15" : ""}`}
  >
    <Text className="text-xs font-semibold text-white">{t(type === "ingreso" ? "history.totalIncome" : "spaces.totalExpense")} ›</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className="text-base font-bold text-white">{format(amount)}</Text>
  </TouchableOpacity>;
  return <View className="mt-2 border-t border-white/30 pt-1.5">
    <Text className="mb-0.5 text-center text-[10px] font-medium text-white/80">{t("spaces.tapToFilter")}</Text>
    <View className={stacked ? "items-stretch" : "flex-row items-stretch"}>
      {total("ingreso", income)}
      <View className={stacked ? "mx-2 h-px bg-white/40" : "my-1 w-px bg-white/40"} />
      {total("gasto", expense)}
    </View>
  </View>;
}

export function SpacePaymentMethod({ value, onChange, disabled = false }: {
  value: string; onChange: (method: string) => void; disabled?: boolean;
}) {
  const { t, userCountry } = useAppData();
  const [open, setOpen] = useState(false);
  const methods = PAYMENT_METHODS.filter(m => (m.id !== "plin" || userCountry === "PE") && (m.id !== "yape" || userCountry === "PE" || userCountry === "BO"));
  return <View className="mt-2">
    <Text className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{t("detail.method")}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} disabled={disabled} onPress={() => setOpen(!open)} className="min-h-12 justify-center rounded-xl border border-slate-200 px-3 dark:border-noche-borde">
      <Text className="text-base text-slate-900 dark:text-slate-100">{methodLabel(value, t)} ▾</Text>
    </TouchableOpacity>
    {open ? <View className="mt-1 flex-row flex-wrap gap-2">{methods.map(method => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: value === method.id }} key={method.id} disabled={disabled} onPress={() => { onChange(method.id); setOpen(false); }} className={`min-h-11 justify-center rounded-xl px-3 ${value === method.id ? "bg-emerald-100" : "bg-slate-100 dark:bg-noche-2"}`}><Text className={value === method.id ? "text-sm font-bold text-emerald-800" : "text-sm text-slate-700 dark:text-slate-200"}>{t(method.labelKey)}</Text></TouchableOpacity>)}</View> : null}
  </View>;
}

export function SpaceFilterReset({ filter, onReset }: { filter: MovementFilter; onReset: () => void }) {
  const { t } = useAppData();
  return filter ? <TouchableOpacity accessibilityRole="button" onPress={onReset} className="mb-2 min-h-11 justify-center"><Text className="text-sm font-bold text-teal-700 dark:text-teal-300">{t("spaces.showAll")}</Text></TouchableOpacity> : null;
}

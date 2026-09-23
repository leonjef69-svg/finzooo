import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useAppData } from "@/contexts/AppDataContext";
import { PAYMENT_METHODS } from "@/constants/i18n";

export type MovementFilter = "ingreso" | "gasto" | "transferencia" | null;

export function SpaceTotals({ income, expense, filter, onFilter, format }: {
  income: number; expense: number; filter: MovementFilter;
  onFilter: (value: MovementFilter) => void; format: (value: number) => string;
}) {
  const { t } = useAppData();
  const { width, fontScale } = useWindowDimensions();
  const hasIncome = income > 0;
  const hasExpense = expense > 0;
  const isLong = (amount: number) => Math.trunc(Math.abs(amount)).toString().length >= 8;
  // La cifra larga fuerza dos filas, pero también lo hace una pantalla estrecha
  // o letra ampliada: el contenido nunca debe competir por un mismo renglón.
  const vertical = hasIncome && hasExpense && (isLong(income) || isLong(expense) || width / fontScale < 330);
  const total = (type: "ingreso" | "gasto", amount: number) => <TouchableOpacity
    accessibilityRole="button" accessibilityState={{ selected: filter === type }}
    accessibilityHint={t("spaces.tapToFilter")}
    onPress={() => onFilter(filter === type ? null : type)}
    // `ring-*` se traduce a una sombra web. En Android, NativeWind puede
    // recalcular esa sombra recién al filtrar y dejar la vista sin montar.
    // Un borde nativo expresa el estado seleccionado sin ese riesgo.
    style={filter === type ? { borderWidth: 1, borderColor: "#64748b" } : undefined}
    className={`min-h-12 flex-1 justify-center rounded-xl px-2 py-1.5 ${type === "ingreso" ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-rose-50 dark:bg-rose-950/35"}`}
  >
    <Text numberOfLines={1} className={`text-[11px] font-semibold ${type === "ingreso" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{t(type === "ingreso" ? "history.totalIncome" : "spaces.totalExpense")} ›</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} className={`text-base font-extrabold ${type === "ingreso" ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"}`}>{format(amount)}</Text>
  </TouchableOpacity>;
  if (!hasIncome && !hasExpense) return null;
  return <View className="mt-2 border-t border-white/25 pt-1.5">
    <View className={vertical ? "gap-2" : "flex-row items-stretch"}>
      {hasIncome ? total("ingreso", income) : null}
      {hasIncome && hasExpense && !vertical ? <View className="my-1 w-2" /> : null}
      {hasExpense ? total("gasto", expense) : null}
    </View>
  </View>;
}

export function SpaceTransferFilter({ count, filter, onFilter }: {
  count: number;
  filter: MovementFilter;
  onFilter: (value: MovementFilter) => void;
}) {
  const { t } = useAppData();
  if (count <= 0) return null;
  const selected = filter === "transferencia";
  return <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={() => onFilter(selected ? null : "transferencia")}
    className={`mt-2 min-h-10 flex-row items-center justify-center rounded-xl border px-3 ${selected ? "border-blue-500 bg-blue-100 dark:bg-blue-950" : "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40"}`}
  >
    <Text className="text-xs font-extrabold text-blue-700 dark:text-blue-300">{t("transfer.filter")} · {count}</Text>
  </TouchableOpacity>;
}

export function SpacePaymentMethod({ value, onChange, disabled = false }: {
  value: string; onChange: (method: string) => void; disabled?: boolean;
}) {
  const { t, userCountry } = useAppData();
  const methods = PAYMENT_METHODS.filter(m => (m.id !== "plin" || userCountry === "PE") && (m.id !== "yape" || userCountry === "PE" || userCountry === "BO"));
  return <View className="mt-2">
    <Text className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{t("detail.method")}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
      {methods.map(method => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: value === method.id }} key={method.id} disabled={disabled} onPress={() => onChange(method.id)} className={`min-h-11 justify-center rounded-xl px-3 ${value === method.id ? "bg-emerald-100 dark:bg-emerald-950" : "bg-slate-100 dark:bg-noche-2"}`}><Text className={value === method.id ? "text-sm font-bold text-emerald-800 dark:text-emerald-200" : "text-sm text-slate-700 dark:text-slate-200"}>{t(method.labelKey)}</Text></TouchableOpacity>)}
    </ScrollView>
  </View>;
}

export function SpaceFilterReset({ filter, onReset }: { filter: MovementFilter; onReset: () => void }) {
  const { t } = useAppData();
  return filter ? <TouchableOpacity accessibilityRole="button" onPress={onReset} className="mb-2 min-h-11 justify-center"><Text className="text-sm font-bold text-teal-700 dark:text-teal-300">{t("spaces.showAll")}</Text></TouchableOpacity> : null;
}

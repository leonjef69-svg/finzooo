import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Modal from "@/components/PrivateModal";
import { CalendarDays, Check, ChevronDown, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import type { Month, Transaction } from "@/types";
import { useAppData } from "@/contexts/AppDataContext";
import { availablePersonalBalance, totalsForMonth } from "@/utils/finances";
import { compactPersonalTransferRows } from "@/utils/linkedTransfers";
import { presupuestoDelMes } from "@/utils/presupuestoMensual";
import { saldoAnteriorDe } from "@/utils/saldoAnterior";

type Props = {
  month: Month;
  months: string[];
  monthNames: string[];
  onChange: (month: Month) => void;
  showMovementCount?: boolean;
};

function monthFromKey(key: string): Month {
  const [y, m] = key.split("-").map(Number);
  return { y, m: m - 1 };
}

function labelFor(key: string, monthNames: string[]) {
  const { y, m } = monthFromKey(key);
  return `${monthNames[m]} ${y}`;
}

/**
 * Selector compartido por Inicio, Historial y Reportes. La lista se recibe ya
 * filtrada; muestra el saldo personal que corresponde a cada mes y permite cambiarlo.
 */
export default function MonthSelector({ month, months, monthNames, onChange, showMovementCount = false }: Props) {
  const [open, setOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const { t, fmtCompact, transactions, budgets, carryoverCleared } = useAppData();
  const currentKey = `${month.y}-${String(month.m + 1).padStart(2, "0")}`;
  const label = `${monthNames[month.m]} ${month.y}`;
  const dark = colorScheme === "dark";
  const monthBalances = useMemo(() => Object.fromEntries(months.map((key) => {
    const totals = totalsForMonth(transactions, key);
    const total = availablePersonalBalance({
      budget: presupuestoDelMes(budgets, key),
      prevBalance: saldoAnteriorDe(key, budgets, transactions, carryoverCleared),
      ...totals,
    });
    return [key, total];
  })), [months, transactions, budgets, carryoverCleared]);
  const monthMovementCounts = useMemo(() => {
    if (!showMovementCount) return {};
    const grouped: Record<string, Transaction[]> = Object.fromEntries(months.map((key) => [key, []]));
    for (const transaction of transactions) {
      const key = transaction.date.slice(0, 7);
      if (grouped[key]) grouped[key].push(transaction);
    }
    return Object.fromEntries(months.map((key) => [key, compactPersonalTransferRows(grouped[key]).length]));
  }, [months, showMovementCount, transactions]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Elegir mes, ${label}`}
        className="flex-row items-center gap-1.5 rounded-full border-[1.5px] border-slate-200 bg-slate-50 px-3 py-2 dark:border-noche-borde dark:bg-noche-2"
      >
        <CalendarDays size={14} color={dark ? "#cbd5e1" : "#475569"} />
        <Text className="max-w-[132px] text-xs font-bold text-slate-700 dark:text-slate-100" numberOfLines={1}>
          {label}
        </Text>
        <ChevronDown size={14} color={dark ? "#cbd5e1" : "#475569"} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/45">
          <View className="max-h-[72%] rounded-t-3xl bg-white px-5 pb-8 pt-4 dark:bg-noche-2">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{t("monthPicker.title")}</Text>
                <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{t("monthPicker.help")}</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-noche">
                <X size={18} color={dark ? "#cbd5e1" : "#475569"} />
              </TouchableOpacity>
            </View>

            {months.length === 0 ? (
              <Text className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">{t("monthPicker.empty")}</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="gap-2 pb-2">
                  {months.map((key) => {
                    const selected = key === currentKey;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => {
                          onChange(monthFromKey(key));
                          setOpen(false);
                        }}
                        className={`flex-row items-center gap-3 rounded-2xl border-[1.5px] px-4 py-2.5 ${
                          selected
                            ? "border-emerald-600 bg-emerald-600"
                            : "border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche"
                        }`}
                      >
                        <View className="min-w-0 flex-1">
                          <Text className={`text-sm font-bold ${selected ? "text-white" : "text-slate-800 dark:text-slate-100"}`} numberOfLines={1}>
                            {labelFor(key, monthNames)}
                          </Text>
                          {showMovementCount ? <Text className={`mt-0.5 text-[10px] font-medium ${selected ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`} numberOfLines={1}>
                            {monthMovementCounts[key] === 1
                              ? t("monthPicker.oneMovement")
                              : t("monthPicker.manyMovements", { count: monthMovementCounts[key] ?? 0 })}
                          </Text> : null}
                        </View>
                        <View className="items-end">
                          <Text className={`text-[9px] font-semibold ${selected ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
                            {t("monthPicker.balance")}
                          </Text>
                          <Text
                            className={`text-xs font-extrabold ${selected ? "text-white" : monthBalances[key] < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-300"}`}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
                            {fmtCompact(monthBalances[key] ?? 0)}
                          </Text>
                        </View>
                        {selected ? <Check size={17} color="#ffffff" strokeWidth={3} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

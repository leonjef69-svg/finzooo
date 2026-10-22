import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeftRight } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";
import { monthlyActivityTotals } from "@/utils/monthlyActivity";
import type { Month, Transaction } from "@/types";

type MonthTotals = { income: number; expense: number };

export default function MonthlyActivityComparison({
  transactions,
  month,
  width,
  preview = false,
}: {
  transactions: readonly Transaction[];
  month: Month;
  width: number;
  preview?: boolean;
}) {
  const { t, fmt, monthNames } = useAppData();
  const [selectedMonth, setSelectedMonth] = useState(month.m);
  const [comparisonMonth, setComparisonMonth] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  const [page, setPage] = useState(Math.floor(month.m / 6));
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setSelectedMonth(month.m);
    setComparisonMonth(null);
    setComparing(false);
    const nextPage = Math.floor(month.m / 6);
    setPage(nextPage);
    scrollRef.current?.scrollTo({ x: nextPage * width, animated: false });
  }, [month.y, month.m, width]);

  const totals = useMemo<MonthTotals[]>(() => {
    if (preview) {
      const income = [1850, 2600, 3150, 2850, 3400, 2900, 3600, 3100, 3850, 3350, 4200, 3900];
      const expense = [1250, 1430, 1600, 1510, 1880, 1700, 1800, 2050, 2350, 2100, 2200, 2480];
      return income.map((amount, index) => ({ income: amount, expense: expense[index] }));
    }
    return monthlyActivityTotals(transactions, month.y);
  }, [transactions, month.y, preview]);

  const maxAmount = Math.max(0, ...totals.flatMap((item) => [item.income, item.expense]));
  const money = (amount: number) => fmt(amount);
  const monthTitle = (index: number) => `${monthNames[index]} ${month.y}`;
  const pageWidth = Math.max(0, width);

  const selectMonth = (index: number) => {
    if (comparing) {
      if (index !== selectedMonth) setComparisonMonth(index);
      return;
    }
    setSelectedMonth(index);
  };

  const monthCell = (index: number) => {
    const values = totals[index];
    const selected = index === selectedMonth;
    const comparison = comparing && index === comparisonMonth;
    const inactive = values.income === 0 && values.expense === 0;
    const accessibilityLabel = `${monthTitle(index)}. ${t("reports.calendarIncome")}: ${money(values.income)}. ${t("reports.calendarExpense")}: ${money(values.expense)}.`;
    return (
      <Pressable
        key={index}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: selected || comparison }}
        accessibilityHint={comparing ? t("reports.tapMonthToCompare", { month: monthTitle(selectedMonth) }) : undefined}
        onPress={() => selectMonth(index)}
        className={`min-h-[60px] flex-1 rounded-xl px-1.5 py-1.5 ${
          selected ? "bg-emerald-50 dark:bg-emerald-950/50" : comparison ? "bg-rose-50 dark:bg-rose-950/40" : ""
        } ${inactive && !selected && !comparison ? "opacity-50" : ""}`}
        style={{ borderWidth: selected || comparison ? 1.5 : 0, borderColor: selected ? "#059669" : comparison ? "#e11d48" : "transparent" }}
      >
        <Text className="text-sm font-semibold text-slate-800 dark:text-slate-100">{monthNames[index].slice(0, 3)}</Text>
        <View className="mt-2 gap-1">
          <View className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <View className="h-full rounded-full bg-emerald-600" style={{ width: maxAmount > 0 && values.income > 0 ? `${Math.max(3, (values.income / maxAmount) * 100)}%` : 0 }} />
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <View className="h-full rounded-full bg-rose-500" style={{ width: maxAmount > 0 && values.expense > 0 ? `${Math.max(3, (values.expense / maxAmount) * 100)}%` : 0 }} />
          </View>
        </View>
      </Pressable>
    );
  };

  const metricRow = (label: string, amount: number, kind: "income" | "expense") => (
    <View key={kind} className="flex-row items-center justify-between gap-2 py-1">
      <Text className="text-[15px] text-slate-600 dark:text-slate-300">{label}</Text>
      <Text numberOfLines={2} className={`text-right text-[15px] font-bold ${kind === "income" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
        {money(amount)}
      </Text>
    </View>
  );

  const summary = (index: number, comparison = false) => (
    <View key={comparison ? `compare-${index}` : `selected-${index}`} className={comparison ? "border-t border-slate-200 pt-2.5 dark:border-noche-borde" : ""}>
      <Text className={`mb-1 text-[15px] font-bold ${comparison ? "text-rose-700 dark:text-rose-300" : "text-slate-800 dark:text-slate-100"}`}>
        {monthTitle(index)}
      </Text>
      {totals[index].income === 0 && totals[index].expense === 0 ? (
        <Text className="py-1 text-sm text-slate-500 dark:text-slate-400">{t("reports.noActivityThisMonth")}</Text>
      ) : (
        <>
          {metricRow(t("reports.calendarIncome"), totals[index].income, "income")}
          {metricRow(t("reports.calendarExpense"), totals[index].expense, "expense")}
        </>
      )}
    </View>
  );

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-[18px] font-extrabold text-slate-900 dark:text-slate-100">{t("reports.byMonth")}</Text>
        <Text className="text-[16px] font-bold text-slate-700 dark:text-slate-200">{month.y}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setPage(event.nativeEvent.contentOffset.x >= pageWidth / 2 ? 1 : 0)}
        accessibilityLabel={t("reports.byMonth")}
        contentContainerStyle={{ width: pageWidth * 2 }}
      >
        {[0, 1].map((pageIndex) => (
          <View key={pageIndex} style={{ width: pageWidth }} className="gap-1">
            {[0, 1].map((rowIndex) => (
              <View key={rowIndex} className="flex-row gap-0.5">
                {[0, 1, 2].map((columnIndex) => monthCell(pageIndex * 6 + rowIndex * 3 + columnIndex))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View className="mt-1 flex-row justify-center gap-4">
        <View className="flex-row items-center gap-1.5"><View className="h-2 w-2 rounded-full bg-emerald-600" /><Text className="text-xs text-slate-500 dark:text-slate-400">{t("reports.calendarIncome")}</Text></View>
        <View className="flex-row items-center gap-1.5"><View className="h-2 w-2 rounded-full bg-rose-500" /><Text className="text-xs text-slate-500 dark:text-slate-400">{t("reports.calendarExpense")}</Text></View>
      </View>

      <View className="mt-1.5 flex-row items-center justify-center gap-1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1].map((pageIndex) => (
          <View
            key={pageIndex}
            className={`h-1.5 rounded-full ${page === pageIndex ? "w-4 bg-emerald-600" : "w-1.5 bg-slate-300 dark:bg-slate-600"}`}
          />
        ))}
      </View>

      <View className="mt-2 border-t border-slate-300 pt-2.5 dark:border-slate-600">
        {comparing ? (
          comparisonMonth === null ? (
            <Text className="py-1 text-sm text-slate-600 dark:text-slate-300">
              {t("reports.tapMonthToCompare", { month: monthTitle(selectedMonth) })}
            </Text>
          ) : (
            <View className="gap-2">
              {summary(selectedMonth)}
              {summary(comparisonMonth, true)}
            </View>
          )
        ) : summary(selectedMonth)}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: comparing }}
        onPress={() => {
          if (comparing) setComparisonMonth(null);
          setComparing((current) => !current);
        }}
        className="-mx-0.5 mt-2 min-h-[50px] flex-row items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600"
      >
        <ArrowLeftRight size={16} color="#047857" />
        <Text className="text-[17px] font-semibold text-emerald-800 dark:text-emerald-300">
          {t(comparing ? "reports.finishCompare" : "reports.compareMonths")}
        </Text>
      </Pressable>
    </View>
  );
}

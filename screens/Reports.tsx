import { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Sparkles } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import DonutChart from "@/components/DonutChart";
import BarChartSimple from "@/components/BarChartSimple";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import { catInfo } from "@/constants/categories";
import { COLOR_HEX_600 } from "@/constants/colors";
import { CARD_SHADOW } from "@/constants/style";
import { monthKey } from "@/utils/format";
import { useAppData } from "@/contexts/AppDataContext";
import type { Month, Transaction } from "@/types";

export default function Reports({
  transactions,
  month,
  onSeePremium,
}: {
  transactions: Transaction[];
  month: Month;
  onSeePremium: () => void;
}) {
  const { fmt, t, monthNames, userLanguage, categoryBudgets, categorySpent, budget, isPremium } =
    useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const primaryTextColor = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";
  const mk = monthKey(month.y, month.m);

  const budgetProgress = useMemo(() => {
    return Object.entries(categoryBudgets)
      .filter(([, limit]) => limit > 0)
      .map(([id, limit]) => {
        const spent = categorySpent[id] || 0;
        const c = catInfo(id);
        return { id, limit, spent, pct: limit > 0 ? spent / limit : 0, name: t(c.label) };
      })
      .sort((a, b) => b.pct - a.pct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryBudgets, categorySpent, userLanguage]);

  const { pieData, totalExpense } = useMemo(() => {
    const expenses = transactions.filter((t) => t.date.startsWith(mk) && t.type === "expense");
    const byCat: Record<string, number> = {};
    expenses.forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    });
    const pie = Object.entries(byCat).map(([id, value]) => {
      const c = catInfo(id);
      return { name: t(c.label), value, color: COLOR_HEX_600[c.color] || "#64748b" };
    });
    const total = expenses.reduce((s, t) => s + t.amount, 0);
    return { pieData: pie, totalExpense: total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, mk, userLanguage]);

  const insights = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    const isCurrentMonth = month.y === now.getFullYear() && month.m === now.getMonth();
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const day0 = new Date(now);
    const day7Ago = new Date(day0);
    day7Ago.setDate(day0.getDate() - 7);
    const day8Ago = new Date(day7Ago);
    day8Ago.setDate(day7Ago.getDate() - 1);
    const day14Ago = new Date(day0);
    day14Ago.setDate(day0.getDate() - 14);

    function sumByCategory(fromISO: string, toISO: string) {
      const result: Record<string, number> = {};
      transactions
        .filter((tx) => tx.type === "expense" && tx.date >= fromISO && tx.date <= toISO)
        .forEach((tx) => {
          result[tx.category] = (result[tx.category] || 0) + tx.amount;
        });
      return result;
    }

    const thisWeek = sumByCategory(iso(day7Ago), iso(day0));
    const lastWeek = sumByCategory(iso(day14Ago), iso(day8Ago));

    let bestCat: { id: string; pct: number } | null = null;
    for (const [catId, amt] of Object.entries(thisWeek)) {
      const prev = lastWeek[catId] || 0;
      if (prev >= 10) {
        const pct = Math.round(((amt - prev) / prev) * 100);
        if (pct >= 20 && (!bestCat || pct > bestCat.pct)) bestCat = { id: catId, pct };
      }
    }
    if (bestCat) {
      const c = catInfo(bestCat.id);
      list.push(t("insights.categoryUp", { category: t(c.label), pct: bestCat.pct }));
    }

    if (isCurrentMonth && budget > 0) {
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
      if (dayOfMonth >= 3) {
        const projected = (totalExpense / dayOfMonth) * daysInMonth;
        if (projected > budget * 1.05) {
          list.push(t("insights.projection", { amount: fmt(projected - budget) }));
        }
      }
    }

    const topCat = Object.entries(categorySpent).sort((a, b) => b[1] - a[1])[0];
    if (topCat && topCat[1] > 0) {
      const suggestion = topCat[1] * 0.2;
      if (suggestion >= 10) {
        const c = catInfo(topCat[0]);
        list.push(t("insights.savingsTip", { amount: fmt(suggestion), category: t(c.label) }));
      }
    }

    return list.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, month, budget, categorySpent, totalExpense, userLanguage]);

  // Los 3 meses que terminan en el mes que se está viendo.
  //
  // Bug corregido: antes esto era `[4, 5, 6]` fijo en el código, o sea
  // Mayo/Junio/Julio SIEMPRE, sin importar en qué mes estuvieras parado ni
  // en qué mes del año real fuera. En agosto seguía mostrando Mayo-Julio, y
  // al cambiar de mes con las flechas de Inicio el gráfico no se movía.
  // También cruza bien el cambio de año (ej. viendo Enero muestra
  // Nov, Dic del año anterior + Ene).
  // Solo se muestran los meses en los que de verdad hubo gastos. Un mes en
  // cero no aporta nada al gráfico: solo ocupa espacio y hace que las barras
  // de los meses con datos se vean más chicas de lo que son.
  const barData = useMemo(() => {
    return [2, 1, 0]
      .map((back) => {
        let m = month.m - back;
        let y = month.y;
        if (m < 0) {
          m += 12;
          y -= 1;
        }
        const key = monthKey(y, m);
        const sp = transactions
          .filter((t) => t.type === "expense" && t.date.startsWith(key))
          .reduce((s, t) => s + t.amount, 0);
        return { label: monthNames[m].slice(0, 3), value: sp };
      })
      .filter((b) => b.value > 0);
  }, [transactions, month.y, month.m, monthNames]);

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-slate-900"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 112 }}
    >
      <View className="px-5 pt-3 pb-1 flex-row items-start justify-between">
        <View>
          <Text className="text-xl font-extrabold" style={{ color: primaryTextColor }}>{t("reports.title")}</Text>
          <Text className="text-xs text-slate-500 dark:text-slate-300">
            {monthNames[month.m]} {month.y}
          </Text>
        </View>
        <ThemeToggleButton />
      </View>

      {isPremium ? (
        insights.length > 0 && (
          <LinearGradient
            colors={["#0f172a", "#064e3b"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="mx-5 mt-4 rounded-3xl p-4"
          >
            <View className="flex-row items-center gap-2 mb-3">
              <Sparkles size={16} color="#fcd34d" />
              <Text className="text-white font-extrabold text-sm">Finzo IA</Text>
            </View>
            <View className="gap-2.5">
              {insights.map((msg, i) => (
                <Text key={i} className="text-emerald-50 text-xs leading-relaxed">
                  • {msg}
                </Text>
              ))}
            </View>
          </LinearGradient>
        )
      ) : (
        <TouchableOpacity
          onPress={onSeePremium}
          className="mx-5 mt-4 flex-row items-center gap-3 bg-slate-900 rounded-3xl p-4"
        >
          <View className="w-10 h-10 rounded-xl bg-amber-400/20 items-center justify-center">
            <Sparkles size={18} color="#fcd34d" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-sm">Finzo IA</Text>
            <Text className="text-slate-300 text-[11px]">{t("insights.lockedDescription")}</Text>
          </View>
          <Crown size={16} color="#fcd34d" />
        </TouchableOpacity>
      )}

      <View
        className="mx-5 mt-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4"
        style={CARD_SHADOW}
      >
        <Text className="text-sm font-bold mb-1" style={{ color: primaryTextColor }}>{t("reports.byCategory")}</Text>
        {pieData.length === 0 ? (
          <Text className="text-center text-slate-500 dark:text-slate-300 text-sm py-10">{t("reports.noDataThisMonth")}</Text>
        ) : (
          <>
            <View className="items-center py-2">
              <DonutChart data={pieData} fmt={fmt} />
            </View>
            <View className="gap-2 mt-2">
              {pieData.map((e, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                  <Text
                    className="text-xs font-medium flex-1"
                    style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#475569" }}
                  >
                    {e.name}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-300">
                    {fmt(e.value)} · {totalExpense ? Math.round((e.value / totalExpense) * 100) : 0}%
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View
        className="mx-5 mt-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4"
        style={CARD_SHADOW}
      >
        <Text className="text-sm font-bold mb-1" style={{ color: primaryTextColor }}>{t("categoryBudgets.title")}</Text>
        {budgetProgress.length === 0 ? (
          <Text className="text-center text-slate-500 dark:text-slate-300 text-sm py-6">{t("categoryBudgets.noneSet")}</Text>
        ) : (
          <View className="gap-3 mt-2">
            {budgetProgress.map((b) => {
              const over = b.pct >= 1;
              const barColor = over ? "#f43f5e" : b.pct >= 0.7 ? "#f59e0b" : "#10b981";
              return (
                <View key={b.id}>
                  <View className="flex-row items-center justify-between mb-1">
                    <Text
                      className="text-xs font-bold flex-1 mr-2"
                      style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#334155" }}
                      numberOfLines={1}
                    >
                      {b.name}
                    </Text>
                    <Text className={`text-xs font-bold ${over ? "text-rose-500" : "text-slate-500 dark:text-slate-300"}`}>
                      {t("categoryBudgets.spentOfLimit", { spent: fmt(b.spent), limit: fmt(b.limit) })}
                    </Text>
                  </View>
                  <View className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <View
                      className="h-2 rounded-full"
                      style={{ width: `${Math.min(b.pct, 1) * 100}%`, backgroundColor: barColor }}
                    />
                  </View>
                  {over ? (
                    <Text className="text-[11px] text-rose-500 font-medium mt-1">
                      {t("categoryBudgets.overBudget")}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View
        className="mx-5 mt-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4"
        style={CARD_SHADOW}
      >
        <Text className="text-sm font-bold mb-2" style={{ color: primaryTextColor }}>{t("reports.byMonth")}</Text>
        {barData.length === 0 ? (
          <Text className="text-center text-slate-500 dark:text-slate-300 text-sm py-10">
            {t("reports.noMonthsWithSpending")}
          </Text>
        ) : (
          <BarChartSimple data={barData} fmt={fmt} />
        )}
      </View>
    </ScrollView>
  );
}

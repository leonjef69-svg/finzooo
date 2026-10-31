import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import IconBadge from "@/components/IconBadge";
import DonutChart from "@/components/DonutChart";
import DailyActivityCalendar from "@/components/DailyActivityCalendar";
import MonthlyActivityComparison from "@/components/MonthlyActivityComparison";
import MonthSelector from "@/components/MonthSelector";
import { catInfo } from "@/constants/categories";
import { COLOR_HEX_600 } from "@/constants/colors";
import { CARD_SHADOW } from "@/constants/style";
import { fmtExact, monthKey } from "@/utils/format";
import { currencySymbolFor } from "@/constants/currencies";
import { dailyCalendarTotals } from "@/utils/reportCalendar";
import { useAppData } from "@/contexts/AppDataContext";
import type { Month, Transaction } from "@/types";

export default function Reports({
  transactions,
  month,
  setMonth,
}: {
  transactions: Transaction[];
  month: Month;
  setMonth: (month: Month) => void;
}) {
  const {
    fmt,
    t,
    monthNames,
    userLanguage,
    userCurrency,
    categoryBudgets,
    categorySpent,
    categoryOverrides,
    categoriasPropias,
  } = useAppData();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const primaryTextColor = colorScheme === "dark" ? "#f4f0e8" : "#0f172a";
  const mk = monthKey(month.y, month.m);

  /**
   * Los límites por categoría en los que SÍ se gastó este mes, más una respuesta:
   * ¿hay algún límite puesto?
   *
   * POR QUÉ SOLO LOS QUE TIENEN GASTO
   *
   * Con un límite en cada categoría son trece filas y doce dicen lo mismo:
   * "S/ 0.00 de S/ 50.00". La única que importa —la que se pasó— queda enterrada
   * entre doce que no dicen nada, y todo lo de abajo se empuja fuera de la
   * pantalla.
   *
   * Las intactas estuvieron resumidas en una línea al final de la tarjeta, y el
   * usuario la mandó quitar el 07/08/2026. Ver la nota donde estaba.
   *
   * Y "hayLimites" sale de aquí, del mismo cálculo, para que el texto de la
   * tarjeta no pueda volver a contradecirse: la pregunta "¿puse límites?" y la
   * pregunta "¿en cuáles gasté?" se contestan con la misma lista.
   */
  const { budgetProgress, hayLimites } = useMemo(() => {
    const todos = Object.entries(categoryBudgets)
      .filter(([, limit]) => limit > 0)
      .map(([id, limit]) => {
        const spent = categorySpent[id] || 0;
        const c = catInfo(id);
        return {
          id,
          limit,
          spent,
          pct: limit > 0 ? spent / limit : 0,
          name: t(c.label),
          icon: c.icon,
          color: c.color,
          image: c.image,
        };
      })
      .sort((a, b) => b.pct - a.pct);

    return {
      budgetProgress: todos.filter((b) => b.spent > 0),
      hayLimites: todos.length > 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryBudgets, categorySpent, userLanguage, categoryOverrides, categoriasPropias]);

  const availableMonths = useMemo(
    () => Array.from(new Set(transactions.filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date)).map((t) => t.date.slice(0, 7)))).sort().reverse(),
    [transactions],
  );

  const { pieData } = useMemo(() => {
    const typedTransactions = transactions.filter(
      (transaction) => transaction.date.startsWith(mk) && transaction.type === categoryType && !transaction.internalTransfer,
    );
    const byCat: Record<string, number> = {};
    typedTransactions.forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    });
    const pie = Object.entries(byCat)
      .map(([id, value]) => {
        const c = catInfo(id);
        return { id, name: t(c.label), value, color: COLOR_HEX_600[c.color] || "#64748b", Icon: c.icon };
      })
      .sort((a, b) => b.value - a.value);
    return { pieData: pie };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, mk, userLanguage, categoryType, categoryOverrides, categoriasPropias]);

  // Totales diarios del calendario. Solo presentación: no se guardan ni alteran movimientos.
  const dailyCalendar = useMemo(
    () => dailyCalendarTotals(transactions, { y: month.y, m: month.m }),
    [transactions, month.y, month.m],
  );

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-noche"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 112 }}
    >
      <View className="px-5 pt-3 pb-1 flex-row items-start justify-between gap-3">
        <View>
          <Text className="text-xl font-extrabold" style={{ color: primaryTextColor }}>{t("reports.title")}</Text>
        </View>
        <MonthSelector month={month} months={availableMonths} monthNames={monthNames} onChange={setMonth} showMovementCount />
      </View>

      {/* En Reportes no repetimos el saldo ni las cuatro cifras de Inicio.
          Aquí empieza directamente el análisis del mes. */}
      <View
        className="mx-5 mt-3 bg-white dark:bg-noche-2 rounded-3xl border-[1.5px] border-slate-200 dark:border-noche-borde p-4"
        style={CARD_SHADOW}
      >
        <View className="mb-1 flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-sm font-bold" style={{ color: primaryTextColor }}>
            {t(categoryType === "expense" ? "reports.byCategory" : "reports.incomeByCategory")}
          </Text>
          <View className="flex-row rounded-xl bg-slate-100 p-1 dark:bg-noche-3">
            <TouchableOpacity
              onPress={() => setCategoryType("income")}
              accessibilityRole="button"
              accessibilityLabel={t("reports.showIncome")}
              className={`h-8 w-9 items-center justify-center rounded-lg ${categoryType === "income" ? "bg-emerald-600" : ""}`}
            >
              <TrendingUp size={16} color={categoryType === "income" ? "#fff" : "#059669"} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCategoryType("expense")}
              accessibilityRole="button"
              accessibilityLabel={t("reports.showExpenses")}
              className={`h-8 w-9 items-center justify-center rounded-lg ${categoryType === "expense" ? "bg-rose-500" : ""}`}
            >
              <TrendingDown size={16} color={categoryType === "expense" ? "#fff" : "#e11d48"} />
            </TouchableOpacity>
          </View>
        </View>
        {pieData.length === 0 ? (
          <Text className="text-center text-slate-500 dark:text-slate-300 text-sm py-10">{t("reports.noDataThisMonth")}</Text>
        ) : (
          <View className="items-center py-2">
            <DonutChart key={`${categoryType}-${mk}`} data={pieData} formatValue={value => fmtExact(value, currencySymbolFor(userCurrency), userCurrency)}
              totalLabel={t(categoryType === "expense" ? "reports.totalSpent" : "reports.totalIncome")}
              width={Math.max(180, Math.min(380, windowWidth - 76))} />
          </View>
        )}
      </View>

      <View
        className="mx-5 mt-4 bg-white dark:bg-noche-2 rounded-3xl border-[1.5px] border-slate-200 dark:border-noche-borde p-4"
        style={CARD_SHADOW}
      >
        <Text testID="report-category-budgets-title" className="text-[15px] font-bold mb-1" style={{ color: primaryTextColor }}>{t("categoryBudgets.title")}</Text>
        {budgetProgress.length === 0 ? (
          /* LA TARJETA SE CONTRADECÍA, y es lo que reportó el usuario el
             07/08/2026 con una captura: arriba decía "aún no le pusiste límite a
             ninguna categoría" y justo debajo "13 categorías sin gastos este mes ·
             € 650.00 sin usar". Las dos cosas a la vez, y las dos imposibles.
             El motivo: este texto se decidía con las categorías que TIENEN GASTO,
             no con las que tienen límite. Con trece límites puestos y ningún gasto
             en ellos, "no pusiste ninguno" era falso.
             Es otra vez el mismo fallo de este proyecto —dos textos decidiendo por
             su cuenta— así que ahora hay una sola pregunta: ¿hay límites o no? */
          <Text className="text-center text-slate-500 dark:text-slate-300 text-sm py-6">
            {t(hayLimites ? "categoryBudgets.noneSpentYet" : "categoryBudgets.noneSet")}
          </Text>
        ) : (
          <View className="gap-3 mt-2">
            {budgetProgress.map((b, index) => {
              const over = b.spent > b.limit;
              const atLimit = b.spent === b.limit;
              const barColor = COLOR_HEX_600[b.color] || "#10b981";
              const percentText = b.pct * 100 > 999
                ? t("categoryBudgets.usedPercentMoreThan999")
                : t("categoryBudgets.usedPercent", { percent: String(Math.round(b.pct * 100)) });
              return (
                <View
                  key={b.id}
                  testID={`report-category-budget-${b.id}`}
                  className="flex-row items-center gap-2.5"
                  style={index < budgetProgress.length - 1 ? {
                    borderBottomColor: colorScheme === "dark" ? "#64748b" : "#94a3b8",
                    borderBottomWidth: 1.5,
                    paddingBottom: 10,
                  } : undefined}
                >
                  <IconBadge Icon={b.icon} color={b.color} size={38} image={b.image} />
                  <View className="flex-1 min-w-0 gap-1">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text
                        testID={`report-category-budget-name-${b.id}`}
                        className="text-[13px] font-bold flex-1 min-w-0 mr-1"
                        style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#334155" }}
                        numberOfLines={1}
                      >
                        {b.name}
                      </Text>
                      <Text
                        testID={`report-category-budget-spent-${b.id}`}
                        className={`shrink-0 max-w-[168px] text-right text-xs font-bold ${over ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100"}`}
                        numberOfLines={2}
                      >
                        {fmt(b.spent)}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text
                        testID={`report-category-budget-limit-${b.id}`}
                        className="min-w-0 flex-1 text-[13px] text-slate-500 dark:text-slate-300"
                        numberOfLines={1}
                      >
                        {t("categoryBudgets.limit")} {fmt(b.limit)}
                      </Text>
                      <Text
                        testID={`report-category-budget-percent-${b.id}`}
                        className={`shrink-0 max-w-[112px] text-right text-[11px] font-bold ${over ? "text-rose-600 dark:text-rose-400" : atLimit ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}
                        numberOfLines={2}
                      >
                        {percentText}
                      </Text>
                    </View>
                    <View
                      testID={`report-category-budget-progress-${b.id}`}
                      accessibilityLabel={percentText}
                      className="h-1.5 rounded-full bg-slate-100 dark:bg-noche-2 overflow-hidden mt-0.5"
                    >
                      <View
                        testID={`report-category-budget-progress-fill-${b.id}`}
                        className="h-1.5 rounded-full"
                        style={{ width: `${Math.max(0, Math.min(b.pct, 1)) * 100}%`, backgroundColor: barColor }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* AQUÍ HABÍA UN RESUMEN DE LAS CATEGORÍAS SIN GASTO
            ("13 categorías sin gastos este mes · € 650.00 sin usar · Ver", con la
            lista desplegable). Se quitó a pedido del usuario el 07/08/2026:
            *"no sé por qué me sale eso, quítalo, no me gusta"*.

            Se defendía con que "no gastar en algo también es información". Y es
            verdad, pero el sitio estaba mal: esta tarjeta contesta "¿cómo voy con
            mis límites?", y una lista de las que ni he tocado no contesta eso —
            además de que ese "€ 650.00 sin usar" se leía como dinero disponible,
            justo al lado de un texto que decía que no había ningún límite puesto.
            Quien quiera ver sus límites los tiene todos en su propia pantalla,
            "Presupuestos por categoría" (app/category-budgets).

            No volver a meterlo aquí sin un motivo nuevo. */}
      </View>

      <View
        className="mx-5 mt-4 bg-white dark:bg-noche-2 rounded-3xl border-[1.5px] border-slate-200 dark:border-noche-borde p-4"
        style={CARD_SHADOW}
      >
        <DailyActivityCalendar data={dailyCalendar} month={month} onMonthChange={setMonth} />
      </View>

      <View
        className="mx-5 mt-4 bg-white dark:bg-noche-2 rounded-3xl border-[1.5px] border-slate-200 dark:border-noche-borde p-4"
        style={CARD_SHADOW}
      >
        <MonthlyActivityComparison
          transactions={transactions}
          month={month}
          width={windowWidth - 72}
        />
      </View>
    </ScrollView>
  );
}

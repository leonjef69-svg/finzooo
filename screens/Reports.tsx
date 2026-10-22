import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { TrendingDown, TrendingUp } from "lucide-react-native";
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
  } = useAppData();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  // Vista puramente visual para comprobar las gráficas llenas. No crea
  // movimientos, no cambia saldos y desaparece de las versiones publicadas.
  const [chartPreview, setChartPreview] = useState(false);
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const primaryTextColor = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";
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
        return { id, limit, spent, pct: limit > 0 ? spent / limit : 0, name: t(c.label) };
      })
      .sort((a, b) => b.pct - a.pct);

    return {
      budgetProgress: todos.filter((b) => b.spent > 0),
      hayLimites: todos.length > 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryBudgets, categorySpent, userLanguage]);

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
  }, [transactions, mk, userLanguage, categoryType]);

  // Totales diarios del calendario. Solo presentación: no se guardan ni alteran movimientos.
  const dailyCalendar = useMemo(
    () => dailyCalendarTotals(transactions, { y: month.y, m: month.m }),
    [transactions, month.y, month.m],
  );

  const previewDaily = useMemo(() => {
    const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      // Patrón irregular y solo de prueba para revisar intensidades y cifras grandes.
      const expense = ((day * 37) % 17 + 1) * 620_000_000 + (day % 6) * 95_000_000;
      return { day, income: day % 3 === 0 ? expense * 1.4 : 0, expense };
    });
  }, [month.y, month.m]);

  const shownDaily = chartPreview ? previewDaily : dailyCalendar;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-noche"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 112 }}
    >
      <View className="px-5 pt-3 pb-1 flex-row items-start justify-between gap-3">
        <View>
          <Text className="text-xl font-extrabold" style={{ color: primaryTextColor }}>{t("reports.title")}</Text>
        </View>
        <MonthSelector month={month} months={availableMonths} monthNames={monthNames} onChange={setMonth} />
      </View>

      {__DEV__ && (
        <TouchableOpacity
          onPress={() => setChartPreview((value) => !value)}
          className={`mx-5 mt-3 self-start rounded-full border px-3 py-2 ${
            chartPreview
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
              : "border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche-2"
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              chartPreview ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-200"
            }`}
          >
            {chartPreview ? t("reports.chartPreviewOff") : t("reports.chartPreviewOn")}
          </Text>
        </TouchableOpacity>
      )}

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
          <View className="flex-row rounded-xl bg-slate-100 p-1 dark:bg-noche">
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
        <Text className="text-sm font-bold mb-1" style={{ color: primaryTextColor }}>{t("categoryBudgets.title")}</Text>
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
                  <View className="h-2 rounded-full bg-slate-100 dark:bg-noche-2 overflow-hidden">
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
        <DailyActivityCalendar data={shownDaily} month={month} onMonthChange={setMonth} />
      </View>

      <View
        className="mx-5 mt-4 bg-white dark:bg-noche-2 rounded-3xl border-[1.5px] border-slate-200 dark:border-noche-borde p-4"
        style={CARD_SHADOW}
      >
        <MonthlyActivityComparison
          transactions={transactions}
          month={month}
          width={windowWidth - 72}
          preview={chartPreview}
        />
      </View>
    </ScrollView>
  );
}

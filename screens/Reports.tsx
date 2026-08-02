import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Crown,
  PieChart as PieChartIcon,
  Sparkles,
  Wallet,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import DonutChart from "@/components/DonutChart";
import BarChartSimple from "@/components/BarChartSimple";
import DailyBarsChart from "@/components/DailyBarsChart";
import AnimatedBar from "@/components/AnimatedBar";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import { catInfo } from "@/constants/categories";
import { COLOR_HEX_600 } from "@/constants/colors";
import { CARD_SHADOW } from "@/constants/style";
import { monthKey } from "@/utils/format";
import {
  availableBalance,
  budgetLeft,
  budgetUsed,
  health,
} from "@/utils/finances";
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
  const {
    fmt,
    t,
    monthNames,
    userLanguage,
    categoryBudgets,
    categorySpent,
    budget,
    spent,
    income,
    prevBalance,
    isPremium,
  } = useAppData();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const primaryTextColor = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";
  // Si se despliegan las categorias sin gasto. Cerrado de entrada: la lista
  // larga era justo el problema.
  const [verSinGasto, setVerSinGasto] = useState(false);

  const mk = monthKey(month.y, month.m);

  /**
   * Los límites por categoría, separados en dos: los que se están usando y
   * los que siguen intactos.
   *
   * POR QUÉ SEPARARLOS
   *
   * Se pintaban todos seguidos. Con un límite puesto en cada categoría, eso
   * son trece filas y doce dicen lo mismo: "S/ 0.00 de S/ 50.00". La única
   * que importa —la que se pasó del límite— queda enterrada entre doce que no
   * dicen nada, y todo lo que va debajo se empuja fuera de la pantalla.
   *
   * Las intactas NO se esconden: no gastar en algo también es información, y
   * saber cuánto queda sin tocar es la mitad de un presupuesto. Pero van
   * resumidas en una línea en vez de en doce.
   */
  const { budgetProgress, sinGasto, sinGastoTotal } = useMemo(() => {
    const todos = Object.entries(categoryBudgets)
      .filter(([, limit]) => limit > 0)
      .map(([id, limit]) => {
        const spent = categorySpent[id] || 0;
        const c = catInfo(id);
        return { id, limit, spent, pct: limit > 0 ? spent / limit : 0, name: t(c.label) };
      })
      .sort((a, b) => b.pct - a.pct);

    const usados = todos.filter((b) => b.spent > 0);
    const intactos = todos.filter((b) => b.spent === 0);
    return {
      budgetProgress: usados,
      sinGasto: intactos,
      sinGastoTotal: intactos.reduce((s, b) => s + b.limit, 0),
    };
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

  // Gasto de cada día del mes que se está viendo.
  //
  // Solo los días en que se gastó, en orden, igual que el gráfico de meses
  // solo enseña los meses con gasto. Dibujar los 31 días del calendario
  // dejaba cada columna en 9px, y ahí no cabe ni el número del día ni el
  // monto: los números acababan debajo de la barra equivocada y los montos
  // se pisaban o no se escribían.
  const daily = useMemo(() => {
    const porDia = new Map<number, number>();
    for (const tx of transactions) {
      if (tx.type !== "expense" || !tx.date.startsWith(mk)) continue;
      const d = Number(tx.date.slice(8, 10));
      porDia.set(d, (porDia.get(d) ?? 0) + tx.amount);
    }
    const bars = [...porDia.entries()]
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => a.day - b.day);

    // Solo se resalta "hoy" si se está mirando el mes actual. En un mes
    // pasado, resaltar el día 29 no querría decir nada.
    const now = new Date();
    const isCurrentMonth = month.y === now.getFullYear() && month.m === now.getMonth();

    return { bars, today: isCurrentMonth ? now.getDate() : 0 };
  }, [transactions, mk, month.y, month.m]);

  // EL RESUMEN DE ARRIBA.
  //
  // Todo lo de aquí sale de los movimientos y los presupuestos que ya están
  // guardados. No hay ni un número de ejemplo, ni una estimación, ni un
  // relleno para cuando faltan datos: si algo no se puede calcular, no se
  // enseña. Por eso el porcentaje contra el mes pasado puede no aparecer, y
  // por eso sin presupuesto no se dice si la salud es buena.
  //
  // Las cuentas están en utils/finances.ts, que es el mismo sitio del que
  // bebe Inicio. El "Disponible" de esta pantalla y el de Inicio no pueden
  // salir distintos porque son literalmente la misma función.
  const resumen = useMemo(() => {
    const cifras = { budget, spent, income, prevBalance };
    return {
      disponible: availableBalance(cifras),
      usado: budgetUsed(cifras),
      restante: budgetLeft(cifras),
      salud: health(cifras),
    };
  }, [budget, spent, income, prevBalance]);

  const SALUD_TEXTO: Record<string, string> = {
    good: t("reports.healthGood"),
    tight: t("reports.healthTight"),
    over: t("reports.healthOver"),
    unknown: t("reports.healthUnknown"),
  };
  const SALUD_COLOR: Record<string, string> = {
    good: "#34d399",
    tight: "#fbbf24",
    over: "#fb7185",
    unknown: "#94a3b8",
  };

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

      {/* PANORAMA DEL MES (Premium).
          Cada cifra de aquí sale de utils/finances.ts, con los movimientos y
          presupuestos guardados. Nada es de ejemplo. */}
      {isPremium && (
        <>
          <LinearGradient
            colors={["#065f46", "#047857"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            // Esta se quedó sin contorno cuando las cuatro tarjetas de debajo
            // sí lo llevan. Mismo grosor que el resto y el mismo blanco al
            // 45% que la tarjeta del saldo en Inicio, que es la hermana de
            // esta: las dos van sobre verde.
            className="mx-5 mt-4 rounded-3xl px-5 py-4 border-[1.5px] border-white/45"
          >
            <Text className="text-emerald-100 text-xs font-semibold">
              {t("home.availableBalance")}
            </Text>
            <Text className="text-white text-4xl font-extrabold mt-0.5">
              {fmt(resumen.disponible)}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-2">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: SALUD_COLOR[resumen.salud] }}
              />
              <Text className="text-emerald-50 text-xs">{SALUD_TEXTO[resumen.salud]}</Text>
            </View>
          </LinearGradient>

          {/* DE DÓNDE SALE EL DISPONIBLE.
              Antes esto eran cuatro casillas en fila: presupuesto, gastos,
              ingresos y disponible. Y no sumaban a la vista — 100 − 50 + 3 da
              53, no 284— porque faltaba el saldo que viene arrastrado de los
              meses anteriores, que en ese caso era la mayor parte del total.
              Cuatro números correctos que no cuadran entre sí se leen como
              números inventados, y con razón.
              Ahora se ve la cuenta entera, línea por línea, y cierra. De paso
              se acaba el "Presupuesto d..." recortado por falta de sitio. */}
          <View
            className="mx-5 mt-2.5 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-row"
            style={CARD_SHADOW}
          >
            {[
              // La casilla que estaba antes en este sitio repetía el
              // "Disponible" que ya sale en grande justo encima, y a cambio
              // faltaba el saldo arrastrado de los meses anteriores — que
              // aquí eran 231 de los 284, la mayor parte del total.
              //
              // Por eso las cuatro cifras no sumaban: 100 − 50 + 3 daba 53 y
              // arriba ponía 284. Cambiando la casilla repetida por la que
              // faltaba, las cuatro suman EXACTAMENTE el número de arriba.
              { label: t("home.previousBalance"), value: prevBalance, Icon: Wallet, color: "#64748b" },
              { label: t("reports.budgetShort"), value: budget, Icon: PieChartIcon, color: "#0ea5e9" },
              { label: t("exportPdf.income"), value: income, Icon: ArrowUpCircle, color: "#059669" },
              { label: t("exportPdf.expenses"), value: spent, Icon: ArrowDownCircle, color: "#e11d48" },
            ].map((c, i) => (
              <View
                key={i}
                className={`flex-1 items-center py-3 px-1 ${
                  i > 0 ? "border-l-[1.5px] border-slate-200 dark:border-slate-700" : ""
                }`}
              >
                <c.Icon size={15} color={c.color} />
                <Text
                  className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-center"
                  numberOfLines={1}
                >
                  {c.label}
                </Text>
                <Text
                  className="text-[11px] font-extrabold mt-0.5 text-center"
                  style={{ color: primaryTextColor }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fmt(c.value)}
                </Text>
              </View>
            ))}
          </View>

          {/* La cuenta, escrita. Una línea pequeña, pero es la que convierte
              cuatro cifras sueltas en algo comprobable de un vistazo: se
              suman las de arriba y tiene que dar el número grande. */}
          <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1.5 px-5">
            {t("reports.formula")}
          </Text>

          {/* Presupuesto utilizado. Solo si hay presupuesto: sin él, una
              barra de progreso no mide nada y un 0% engañaría. */}
          {budget > 0 && (
            <View
              className="mx-5 mt-2.5 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
              style={CARD_SHADOW}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold" style={{ color: primaryTextColor }}>
                  {t("reports.budgetUsed")}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  {fmt(spent)} {t("reports.ofBudget")} {fmt(budget)}
                </Text>
              </View>
              {/* La barra se mueve sola al cambiar los gastos, con 600 ms de
                  recorrido. Antes saltaba de golpe: el dato era correcto pero
                  el salto instantáneo del 50 al 60 no se veía. */}
              <AnimatedBar pct={resumen.usado} color={SALUD_COLOR[resumen.salud]} />
              {/* Cuatro estados, no dos. Justo al llegar al 100% no queda
                  nada ni se ha pasado nadie: "aún te quedan S/ 0.00" suena a
                  error, y decir que se pasó cuando no se pasó es falso. */}
              <Text className="text-[11px] mt-2 text-slate-500 dark:text-slate-400">
                {resumen.restante > 0
                  ? t("reports.budgetLeft", { amount: fmt(resumen.restante) })
                  : resumen.restante === 0
                    ? t("reports.budgetExact")
                    : t("reports.budgetOver", { amount: fmt(Math.abs(resumen.restante)) })}
              </Text>
            </View>
          )}
        </>
      )}

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
        className="mx-5 mt-4 bg-white dark:bg-slate-900 rounded-3xl border-[1.5px] border-slate-200 dark:border-slate-700 p-4"
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
        className="mx-5 mt-4 bg-white dark:bg-slate-900 rounded-3xl border-[1.5px] border-slate-200 dark:border-slate-700 p-4"
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

        {/* LAS QUE SIGUEN INTACTAS, EN UNA LÍNEA.
            No gastar en algo también es información —y saber cuánto queda sin
            tocar es la mitad de un presupuesto—, pero doce filas diciendo
            "S/ 0.00 de S/ 50.00" enterraban la única que importaba y empujaban
            todo lo de abajo fuera de la pantalla.

            Se puede desplegar: si alguien quiere ver cuáles son, están. */}
        {sinGasto.length > 0 && (
          <TouchableOpacity
            onPress={() => setVerSinGasto((v) => !v)}
            className="mt-3 pt-3 border-t-[1.5px] border-slate-100 dark:border-slate-800"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 flex-1 pr-2">
                {t("categoryBudgets.untouched", {
                  count: sinGasto.length,
                  amount: fmt(sinGastoTotal),
                })}
              </Text>
              <Text className="text-[11px] font-bold text-emerald-600">
                {t(verSinGasto ? "common.hide" : "common.show")}
              </Text>
            </View>

            {verSinGasto && (
              <View className="mt-2.5 gap-1.5">
                {sinGasto.map((b) => (
                  <View key={b.id} className="flex-row justify-between">
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">{b.name}</Text>
                    <Text className="text-[11px] text-slate-400 dark:text-slate-500">{fmt(b.limit)}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View
        className="mx-5 mt-4 bg-white dark:bg-slate-900 rounded-3xl border-[1.5px] border-slate-200 dark:border-slate-700 p-4"
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

      <View
        className="mx-5 mt-4 bg-white dark:bg-slate-900 rounded-3xl border-[1.5px] border-slate-200 dark:border-slate-700 p-4"
        style={CARD_SHADOW}
      >
        <Text className="text-sm font-bold" style={{ color: primaryTextColor }}>{t("reports.byDayTitle")}</Text>
        {daily.bars.length === 0 ? (
          <Text className="text-center text-slate-500 dark:text-slate-300 text-sm py-10">
            {t("reports.noDataThisMonth")}
          </Text>
        ) : (
          <View className="mt-2">
            <DailyBarsChart
              data={daily.bars}
              fmt={fmt}
              width={windowWidth - 72}
              today={daily.today}
              hint={t("reports.byDayHint")}
              // Tocar un día sin gasto decía "S/ 0.00", que parece un fallo
              // de la app más que una respuesta.
              formatSelected={(day, amount) =>
                amount > 0
                  ? t("reports.byDaySelected", { day, month: monthNames[month.m], amount: fmt(amount) })
                  : t("reports.byDayNoSpend", { day, month: monthNames[month.m] })
              }
              showAmountsLabel={t("reports.byDayShowAmounts")}
              hideAmountsLabel={t("reports.byDayHideAmounts")}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

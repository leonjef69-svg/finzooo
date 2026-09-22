import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, SlidersHorizontal, TrendingDown, TrendingUp, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import Anuncio from "@/components/Anuncio";
import EtiquetaMetodo from "@/components/EtiquetaMetodo";
import IconBadge from "@/components/IconBadge";
import MonthSelector from "@/components/MonthSelector";
import { catInfo } from "@/constants/categories";
import { iconoDe } from "@/constants/iconos";
import { esFoto } from "@/utils/iconosFavoritos";
import { methodLabel } from "@/constants/i18n";
import { CARD_SHADOW } from "@/constants/style";
import { fmtDate, monthKey } from "@/utils/format";
import { parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { compararMovimientos } from "@/utils/ordenarMovimientos";
import { useAppData } from "@/contexts/AppDataContext";
import type { Month, Transaction } from "@/types";

/* UNA SOLA LISTA, NO UN MURO.
   Antes esta pantalla era un ScrollView con dos map() anidados: se construían de golpe
   TODAS las filas del mes, aunque en la pantalla cupieran ocho. Con doscientos movimientos
   eso es abrir el historial y esperar. Ahora las fechas y las filas van aplanadas en un
   solo array que come una FlatList, que solo dibuja lo que se ve y lo que viene justo
   después. La pantalla se abre igual de rápido con 20 movimientos que con 2000. */
type Renglon =
  | { clave: string; tipo: "fecha"; fecha: string }
  | { clave: string; tipo: "fila"; tx: Transaction };

/* La fila se declara FUERA del componente y memoizada. Dentro se volvería a crear en cada
   dibujado y React la trataría como un tipo distinto cada vez: tiraría todas las filas y
   las volvería a montar al escribir una letra en el buscador. */
const Fila = memo(function Fila({
  tx,
  fmt,
  t,
  oscuro,
  onOpenDetail,
}: {
  tx: Transaction;
  fmt: (n: number) => string;
  t: (k: string, v?: Record<string, string | number>) => string;
  oscuro: boolean;
  onOpenDetail: (id: number) => void;
}) {
  const c = catInfo(tx.category);
  return (
    <TouchableOpacity
      onPress={() => onOpenDetail(tx.id)}
      // Mismo contorno que las filas de Inicio: medio píxel más
      // de grosor y un tono más claro, porque la tarjeta y el
      // fondo de la pantalla son del mismo color en oscuro.
      className="flex-row items-center gap-3 bg-white dark:bg-noche-2 rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-noche-borde mb-2.5"
      style={CARD_SHADOW}
    >
      {/* SU PROPIO DIBUJO SI LO TIENE. Ver Transaction.icono: lo trae un pago del
          calendario, y la categoria sigue mandando en las cuentas. */}
      <IconBadge
        Icon={tx.icono && !esFoto(tx.icono) ? iconoDe(tx.icono) : c.icon}
        color={tx.iconColor ?? c.color}
        image={esFoto(tx.icono ?? "") ? tx.icono : c.image}
      />
      <View className="flex-1 min-w-0">
        <Text
          className="text-sm font-bold"
          style={{ color: oscuro ? "#f1f5f9" : "#0f172a" }}
          numberOfLines={1}
        >
          {tx.description || t(c.label)}
        </Text>
        {/* El método pertenece visualmente al monto: ambos describen el pago.
            Aquí queda la hora, en el espacio que antes ocupaba el método. */}
        <Text className="mt-0.5 text-[11px]" style={{ color: oscuro ? "#f1f5f9" : "#64748b" }} numberOfLines={1}>
          {tx.time || t(c.label)}
        </Text>
      </View>
      <View className="items-end self-stretch justify-start">
        <Text
          className={`text-sm font-extrabold ${
            tx.type === "expense" ? "text-rose-500" : "text-emerald-600"
          }`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {tx.type === "expense" ? "-" : "+"}
          {fmt(tx.amount)}
        </Text>
        <View className="mt-1">
          <EtiquetaMetodo metodo={tx.method} t={t} oscuro={oscuro} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function History({
  transactions,
  month,
  setMonth,
  onOpenDetail,
}: {
  transactions: Transaction[];
  month: Month;
  setMonth: (month: Month) => void;
  onOpenDetail: (id: number) => void;
}) {
  const { fmt, t, monthNames } = useAppData();
  const { colorScheme } = useColorScheme();
  const oscuro = colorScheme === "dark";
  const FILTERS = [
    { id: "all", label: t("history.filterAll") },
    { id: "expense", label: t("history.filterExpense") },
    { id: "income", label: t("history.filterIncome") },
  ] as const;
  const [filter, setFilter] = useState<"all" | "expense" | "income">("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const insets = useSafeAreaInsets();
  const mk = monthKey(month.y, month.m);
  const allMonthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(mk)),
    [transactions, mk]
  );
  const availableMonths = useMemo(
    () => Array.from(new Set(transactions.filter((transaction) => /^\d{4}-\d{2}-\d{2}$/.test(transaction.date)).map((transaction) => transaction.date.slice(0, 7)))).sort().reverse(),
    [transactions],
  );
  const categoriesForMonth = useMemo(
    () => Array.from(new Set(allMonthTx.map((transaction) => transaction.category))).sort((a, b) => t(catInfo(a).label).localeCompare(t(catInfo(b).label))),
    [allMonthTx, t],
  );
  const parsedMinAmount = parseAmountInput(minAmount);
  const parsedMaxAmount = parseAmountInput(maxAmount);
  const hasAdvancedFilters = Boolean(categoryFilter || minAmount || maxAmount);

  const { totalExpense, totalIncome } = useMemo(() => {
    return {
      totalExpense: allMonthTx.filter((t) => t.type === "expense" && !t.internalTransfer).reduce((s, t) => s + t.amount, 0),
      totalIncome: allMonthTx.filter((t) => t.type === "income" && !t.internalTransfer).reduce((s, t) => s + t.amount, 0),
    };
  }, [allMonthTx]);
  const showIncomeTotal = totalIncome > 0 && (filter === "all" || filter === "income");
  const showExpenseTotal = totalExpense > 0 && (filter === "all" || filter === "expense");
  const totalHasMoreThanEightFigures = (amount: number) => Math.trunc(Math.abs(amount)).toString().length >= 8;
  const totalsVertical = showIncomeTotal && showExpenseTotal && (totalHasMoreThanEightFigures(totalIncome) || totalHasMoreThanEightFigures(totalExpense));

  const renglones = useMemo<Renglon[]>(() => {
    const query = search.trim().toLowerCase();
    const monthTx = allMonthTx
      .filter((t) => filter === "all" || t.type === filter)
      .filter((tx) => !categoryFilter || tx.category === categoryFilter)
      .filter((tx) => (!minAmount || tx.amount >= parsedMinAmount) && (!maxAmount || tx.amount <= parsedMaxAmount))
      .filter((tx) => {
        if (!query) return true;
        const c = catInfo(tx.category);
        const haystack = `${tx.description} ${t(c.label)} ${methodLabel(tx.method, t)}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort(compararMovimientos);
    const salida: Renglon[] = [];
    let ultimaFecha = "";
    monthTx.forEach((tx) => {
      if (tx.date !== ultimaFecha) {
        ultimaFecha = tx.date;
        salida.push({ clave: `f:${tx.date}`, tipo: "fecha", fecha: tx.date });
      }
      salida.push({ clave: `m:${tx.id}`, tipo: "fila", tx });
    });
    return salida;
  }, [allMonthTx, filter, search, categoryFilter, minAmount, maxAmount, parsedMinAmount, parsedMaxAmount, t]);

  const dibujar = useCallback(
    ({ item }: { item: Renglon }) =>
      item.tipo === "fecha" ? (
        <Text className="px-5 text-xs font-bold text-slate-500 dark:text-slate-300 mb-2 mt-3">
          {fmtDate(item.fecha, monthNames)}
        </Text>
      ) : (
        <View className="px-5">
          <Fila tx={item.tx} fmt={fmt} t={t} oscuro={oscuro} onOpenDetail={onOpenDetail} />
        </View>
      ),
    [fmt, t, oscuro, onOpenDetail, monthNames]
  );

  return (
    <FlatList
      className="flex-1 bg-white dark:bg-noche"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 112 }}
      data={renglones}
      keyExtractor={(r) => r.clave}
      renderItem={dibujar}
      removeClippedSubviews
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      ListHeaderComponent={
        <View>
          <View className="px-5 pt-3 pb-1 flex-row items-start justify-between gap-3">
            <View>
              <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{t("history.title")}</Text>
            </View>
            <MonthSelector month={month} months={availableMonths} monthNames={monthNames} onChange={setMonth} />
          </View>

          <View className="px-5 mt-3">
            <View className="flex-row items-center gap-2 bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-3 py-2.5">
              <Search size={16} color="#94a3b8" />
              <TextInput
                disableFullscreenUI                value={search}
                onChangeText={setSearch}
                placeholder={t("history.searchPlaceholder")}
                placeholderTextColor="#94a3b8"
                className="flex-1 text-sm text-slate-900 dark:text-slate-100"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowFilters((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={t("history.advancedFilters")}
                className={`h-8 w-8 items-center justify-center rounded-lg ${hasAdvancedFilters || showFilters ? "bg-emerald-100 dark:bg-emerald-950" : ""}`}
              >
                <SlidersHorizontal size={16} color={hasAdvancedFilters || showFilters ? "#059669" : "#94a3b8"} />
              </TouchableOpacity>
            </View>
          </View>

          {showFilters ? (
            <View className="mx-5 mt-2 rounded-2xl border-[1.5px] border-slate-200 bg-slate-50 p-3 dark:border-noche-borde dark:bg-noche-2">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-xs font-extrabold text-slate-700 dark:text-slate-100">{t("history.advancedFilters")}</Text>
                {hasAdvancedFilters ? (
                  <TouchableOpacity onPress={() => { setCategoryFilter(""); setMinAmount(""); setMaxAmount(""); }}>
                    <Text className="text-xs font-bold text-emerald-600">{t("history.clearFilters")}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-300">{t("history.categoryFilter")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                <TouchableOpacity onPress={() => setCategoryFilter("")} className={`rounded-full px-3 py-2 ${!categoryFilter ? "bg-emerald-600" : "bg-white dark:bg-noche"}`}>
                  <Text className={`text-xs font-bold ${!categoryFilter ? "text-white" : "text-slate-600 dark:text-slate-200"}`}>{t("history.allCategories")}</Text>
                </TouchableOpacity>
                {categoriesForMonth.map((id) => {
                  const selected = categoryFilter === id;
                  return (
                    <TouchableOpacity key={id} onPress={() => setCategoryFilter(selected ? "" : id)} className={`rounded-full px-3 py-2 ${selected ? "bg-emerald-600" : "bg-white dark:bg-noche"}`}>
                      <Text className={`text-xs font-bold ${selected ? "text-white" : "text-slate-600 dark:text-slate-200"}`}>{t(catInfo(id).label)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text className="mb-1.5 mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-300">{t("history.amountRange")}</Text>
              <View className="flex-row items-center gap-2">
                <TextInput
                  disableFullscreenUI
                  value={minAmount}
                  onChangeText={(value) => setMinAmount(sanitizeAmountInput(value))}
                  keyboardType="decimal-pad"
                  placeholder={t("history.minAmount")}
                  placeholderTextColor="#94a3b8"
                  className="min-w-0 flex-1 rounded-xl border-[1.5px] border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-noche-borde dark:bg-noche dark:text-slate-100"
                />
                <Text className="text-xs font-bold text-slate-400">—</Text>
                <TextInput
                  disableFullscreenUI
                  value={maxAmount}
                  onChangeText={(value) => setMaxAmount(sanitizeAmountInput(value))}
                  keyboardType="decimal-pad"
                  placeholder={t("history.maxAmount")}
                  placeholderTextColor="#94a3b8"
                  className="min-w-0 flex-1 rounded-xl border-[1.5px] border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-noche-borde dark:bg-noche dark:text-slate-100"
                />
              </View>
            </View>
          ) : null}

          <View className="px-5 mt-3 flex-row gap-2">
            {FILTERS.map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                onPress={() => setFilter(id)}
                className={`px-4 py-2 rounded-full ${filter === id ? "bg-emerald-600" : "bg-slate-100 dark:bg-noche-2"}`}
              >
                <Text className={`text-xs font-bold ${filter === id ? "text-white" : "text-slate-600 dark:text-slate-200"}`}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(showIncomeTotal || showExpenseTotal) ? <View className={`px-5 mt-3 mb-3 ${totalsVertical ? "gap-3" : "flex-row gap-3"}`}>
            {showIncomeTotal && (
              <View
                className={`${totalsVertical ? "w-full" : "flex-1"} flex-row items-center gap-2.5 bg-emerald-50 dark:bg-noche-2 rounded-xl px-3 py-2.5 border-[1.5px] border-emerald-100 dark:border-noche-borde`}
                style={CARD_SHADOW}
              >
                <View className="w-8 h-8 rounded-lg bg-emerald-100 items-center justify-center">
                  <TrendingUp size={16} color="#059669" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold" numberOfLines={1}>
                    {t("history.totalIncome")}
                  </Text>
                  <Text className="text-base font-extrabold text-emerald-600" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                    {fmt(totalIncome)}
                  </Text>
                </View>
              </View>
            )}
            {showExpenseTotal && (
              <View
                className={`${totalsVertical ? "w-full" : "flex-1"} flex-row items-center gap-2.5 bg-rose-50 dark:bg-noche-2 rounded-xl px-3 py-2.5 border-[1.5px] border-rose-100 dark:border-noche-borde`}
                style={CARD_SHADOW}
              >
                <View className="w-8 h-8 rounded-lg bg-rose-100 items-center justify-center">
                  <TrendingDown size={16} color="#e11d48" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold" numberOfLines={1}>
                    {t("history.totalExpense")}
                  </Text>
                  <Text className="text-base font-extrabold text-rose-500" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                    {fmt(totalExpense)}
                  </Text>
                </View>
              </View>
            )}
          </View> : null}
        </View>
      }
      ListEmptyComponent={
        <View className="px-5">
          <View className="items-center py-16 bg-white dark:bg-noche-2 rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-noche-borde px-6">
            <Text className="text-slate-500 dark:text-slate-300 text-sm text-center">
              {search.trim()
                ? t("history.noSearchResults", { query: search.trim() })
                : t("history.noResults")}
            </Text>
          </View>
        </View>
      }
      /* EL ANUNCIO VA AQUÍ ABAJO, Y LA ELECCIÓN DEL SITIO IMPORTA.
         Al final del historial, después de todo: hay que deslizar hasta el fondo para verlo,
         no tapa ninguna cifra y no se puede tocar por error mientras se busca un movimiento.

         NO en Inicio, encima del "te queda este mes". Es una app de dinero, y un anuncio junto
         al número por el que se abre la app le quita justo lo que necesita: que se vea seria. */
      ListFooterComponent={<Anuncio />}
    />
  );
}

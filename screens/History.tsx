import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, TrendingDown, TrendingUp, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import Anuncio from "@/components/Anuncio";
import IconBadge from "@/components/IconBadge";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import { catInfo } from "@/constants/categories";
import { iconoDe } from "@/constants/iconos";
import { esFoto } from "@/utils/iconosFavoritos";
import { methodLabel } from "@/constants/i18n";
import { CARD_SHADOW } from "@/constants/style";
import { fmtDate, monthKey } from "@/utils/format";
import { compararMovimientos } from "@/utils/ordenarMovimientos";
import { useAppData } from "@/contexts/AppDataContext";
import type { Month, Transaction } from "@/types";

export default function History({
  transactions,
  month,
  onOpenDetail,
}: {
  transactions: Transaction[];
  month: Month;
  onOpenDetail: (id: number) => void;
}) {
  const { fmt, t, monthNames, userLanguage } = useAppData();
  const { colorScheme } = useColorScheme();
  const FILTERS = [
    { id: "all", label: t("history.filterAll") },
    { id: "expense", label: t("history.filterExpense") },
    { id: "income", label: t("history.filterIncome") },
  ] as const;
  const [filter, setFilter] = useState<"all" | "expense" | "income">("all");
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();
  const mk = monthKey(month.y, month.m);
  const allMonthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(mk)),
    [transactions, mk]
  );

  const { totalExpense, totalIncome } = useMemo(() => {
    return {
      totalExpense: allMonthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      totalIncome: allMonthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    };
  }, [allMonthTx]);

  const groupedEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    const monthTx = allMonthTx
      .filter((t) => filter === "all" || t.type === filter)
      .filter((tx) => {
        if (!query) return true;
        const c = catInfo(tx.category);
        const haystack = `${tx.description} ${t(c.label)} ${methodLabel(tx.method, t)}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort(compararMovimientos);
    const grouped: Record<string, Transaction[]> = {};
    monthTx.forEach((t) => {
      (grouped[t.date] = grouped[t.date] || []).push(t);
    });
    return Object.entries(grouped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMonthTx, filter, search, userLanguage]);

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-noche"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 112 }}
    >
      <View className="px-5 pt-3 pb-1 flex-row items-start justify-between">
        <View>
          <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{t("history.title")}</Text>
          <Text className="text-xs text-slate-500 dark:text-slate-300">
            {monthNames[month.m]} {month.y}
          </Text>
        </View>
        <ThemeToggleButton />
      </View>

      <View className="px-5 mt-3">
        <View className="flex-row items-center gap-2 bg-slate-50 dark:bg-noche-2 rounded-xl border-[1.5px] border-slate-200 dark:border-noche-borde px-3 py-2.5">
          <Search size={16} color="#94a3b8" />
          <TextInput
            value={search}
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
        </View>
      </View>

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

      <View className="px-5 mt-3 flex-row gap-2.5">
        {(filter === "all" || filter === "expense") && (
          <View
            className="flex-1 flex-row items-center gap-3 bg-rose-50 dark:bg-noche rounded-2xl p-3.5 border-[1.5px] border-rose-100 dark:border-noche-borde"
            style={CARD_SHADOW}
          >
            <View className="w-9 h-9 rounded-xl bg-rose-100 items-center justify-center">
              <TrendingDown size={17} color="#e11d48" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold" numberOfLines={1}>
                {t("history.totalExpense")}
              </Text>
              <Text className="text-base font-extrabold text-rose-500">{fmt(totalExpense)}</Text>
            </View>
          </View>
        )}
        {(filter === "all" || filter === "income") && (
          <View
            className="flex-1 flex-row items-center gap-3 bg-emerald-50 dark:bg-noche rounded-2xl p-3.5 border-[1.5px] border-emerald-100 dark:border-noche-borde"
            style={CARD_SHADOW}
          >
            <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center">
              <TrendingUp size={17} color="#059669" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold" numberOfLines={1}>
                {t("history.totalIncome")}
              </Text>
              <Text className="text-base font-extrabold text-emerald-600">{fmt(totalIncome)}</Text>
            </View>
          </View>
        )}
      </View>

      <View className="px-5 mt-4">
        {groupedEntries.length === 0 && (
          <View className="items-center py-16 bg-white dark:bg-noche rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-noche-borde px-6">
            <Text className="text-slate-500 dark:text-slate-300 text-sm text-center">
              {search.trim()
                ? t("history.noSearchResults", { query: search.trim() })
                : t("history.noResults")}
            </Text>
          </View>
        )}
        {groupedEntries.map(([date, items]) => (
          <View key={date} className="mb-4">
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-2">{fmtDate(date, monthNames)}</Text>
            <View className="gap-2.5">
              {items.map((tx) => {
                const c = catInfo(tx.category);
                return (
                  <TouchableOpacity
                    key={tx.id}
                    onPress={() => onOpenDetail(tx.id)}
                    // Mismo contorno que las filas de Inicio: medio píxel más
                    // de grosor y un tono más claro, porque la tarjeta y el
                    // fondo de la pantalla son del mismo color en oscuro.
                    className="flex-row items-center gap-3 bg-white dark:bg-noche rounded-2xl p-3 border-[1.5px] border-slate-200 dark:border-noche-borde"
                    style={CARD_SHADOW}
                  >
                  {/* SU PROPIO DIBUJO SI LO TIENE. Ver Transaction.icono: lo trae un pago del
                      calendario, y la categoria sigue mandando en las cuentas. */}
                    <IconBadge Icon={tx.icono && !esFoto(tx.icono) ? iconoDe(tx.icono) : c.icon} color={c.color} image={esFoto(tx.icono ?? "") ? tx.icono : c.image} />
                    <View className="flex-1 min-w-0">
                      <Text
                        className="text-sm font-bold"
                        style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
                        numberOfLines={1}
                      >
                        {tx.description || t(c.label)}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#64748b" }}
                      >
                        {/* La hora solo si la hay. Aquí la fecha ya va arriba
                            como título del grupo, así que basta con la hora:
                            repetir el día en cada fila sería decir dos veces
                            lo mismo. */}
                        {t(c.label)} · {methodLabel(tx.method, t)}
                        {tx.time ? ` · ${tx.time}` : ""}
                      </Text>
                    </View>
                    <Text
                      className={`text-sm font-extrabold ${
                        tx.type === "expense" ? "text-rose-500" : "text-emerald-600"
                      }`}
                    >
                      {tx.type === "expense" ? "-" : "+"}
                      {fmt(tx.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {/* EL ANUNCIO VA AQUÍ ABAJO, Y LA ELECCIÓN DEL SITIO IMPORTA.
          Al final del historial, después de todo: hay que deslizar hasta el fondo para verlo,
          no tapa ninguna cifra y no se puede tocar por error mientras se busca un movimiento.

          NO en Inicio, encima del "te queda este mes". Es una app de dinero, y un anuncio junto
          al número por el que se abre la app le quita justo lo que necesita: que se vea seria.
          Ese sitio no se gana con anuncios; se pierde con ellos. */}
      <Anuncio />
    </ScrollView>
  );
}

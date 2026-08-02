import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Eraser,
  Eye,
  EyeOff,
  FileUp,
  ListChecks,
  RotateCcw,
  Target,
  Trash2,
  X,
} from "lucide-react-native";
import ConfirmDialog from "@/components/ConfirmDialog";
import BudgetRing from "@/components/BudgetRing";
import IconBadge from "@/components/IconBadge";
import PressableScale from "@/components/PressableScale";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import { catInfo } from "@/constants/categories";
import { CARD_SHADOW } from "@/constants/style";
import { fmtDate, monthKey } from "@/utils/format";
import { compararMovimientos } from "@/utils/ordenarMovimientos";
import { sanitizeAmountInput } from "@/utils/amount";
import { availableBalance, budgetUsed } from "@/utils/finances";
import { usePendingImport } from "@/utils/pendingImport";
import { router } from "expo-router";
import { useAppData } from "@/contexts/AppDataContext";
import type { Month, Transaction } from "@/types";
import { useColorScheme } from "nativewind";

const softShadow = CARD_SHADOW;

export default function Home({
  userName,
  month,
  setMonth,
  budget,
  spent,
  income,
  prevBalance,
  transactions,
  onOpenDetail,
  onBulkDelete,
}: {
  userName: string;
  month: Month;
  setMonth: (m: Month) => void;
  budget: number;
  spent: number;
  income: number;
  prevBalance: number;
  transactions: Transaction[];
  onOpenDetail: (id: number) => void;
  onBulkDelete: (ids: number[]) => void;
}) {
  const {
    fmt,
    t,
    monthNames,
    monthLabel,
    setBudgetForCurrentMonth,
    carryoverActive,
    resetCarryover,
    restoreCarryover,
  } = useAppData();
  const [confirmResetCarryover, setConfirmResetCarryover] = useState(false);
  const [confirmRestoreCarryover, setConfirmRestoreCarryover] = useState(false);
  // El cálculo vive en utils/finances.ts y no aquí. Reportes enseña el mismo
  // "Disponible", y con la fórmula copiada en dos sitios bastaría con tocar
  // una para que las dos pantallas mostraran saldos distintos del mismo mes.
  const available = availableBalance({ budget, prevBalance, income, spent });
  const pct = budgetUsed({ budget, prevBalance, income, spent }) * 100;
  const mk = monthKey(month.y, month.m);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [hideBalance, setHideBalance] = useState(false);
  const archivoPendiente = usePendingImport();

  function startEditBudget() {
    setBudgetInput(String(budget));
    setEditingBudget(true);
  }
  function saveBudgetInline() {
    setBudgetForCurrentMonth(parseFloat(budgetInput) || 0);
    setEditingBudget(false);
  }
  const monthTx = useMemo(
    () =>
      transactions
        .filter((t) => t.date.startsWith(mk))
        .sort(compararMovimientos),
    [transactions, mk]
  );

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

  function shiftMonth(d: number) {
    let m = month.m + d;
    let y = month.y;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth({ y, m });
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected([]);
  }
  function toggleSelected(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function confirmBulkDelete() {
    onBulkDelete(selected);
    setSelected([]);
    setSelectMode(false);
  }

  return (
    <View className="flex-1 bg-white dark:bg-slate-900">
      {/* PARTE FIJA
          El saludo, el mes, el presupuesto y el resumen se quedan quietos:
          antes formaban la cabecera de la lista y se iban hacia arriba al
          desplazar, así que para llegar a los movimientos había que pasarlos
          todos, y para volver a mirar el saldo había que subir otra vez.
          Ahora solo se desliza la lista, por debajo. */}
      <View style={{ paddingTop: insets.top }}>
        <View className="px-5 pt-2 pb-1 flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-slate-500 dark:text-slate-300 font-medium">{t("home.greeting")}</Text>
            <Text
              className="text-lg font-extrabold"
              style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
            >
              {userName.split(" ")[0]} 👋
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <ThemeToggleButton />
            <TouchableOpacity className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center">
              <Bell size={18} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
              <View className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row items-center justify-center gap-5 mt-2 mb-4">
          <TouchableOpacity
            onPress={() => shiftMonth(-1)}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <ChevronLeft size={18} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
          </TouchableOpacity>
          <View className="px-5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border-[1.5px] border-slate-200 dark:border-slate-700">
            <Text
              className="font-bold text-base text-center"
              numberOfLines={1}
              style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
            >
              {monthNames[month.m]} {month.y}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => shiftMonth(1)}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <ChevronRight size={18} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={["#059669", "#0f766e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          // El grosor ya era 1.5, como el resto; lo que fallaba era el color.
          // Un blanco al 20% sobre el verde se pierde, así que esta tarjeta
          // parecía la única sin contorno estando rodeada de tarjetas que sí
          // lo tienen. Al 45% se ve igual de marcado que el gris de las
          // demás, sin meter un borde gris que sobre el verde chirriaría.
          className="mx-5 rounded-[32px] overflow-hidden p-5 flex-row items-center gap-4 border-[1.5px] border-white/45"
        >
          <BudgetRing pct={pct} />
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-emerald-100 text-xs font-semibold">
                {editingBudget ? t("home.monthlyBudget") : t("home.availableBalance")}
              </Text>
              {!editingBudget && (
                <TouchableOpacity
                  onPress={() => setHideBalance((v) => !v)}
                  className="w-6 h-6 items-center justify-center"
                >
                  {hideBalance ? (
                    <EyeOff size={15} color="#d1fae5" />
                  ) : (
                    <Eye size={15} color="#d1fae5" />
                  )}
                </TouchableOpacity>
              )}
            </View>
            {editingBudget ? (
              <View className="flex-row items-center gap-2 mt-1">
                <TextInput
                  value={budgetInput}
                  onChangeText={(v) => setBudgetInput(sanitizeAmountInput(v))}
                  keyboardType="decimal-pad"
                  autoFocus
                  className="text-white text-2xl font-extrabold flex-1 border-b border-white/40 py-0.5"
                />
                <TouchableOpacity
                  onPress={saveBudgetInline}
                  className="w-[42px] h-[42px] rounded-full bg-white/25 items-center justify-center"
                >
                  <Check size={21} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditingBudget(false)}
                  className="w-[42px] h-[42px] rounded-full bg-white/15 items-center justify-center"
                >
                  <X size={21} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text className="text-white text-3xl font-extrabold tracking-tight">
                  {hideBalance ? "• • • • • •" : fmt(available)}
                </Text>
                <Text className="text-emerald-100 text-[11px] mt-1">
                  {hideBalance
                    ? t("home.budgetedOf", { amount: "••••" })
                    : t("home.budgetedOf", { amount: fmt(budget) })}
                </Text>
              </>
            )}
          </View>
        </LinearGradient>

        {!editingBudget && (
          <TouchableOpacity
            onPress={startEditBudget}
            // Mismo contorno de 1.5 que las tarjetas de justo debajo. Era el
            // único recuadro de esta pantalla sin ninguno: al lado de las
            // tarjetas con borde, parecía hundido en el fondo.
            className="mx-5 mt-3 flex-row items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl py-3 border-[1.5px] border-slate-200 dark:border-slate-700"
          >
            <Target size={19} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
            <Text className="text-base font-bold text-slate-700 dark:text-slate-200">
              {t("home.setMonthlyBudget")}
            </Text>
          </TouchableOpacity>
        )}

        {/* ESTADO DE CUENTA QUE LLEGÓ Y NO SE LLEGÓ A ABRIR.
            Es la red de seguridad de "Compartir → Finzo". Si por lo que sea
            la pantalla de importar no se abrió sola, el archivo NO se pierde
            en silencio: aparece aquí con su nombre y se abre de un toque.
            Antes, cuando algo fallaba, la app se quedaba en Inicio sin decir
            nada y no había forma de saber si el archivo había llegado. */}
        {archivoPendiente && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/import",
                params: { uri: archivoPendiente.uri, name: archivoPendiente.name },
              })
            }
            className="mx-5 mt-3 flex-row items-center gap-3 rounded-2xl border-[1.5px] border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3"
          >
            <FileUp size={19} color="#059669" />
            <View className="flex-1">
              <Text className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">
                {t("home.incomingFileTitle")}
              </Text>
              <Text className="text-[11px] text-emerald-700 dark:text-emerald-300" numberOfLines={1}>
                {archivoPendiente.name}
              </Text>
            </View>
            <ChevronRight size={18} color="#059669" />
          </TouchableOpacity>
        )}

        <View className="flex-row flex-wrap gap-3 px-5 mt-4">
          <Animated.View entering={FadeInDown.delay(0 * 70).duration(300)} style={{ width: "47%" }}>
            <PressableScale
              onPress={startEditBudget}
              className="bg-sky-50 dark:bg-slate-800 rounded-2xl p-4 border-[1.5px] border-sky-100 dark:border-slate-700"
              style={softShadow}
            >
              <Text className="text-base mb-1">💰</Text>
              <Text className="text-xs text-slate-600 dark:text-slate-200 font-semibold mb-1">
                {t("home.monthlyBudget")}
              </Text>
              <Text
                className="text-lg font-extrabold"
                style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              >
                {fmt(budget)}
              </Text>
            </PressableScale>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(1 * 70).duration(300)} style={{ width: "47%" }}>
            <PressableScale
              className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={softShadow}
            >
              <Text className="text-base mb-1">🕒</Text>
              <Text className="text-xs text-slate-600 dark:text-slate-200 font-semibold mb-1">
                {t("home.previousBalance")}
              </Text>
              <Text
                className={`text-lg font-extrabold ${prevBalance >= 0 ? "" : "text-rose-500"}`}
                style={prevBalance >= 0 ? { color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" } : undefined}
              >
                {fmt(prevBalance)}
              </Text>
              {/* Un solo botón con dos caras, y siempre referido AL MES
                  QUE SE ESTÁ VIENDO (cada mes es independiente):
                  - Si este mes está puesto en cero, ofrece DESHACER. Es
                    imprescindible que aparezca aquí: al quedar el saldo
                    en 0 no habría ningún otro sitio desde donde volver
                    atrás, y la acción sería irreversible desde la app.
                  - Si no, y hay algo que poner en cero, ofrece hacerlo.
                  - Si el saldo ya es 0 por sí solo, no se muestra nada:
                    el botón no haría nada y solo estorbaría. */}
              {carryoverActive ? (
                <TouchableOpacity
                  onPress={() => setConfirmRestoreCarryover(true)}
                  hitSlop={10}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900 items-center justify-center"
                >
                  <RotateCcw size={14} color="#059669" />
                </TouchableOpacity>
              ) : prevBalance !== 0 ? (
                <TouchableOpacity
                  onPress={() => setConfirmResetCarryover(true)}
                  hitSlop={10}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-200/70 dark:bg-slate-700 items-center justify-center"
                >
                  <Eraser size={14} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
                </TouchableOpacity>
              ) : null}
            </PressableScale>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(2 * 70).duration(300)} style={{ width: "47%" }}>
            <PressableScale
              className="bg-rose-50 dark:bg-slate-800 rounded-2xl p-4 border-[1.5px] border-rose-100 dark:border-slate-700"
              style={softShadow}
            >
              <Text className="text-base mb-1">📉</Text>
              <Text className="text-xs text-slate-600 dark:text-slate-200 font-semibold mb-1">{t("home.spent")}</Text>
              <Text className="text-lg font-extrabold text-rose-500">{fmt(spent)}</Text>
            </PressableScale>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(3 * 70).duration(300)} style={{ width: "47%" }}>
            <PressableScale
              className="bg-emerald-50 dark:bg-slate-800 rounded-2xl p-4 border-[1.5px] border-emerald-100 dark:border-slate-700"
              style={softShadow}
            >
              <Text className="text-base mb-1">📈</Text>
              <Text className="text-xs text-slate-600 dark:text-slate-200 font-semibold mb-1">{t("home.income")}</Text>
              <Text className="text-lg font-extrabold text-emerald-600">{fmt(income)}</Text>
            </PressableScale>
          </Animated.View>
        </View>

        <View className="px-5 mt-6 mb-2 flex-row items-center justify-between">
          {selectMode ? (
            <>
              <Text
                className="font-extrabold text-base"
                style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              >
                {t(selected.length > 1 ? "home.selectedCountPlural" : "home.selectedCount", {
                  count: selected.length,
                })}
              </Text>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={confirmBulkDelete}
                  disabled={selected.length === 0}
                  className={`w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950 items-center justify-center ${
                    selected.length === 0 ? "opacity-40" : ""
                  }`}
                >
                  <Trash2 size={21} color="#f43f5e" />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleSelectMode}>
                  <Text className="text-base font-bold text-emerald-600">{t("common.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text
                className="font-extrabold text-base"
                style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
              >
                {t("home.recentTransactions")}
              </Text>
              {monthTx.length > 0 && (
                <TouchableOpacity onPress={toggleSelectMode} className="flex-row items-center gap-1">
                  <ListChecks size={16} color="#059669" />
                  <Text className="text-sm font-bold text-emerald-600">{t("common.select")}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      <FlatList
        data={monthTx}
        keyExtractor={(t) => String(t.id)}
        // flex-1: ocupa todo lo que sobra bajo la parte fija. Sin esto, la
        // lista se estira solo hasta donde llegue su contenido y con pocos
        // movimientos deja un hueco raro.
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 112 }}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        renderItem={({ item: t2, index }) => {
          const c = catInfo(t2.category);
          const isSel = selected.includes(t2.id);
          // La animación de entrada se aplica SOLO a las filas visibles al
          // abrir (las 8 primeras). Antes se aplicaba a todas, y como las
          // posteriores llevaban el retardo máximo (400 ms), al desplazarse
          // cada fila nueva aparecía en blanco durante ese tiempo antes de
          // dibujarse — se veía como tirones y la lista se sentía pesada.
          // Las filas de más abajo ya no "entran" animadas: simplemente
          // están ahí cuando llegas a ellas, que es lo esperable al
          // desplazar.
          const Row = index < 8 ? Animated.View : View;
          const rowProps =
            index < 8 ? { entering: FadeInDown.delay(index * 50).duration(280) } : {};
          return (
            <View className="px-5">
              <Row {...rowProps}>
                <PressableScale
                  onPress={() => (selectMode ? toggleSelected(t2.id) : onOpenDetail(t2.id))}
                  // El contorno se ve poco, sobre todo de noche: la tarjeta
                  // es slate-900 y el fondo de la pantalla TAMBIÉN, así que
                  // lo único que las separaba era un borde casi del mismo
                  // color. Se sube medio píxel de grosor y se aclara el
                  // color un tono en cada tema.
                  className={`flex-row items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-3 border-[1.5px] mb-2.5 ${
                    isSel
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                  style={softShadow}
                >
                  {selectMode &&
                    (isSel ? (
                      <CheckCircle2 size={22} color="#059669" />
                    ) : (
                      <Circle size={22} color="#cbd5e1" />
                    ))}
                  <IconBadge Icon={c.icon} color={c.color} />
                  <View className="flex-1 min-w-0">
                    <Text
                      className="text-base font-bold"
                      style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a" }}
                      numberOfLines={1}
                    >
                      {t2.description || t(c.label)}
                    </Text>
                    <Text
                      className="text-sm"
                      style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#334155" }}
                    >
                      {/* La hora solo si la hay. Los movimientos guardados
                          antes de esto no la tienen, y los importados de un
                          estado de cuenta tampoco: el banco solo da la fecha.
                          Mejor sin hora que con una inventada. */}
                      {t(c.label)} · {fmtDate(t2.date, monthNames)}
                      {t2.time ? ` · ${t2.time}` : ""}
                    </Text>
                  </View>
                  <Text
                    className={`text-base font-extrabold ${
                      t2.type === "expense" ? "text-rose-500" : "text-emerald-600"
                    }`}
                  >
                    {t2.type === "expense" ? "-" : "+"}
                    {fmt(t2.amount)}
                  </Text>
                </PressableScale>
              </Row>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="px-5">
            <View className="items-center py-10 bg-white dark:bg-slate-900 rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-slate-700">
              <Text className="text-slate-500 dark:text-slate-300 text-sm">{t("home.noTransactions")}</Text>
            </View>
          </View>
        }
      />

      <ConfirmDialog
        visible={confirmResetCarryover}
        // Se nombra el mes en concreto ("¿Empezar de cero desde Agosto
        // 2026?") en vez de "este mes": el botón actúa sobre el mes que se
        // está viendo, y equivocarse de mes cambia el resultado por
        // completo, así que conviene que quede a la vista antes de
        // confirmar.
        title={t("home.resetCarryoverTitle", { month: monthLabel })}
        message={t("home.resetCarryoverMessage", { month: monthLabel })}
        confirmLabel={t("home.resetCarryoverConfirm")}
        cancelLabel={t("common.cancel")}
        danger={false}
        onCancel={() => setConfirmResetCarryover(false)}
        onConfirm={() => {
          setConfirmResetCarryover(false);
          resetCarryover();
        }}
      />

      <ConfirmDialog
        visible={confirmRestoreCarryover}
        title={t("home.restoreCarryoverTitle", { month: monthLabel })}
        message={t("home.restoreCarryoverMessage", { month: monthLabel })}
        confirmLabel={t("home.restoreCarryoverConfirm")}
        cancelLabel={t("common.cancel")}
        danger={false}
        onCancel={() => setConfirmRestoreCarryover(false)}
        onConfirm={() => {
          setConfirmRestoreCarryover(false);
          restoreCarryover();
        }}
      />
    </View>
  );
}

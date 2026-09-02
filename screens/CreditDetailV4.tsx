import {
  CreditState,
  EMPTY_CREDIT_STATE,
  cardTotals,
  loadCreditState,
  outstandingAmount,
  processingAmount,
  saveCreditState,
} from "@/utils/creditStore";
import { useAppData } from "@/contexts/AppDataContext";
import { currencySymbolFor } from "@/constants/currencies";
import { irUnaVez } from "@/utils/nav";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Frown,
  Meh,
  Pencil,
  Plus,
  Smile,
  Trash2,
  Trophy,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

type Tab = "movements" | "paid" | "installments";

export default function CreditDetailV4() {
  const nativeRouter = useRouter();
  const { deleteTransactions } = useAppData();
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const [state, setState] = useState<CreditState>(EMPTY_CREDIT_STATE);
  const [tab, setTab] = useState<Tab>("movements");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      loadCreditState().then(setState);
    }, []),
  );
  const card = state.cards.find((c) => c.id === cardId);
  const totals = card ? cardTotals(state, card.id) : null;
  const purchases = useMemo(
    () =>
      card ? state.purchases.filter((p) => p.cardId === card.id).reverse() : [],
    [state, card],
  );
  const quotas = useMemo(
    () =>
      card
        ? state.installments
            .filter((i) => i.cardId === card.id)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        : [],
    [state, card],
  );
  const installmentGroups = useMemo(
    () =>
      purchases
        .filter((p) => p.installments > 1)
        .map((p) => {
          const all = quotas.filter((q) => q.purchaseId === p.id);
          const pending = all.filter((q) => !q.paid);
          return { purchase: p, all, pending, next: pending[0] };
        })
        .filter((group) => group.pending.length > 0),
    [purchases, quotas],
  );
  const openPurchases = useMemo(
    () =>
      purchases.filter((p) => {
        const all = quotas.filter((q) => q.purchaseId === p.id);
        return (
          p.installments === 1 && all.length > 0 && all.some((q) => !q.paid)
        );
      }),
    [purchases, quotas],
  );
  const paidPurchases = useMemo(
    () =>
      purchases.filter((p) => {
        const all = quotas.filter((q) => q.purchaseId === p.id);
        return all.length > 0 && all.every((q) => q.paid);
      }),
    [purchases, quotas],
  );
  function changeTab(next: Tab) {
    setTab(next);
    setSelecting(false);
    setSelected([]);
  }
  function toggle(id: string) {
    setSelected((value) =>
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );
  }
  function askDelete() {
    if (selected.length === 0) return;
    const linkedIds = Array.from(
      new Set(
        state.installments
          .filter((q) => selected.includes(q.purchaseId))
          .flatMap((q) => [
            ...(q.homeTransactionId ? [q.homeTransactionId] : []),
            ...(q.payments ?? [])
              .map((payment) => payment.homeTransactionId)
              .filter((id): id is number => id != null),
          ]),
      ),
    );
    Alert.alert(
      "Borrar movimientos",
      `Se borrarán ${selected.length} movimiento${selected.length === 1 ? "" : "s"} y sus cuotas.${linkedIds.length ? ` También se eliminarán ${linkedIds.length} pago${linkedIds.length === 1 ? "" : "s"} de Inicio y tu saldo disponible se actualizará.` : " Tu saldo de Inicio no cambiará."}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            const next = {
              ...state,
              purchases: state.purchases.filter(
                (p) => !selected.includes(p.id),
              ),
              installments: state.installments.filter(
                (q) => !selected.includes(q.purchaseId),
              ),
            };
            await saveCreditState(next);
            if (linkedIds.length) deleteTransactions(linkedIds);
            setState(next);
            setSelected([]);
            setSelecting(false);
          },
        },
      ],
    );
  }
  if (!card || !totals)
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Tarjeta no encontrada</Text>
      </View>
    );
  const symbol = currencySymbolFor(card.currency ?? "PEN");
  const currentCardId = card.id;
  const datesConfigured = Boolean(card.closingDay && card.paymentDay);
  function openInstallments(purchaseId: string) {
    if (!datesConfigured)
      return Alert.alert(
        "Cuotas no disponibles",
        "Configura el día de corte y el último día de pago para calcular vencimientos reales.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Configurar",
            onPress: () =>
              irUnaVez({
                pathname: "/credit-card-settings",
                params: { cardId: currentCardId },
              }),
          },
        ],
      );
    irUnaVez({
      pathname: "/credit-purchase",
      params: { cardId: currentCardId, convertId: purchaseId },
    });
  }
  return (
    <ScrollView className="flex-1 bg-slate-50 px-4 pt-12">
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => nativeRouter.back()}
          className="rounded-full bg-white p-2"
        >
          <ArrowLeft color="#0f766e" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text numberOfLines={1} className="text-2xl font-extrabold">
            {card.bank}
          </Text>
          <Text className="text-slate-500">Detalle de tarjeta</Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            irUnaVez({
              pathname: "/credit-card-settings",
              params: { cardId: card.id },
            })
          }
          className="rounded-full bg-white p-3"
        >
          <Pencil size={18} color="#0f766e" />
        </TouchableOpacity>
      </View>
      <View
        style={{ backgroundColor: card.color }}
        className="mt-4 rounded-2xl p-4"
      >
        <Text className="text-sm text-white/80">Crédito disponible</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
          className="text-2xl font-extrabold text-white"
        >
          {symbol} {(card.limit - totals.debt).toFixed(2)}
        </Text>
        <View className="mt-3 flex-row">
          <Metric label="Límite" value={card.limit} symbol={symbol} />
          <Metric label="Deuda" value={totals.debt} symbol={symbol} />
          <Metric label="Estado de cuenta" value={totals.monthPayment} symbol={symbol} />
        </View>
        {card.closingDay && (
          <Text className="mt-2 text-[11px] font-semibold text-white/80">
            Corte: día {card.closingDay}
            {card.paymentDay ? ` · Pagar hasta: día ${card.paymentDay}` : ""}
          </Text>
        )}
      </View>
      <MembershipCard
        card={card}
        purchases={purchases}
        quotas={quotas}
        symbol={symbol}
        onPress={() =>
          irUnaVez({
            pathname: "/credit-card-settings",
            params: { cardId: card.id },
          })
        }
      />
      <TouchableOpacity
        onPress={() =>
          irUnaVez({
            pathname: "/credit-calendar",
            params: { cardId: card.id },
          })
        }
        className="mt-3 flex-row items-center justify-between rounded-2xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm"
      >
        <View className="flex-row items-center">
          <CalendarDays size={21} color="#0f766e" />
          <View className="ml-2.5">
            <Text className="text-[15px] font-extrabold">Próximo vencimiento</Text>
            <Text className="text-[13px] text-slate-500">
              {totals.next
                ? `${totals.next.dueDate} · ${symbol} ${totals.next.amount.toFixed(2)}`
                : totals.debt > 0 && (!card.closingDay || !card.paymentDay)
                  ? "Configura corte y pago para calcularlo"
                  : "Sin pagos pendientes"}
            </Text>
          </View>
        </View>
        <ChevronRight color="#0f766e" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() =>
          irUnaVez({
            pathname: "/credit-purchase",
            params: { cardId: card.id },
          })
        }
        className="mt-3 flex-row items-center justify-center rounded-2xl bg-teal-600 px-4 py-3"
      >
        <Plus size={21} color="white" />
        <Text className="ml-2 text-[15px] font-extrabold text-white">Registrar compra</Text>
      </TouchableOpacity>
      <View className="mt-3 flex-row rounded-2xl bg-teal-100 p-1">
        <TabButton
          active={tab === "movements"}
          label="Movimientos"
          onPress={() => changeTab("movements")}
        />
        <TabButton
          active={tab === "paid"}
          label="Pagado"
          onPress={() => changeTab("paid")}
        />
        <TabButton
          active={tab === "installments"}
          label="Cuotas"
          onPress={() => changeTab("installments")}
        />
      </View>
      <View className="mt-1 flex-row items-center justify-end">
        {selecting && selected.length > 0 && (
          <TouchableOpacity
            onPress={askDelete}
            className="mr-2 flex-row items-center rounded-xl bg-rose-50 px-3 py-1.5"
          >
            <Trash2 size={16} color="#e11d48" />
            <Text className="ml-1 text-xs font-extrabold text-rose-600">
              Borrar ({selected.length})
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            setSelecting((value) => !value);
            setSelected([]);
          }}
          className="rounded-xl px-2 py-1.5"
        >
          <Text className="text-xs font-extrabold text-teal-700">
            {selecting ? "Cancelar" : "Seleccionar"}
          </Text>
        </TouchableOpacity>
      </View>
      {tab === "movements" && (
        <Section>
          {openPurchases.length === 0 ? (
            <Empty text="No hay movimientos pendientes" />
          ) : (
            openPurchases.map((p) => (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.72}
                accessibilityLabel={
                  selecting ? `Seleccionar ${p.description}` : `Editar ${p.description}`
                }
                onPress={() => {
                  if (selecting) {
                    toggle(p.id);
                    return;
                  }
                  irUnaVez({
                    pathname: "/credit-purchase",
                    params: { cardId: card.id, editId: p.id },
                  });
                }}
                className={`mb-2 rounded-2xl bg-white p-3 shadow-sm ${selected.includes(p.id) ? "border-2 border-teal-500" : "border border-slate-300"}`}
              >
                <View className="flex-row items-center">
                  {selecting && (
                    <View className="mr-2">
                      {selected.includes(p.id) ? (
                        <CheckCircle2 size={21} color="#0d9488" />
                      ) : (
                        <Circle size={21} color="#94a3b8" />
                      )}
                    </View>
                  )}
                  <View className="mr-2 min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-extrabold">
                      {p.description}
                    </Text>
                    <Text numberOfLines={1} className="text-[13px] text-slate-500">
                      {formatDateTime(p.createdAt)}
                      {quotas.some(
                        (quota) =>
                          quota.purchaseId === p.id &&
                          processingAmount(quota) > 0,
                      )
                        ? " · Pago en proceso"
                        : ""}
                    </Text>
                  </View>
                  <View className="w-[44%] max-w-[160px] items-stretch">
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.55}
                      className="text-right font-extrabold text-rose-600"
                    >
                      {symbol}{" "}
                      {quotas
                        .filter((quota) => quota.purchaseId === p.id)
                        .reduce(
                          (sum, quota) => sum + outstandingAmount(quota),
                          0,
                        )
                        .toFixed(2)}
                    </Text>
                    {!selecting && (
                      <View className="mt-1 flex-row gap-1.5">
                        <TouchableOpacity
                          onPress={() =>
                            irUnaVez({
                              pathname: "/credit-pay",
                              params: { cardId: card.id, purchaseId: p.id },
                            })
                          }
                          className="flex-1 rounded-lg bg-emerald-600 px-1 py-1.5"
                        >
                          <Text numberOfLines={1} className="text-center text-[11px] font-extrabold text-white">
                            Pagar
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openInstallments(p.id)}
                          className={`flex-1 rounded-lg px-1 py-1.5 ${datesConfigured ? "bg-cyan-100" : "bg-slate-200"}`}
                        >
                          <Text numberOfLines={1} className={`text-center text-[11px] font-extrabold ${datesConfigured ? "text-cyan-800" : "text-slate-400"}`}>
                            Cuotas
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Section>
      )}
      {tab === "paid" && (
        <Section>
          {paidPurchases.length === 0 ? (
            <Empty text="Aún no hay movimientos pagados" />
          ) : (
            paidPurchases.map((p) => {
              const all = quotas.filter((q) => q.purchaseId === p.id);
              const last = [...all].sort((a, b) =>
                (b.paidAt ?? "").localeCompare(a.paidAt ?? ""),
              )[0];
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={selecting ? 0.65 : 1}
                  onPress={() => selecting && toggle(p.id)}
                  className={`mb-2 rounded-2xl bg-white p-3 shadow-sm ${selected.includes(p.id) ? "border-2 border-teal-500" : "border border-slate-300"}`}
                >
                  <View className="flex-row items-center">
                    {selecting && (
                      <View className="mr-2">
                        {selected.includes(p.id) ? (
                          <CheckCircle2 size={21} color="#0d9488" />
                        ) : (
                          <Circle size={21} color="#94a3b8" />
                        )}
                      </View>
                    )}
                    <View className="flex-1">
                      <Row
                        title={p.description}
                        subtitle={`Pagado · ${last?.paidAt ? formatDateTime(last.paidAt) : (last?.dueDate ?? "")}`}
                        amount={all.reduce((sum, q) => sum + q.amount, 0)}
                        symbol={symbol}
                        green
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </Section>
      )}
      {tab === "installments" && (
        <Section>
          {installmentGroups.length === 0 ? (
            <Empty text="No hay compras en cuotas pendientes" />
          ) : (
            installmentGroups.map(({ purchase, all, pending, next }) => (
              <TouchableOpacity
                key={purchase.id}
                activeOpacity={selecting ? 0.65 : 1}
                onPress={() => selecting && toggle(purchase.id)}
                className={`mb-2 rounded-2xl bg-white p-3 shadow-sm ${selected.includes(purchase.id) ? "border-2 border-teal-500" : "border border-slate-300"}`}
              >
                <View className="flex-row items-center">
                  {selecting && (
                    <View className="mr-2">
                      {selected.includes(purchase.id) ? (
                        <CheckCircle2 size={21} color="#0d9488" />
                      ) : (
                        <Circle size={21} color="#94a3b8" />
                      )}
                    </View>
                  )}
                  <View className="mr-3 flex-1">
                    <Text numberOfLines={1} className="font-extrabold">
                      {purchase.description}
                    </Text>
                    <Text className="text-slate-500">
                      {all.length - pending.length} de {all.length} pagadas ·
                      Próxima {next?.dueDate}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-right font-extrabold">
                      {symbol} {next ? outstandingAmount(next).toFixed(2) : "0.00"}
                    </Text>
                    <Text className="text-right text-xs font-bold text-amber-600">
                      {pending.length} pendientes
                    </Text>
                  </View>
                </View>
                <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <View
                    style={{
                      width: `${(100 * (all.length - pending.length)) / all.length}%`,
                    }}
                    className="h-2 rounded-full bg-emerald-500"
                  />
                </View>
                {!selecting && (
                  <TouchableOpacity
                    onPress={() =>
                      irUnaVez({
                        pathname: "/credit-pay",
                        params: { cardId: card.id, purchaseId: purchase.id },
                      })
                    }
                    className="mt-3 rounded-xl bg-emerald-600 p-3"
                  >
                    <Text className="text-center text-xs font-extrabold text-white">
                      Marcar próxima cuota pagada
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </Section>
      )}
      <View className="h-20" />
    </ScrollView>
  );
}
function Metric({ label, value, symbol }: any) {
  return (
    <View className="mr-2 flex-1">
      <Text numberOfLines={1} className="text-[10px] text-white/70">
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        className="font-extrabold text-white"
      >
        {symbol} {Number(value).toFixed(2)}
      </Text>
    </View>
  );
}
function TabButton({ active, label, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 rounded-xl py-2.5 ${active ? "bg-teal-600" : "bg-transparent"}`}
    >
      <Text
        className={`text-center text-sm font-extrabold ${active ? "text-white" : "text-teal-800"}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
function Section({ children }: any) {
  return <View className="mt-1">{children}</View>;
}
function Empty({ text }: { text: string }) {
  return (
    <Text className="rounded-2xl border border-slate-300 bg-white p-4 text-center text-slate-500 shadow-sm">
      {text}
    </Text>
  );
}
function Row({ title, subtitle, amount, green, symbol }: any) {
  return (
    <View className="flex-row items-center">
      <View className="mr-3 flex-1">
        <Text numberOfLines={1} className="font-extrabold">
          {title}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          className="text-slate-500"
        >
          {subtitle}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        className={`max-w-[38%] font-extrabold ${green ? "text-emerald-600" : "text-rose-600"}`}
      >
        {symbol} {Number(amount).toFixed(2)}
      </Text>
    </View>
  );
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(",", "");
}
function MembershipCard({ card, purchases, quotas, onPress, symbol }: any) {
  const goal = Number(card.membershipMonthlyGoal) || 0;
  const start = card.membershipStartDate
    ? new Date(`${card.membershipStartDate}T12:00:00`)
    : new Date();
  const currentKey = new Date().toISOString().slice(0, 7);
  const months = Array.from(
    { length: 12 },
    (_, i) =>
      `${new Date(start.getFullYear(), start.getMonth() + i, 1).getFullYear()}-${String(new Date(start.getFullYear(), start.getMonth() + i, 1).getMonth() + 1).padStart(2, "0")}`,
  );
  const purchaseIds = new Set(purchases.map((p: any) => p.id));
  const paid = quotas.flatMap((q: any) => {
    if (!purchaseIds.has(q.purchaseId)) return [];
    const records = (q.payments ?? [])
      .filter((payment: any) => payment.status === "confirmed")
      .map((payment: any) => ({
        amount: Number(payment.amount),
        paidAt: payment.createdAt,
      }));
    if (records.length) return records;
    return q.paid && q.paidAt
      ? [{ amount: Number(q.amount), paidAt: q.paidAt }]
      : [];
  });
  const paidByMonth = (key: string) =>
    paid
      .filter((q: any) => q.paidAt.startsWith(key))
      .reduce((sum: number, q: any) => sum + Number(q.amount), 0);
  const sums = months.map(paidByMonth);
  const completed =
    goal > 0 ? sums.filter((value: number) => value >= goal).length : 0;
  const elapsed = months.filter((key) => key < currentKey).length;
  const missed = Math.max(0, elapsed - completed);
  const current = paidByMonth(currentKey);
  const ratio = goal > 0 ? Math.min(1, current / goal) : 0;
  const displayedCurrent = goal > 0 ? Math.min(current, goal) : current;
  const excess = goal > 0 ? Math.max(0, current - goal) : 0;
  const mood =
    ratio >= 1
      ? {
          box: "bg-emerald-100",
          title: "text-emerald-950",
          text: "text-emerald-700",
          bar: "bg-emerald-500",
          track: "bg-emerald-200",
          message: "¡Meta mensual cumplida!",
          icon: "trophy",
        }
      : ratio >= 0.75
        ? {
            box: "bg-cyan-100",
            title: "text-cyan-950",
            text: "text-cyan-700",
            bar: "bg-cyan-500",
            track: "bg-cyan-200",
            message: "¡Ya casi lo logras!",
            icon: "smile",
          }
        : ratio >= 0.35
          ? {
              box: "bg-amber-100",
              title: "text-amber-950",
              text: "text-amber-700",
              bar: "bg-amber-500",
              track: "bg-amber-200",
              message: "Vas avanzando",
              icon: "meh",
            }
          : {
              box: "bg-rose-100",
              title: "text-rose-950",
              text: "text-rose-700",
              bar: "bg-rose-500",
              track: "bg-rose-200",
              message:
                current > 0 ? "Buen comienzo" : "Aún falta avanzar este mes",
              icon: "frown",
            };
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`mt-3 rounded-2xl border border-white p-3 ${mood.box}`}
    >
      <View className="flex-row items-center">
        <View className="mr-2">
          {mood.icon === "trophy" ? (
            <Trophy size={24} color="#059669" />
          ) : mood.icon === "smile" ? (
            <Smile size={24} color="#0891b2" />
          ) : mood.icon === "meh" ? (
            <Meh size={24} color="#d97706" />
          ) : (
            <Frown size={24} color="#e11d48" />
          )}
        </View>
        <View className="flex-1">
          <Text className={`font-extrabold ${mood.title}`}>
            Membresía anual
          </Text>
          <Text className={`text-xs font-semibold ${mood.text}`}>
            {goal > 0
              ? `${mood.message} · ${completed} cumplidos${missed > 0 ? ` · ${missed} pendientes` : ""}`
              : `Configura la meta para evitar el cobro`}
          </Text>
        </View>
        {goal > 0 && (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            className={`ml-2 max-w-[36%] font-extrabold ${mood.text}`}
          >
            {symbol} {displayedCurrent.toFixed(2)} / {goal.toFixed(2)}
          </Text>
        )}
      </View>
      {goal > 0 && (
        <View className={`mt-2 h-3 overflow-hidden rounded-full ${mood.track}`}>
          <View
            style={{ width: `${ratio * 100}%` }}
            className={`h-3 rounded-full ${mood.bar}`}
          />
        </View>
      )}
      <Text className={`mt-1 text-[10px] font-semibold ${mood.text}`}>
        {completed} de 12 meses completados
        {excess > 0
          ? ` · Superaste la meta por ${symbol} ${excess.toFixed(2)}`
          : ""}
      </Text>
    </TouchableOpacity>
  );
}

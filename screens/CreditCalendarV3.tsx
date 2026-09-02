import {
  CreditInstallment,
  CreditState,
  EMPTY_CREDIT_STATE,
  confirmedPaidAmount,
  loadCreditState,
  outstandingAmount,
  processingAmount,
} from "@/utils/creditStore";
import { irUnaVez } from "@/utils/nav";
import { currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

const DAYS = ["D", "L", "M", "M", "J", "V", "S"];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
type CalendarFilter = "all" | "installments" | "paid" | "overdue";

export default function CreditCalendarV3() {
  const { userCurrency } = useAppData();
  const router = useRouter();
  const { cardId } = useLocalSearchParams<{ cardId?: string }>();
  const [state, setState] = useState<CreditState>(EMPTY_CREDIT_STATE);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(() =>
    new Date().getDate(),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalendarFilter>("all");
  useFocusEffect(
    useCallback(() => {
      loadCreditState().then(setState);
    }, []),
  );
  const card = state.cards.find((item) => item.id === cardId) ?? state.cards[0];
  const datesConfigured = Boolean(card?.closingDay && card?.paymentDay);
  const symbol = currencySymbolFor(card?.currency ?? userCurrency ?? "PEN");
  const items = useMemo(
    () =>
      card ? state.installments.filter((item) => item.cardId === card.id) : [],
    [state.installments, card],
  );
  const purchases = useMemo(
    () => new Map(state.purchases.map((purchase) => [purchase.id, purchase])),
    [state.purchases],
  );
  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const paidInMonth = items
    .filter(
      (item) =>
        confirmedPaymentsInMonth(item, monthKey).length > 0 ||
        (item.paid &&
          !item.payments?.length &&
          item.paidAt &&
          paymentDateKey(item.paidAt).startsWith(monthKey)),
    )
    .sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""));
  const today = localDateKey(new Date());
  const pendingSingleItems = items
    .filter((item) => item.total === 1 && !item.paid && outstandingAmount(item) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const pendingInstallmentItems = items
    .filter((item) => item.total > 1 && !item.paid && outstandingAmount(item) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdueItems = datesConfigured
    ? items
        .filter(
          (item) =>
            !item.paid && item.dueDate < today && outstandingAmount(item) > 0,
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    : [];
  const filterCounts = {
    all: pendingSingleItems.length,
    installments: pendingInstallmentItems.length,
    paid: paidInMonth.length,
    overdue: overdueItems.length,
  };
  const itemsForFilter =
    filter === "paid"
      ? paidInMonth
      : filter === "installments"
        ? pendingInstallmentItems
        : filter === "overdue"
          ? overdueItems
          : pendingSingleItems;
  const allCalendarEvents = calendarEvents(items, purchases, datesConfigured);
  const selectedDateKey =
    selectedDay === null
      ? null
      : `${monthKey}-${String(selectedDay).padStart(2, "0")}`;
  const selectedEvents = selectedDateKey
    ? allCalendarEvents.filter((event) => event.date === selectedDateKey)
    : [];
  const selectedDueItems = Array.from(
    new Map(
      selectedEvents
        .filter(
          (event) =>
            (event.kind === "due" || event.kind === "purchase") &&
            !event.item.paid,
        )
        .map((event) => [event.item.id, event.item]),
    ).values(),
  );
  const selectedPaidItems = Array.from(
    new Map(
      selectedEvents
        .filter((event) => event.kind === "payment")
        .map((event) => [event.item.id, event.item]),
    ).values(),
  );
  const selectedCounts = {
    all: selectedDueItems.filter((item) => item.total === 1).length,
    installments: selectedDueItems.filter((item) => item.total > 1).length,
    paid: selectedPaidItems.length,
    overdue: Array.from(
      new Map(
        selectedEvents
          .filter(
            (event) =>
              event.kind === "due" &&
              !event.item.paid &&
              event.item.dueDate < today,
          )
          .map((event) => [event.item.id, event.item]),
      ).values(),
    ).length,
  };
  function firstFilterWithMovements(): CalendarFilter {
    if (selectedCounts.all > 0) return "all";
    if (selectedCounts.installments > 0) return "installments";
    if (selectedCounts.paid > 0) return "paid";
    if (selectedCounts.overdue > 0) return "overdue";
    return "all";
  }
  useEffect(() => {
    if (selectedDay !== null) setFilter(firstFilterWithMovements());
    // Se recalcula al cargar los movimientos; los cambios manuales del filtro
    // no deben volver a activar esta selección automática.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const selectedEventsForFilter = selectedEvents.filter((event) => {
    if (filter === "paid") return event.kind === "payment";
    if (filter === "overdue")
      return (
        event.kind === "due" &&
        !event.item.paid &&
        event.item.dueDate < today
      );
    if (event.kind !== "due" && event.kind !== "purchase") return false;
    if (event.item.paid) return false;
    return filter === "installments"
      ? event.item.total > 1
      : event.item.total === 1;
  });
  const visibleItems =
    selectedDay === null
      ? itemsForFilter
      : Array.from(
          new Map(
            selectedEventsForFilter.map((event) => [event.item.id, event.item]),
          ).values(),
        );
  const lastDay = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate();
  const closingDay = card?.closingDay
    ? Math.min(card.closingDay, lastDay)
    : undefined;
  const paymentDay = card?.paymentDay
    ? Math.min(card.paymentDay, lastDay)
    : undefined;
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
    const count = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array(first).fill(0),
      ...Array.from({ length: count }, (_, index) => index + 1),
    ];
  }, [cursor]);
  const totalPendingAmount = items
    .filter((item) => !item.paid && outstandingAmount(item) > 0)
    .reduce(
    (sum, item) => sum + outstandingAmount(item),
    0,
  );
  const monthPaidAmount = paidInMonth.reduce(
    (sum, item) => sum + paidDuringMonth(item, monthKey),
    0,
  );
  const totalOverdueAmount = overdueItems.reduce(
    (sum, item) => sum + outstandingAmount(item),
    0,
  );
  const nextUrgent = datesConfigured
    ? [...items]
        .filter((item) => !item.paid)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    : undefined;
  function changeMonth(delta: number) {
    const nextCursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + delta,
      1,
    );
    const now = new Date();
    setCursor(nextCursor);
    setSelectedDay(
      nextCursor.getFullYear() === now.getFullYear() &&
        nextCursor.getMonth() === now.getMonth()
        ? now.getDate()
        : null,
    );
    setExpandedId(null);
  }
  function openPayment(item: CreditInstallment) {
    if (item.paid || !card) return;
    irUnaVez({
      pathname: "/credit-pay",
      params: { cardId: card.id, purchaseId: item.purchaseId },
    });
  }
  function moveToInstallments(item: CreditInstallment) {
    if (!card || item.total > 1) return;
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
                params: { cardId: card.id },
              }),
          },
        ],
      );
    irUnaVez({
      pathname: "/credit-purchase",
      params: { cardId: card.id, convertId: item.purchaseId },
    });
  }
  return (
    <ScrollView className="flex-1 bg-slate-50 px-4 pt-14">
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-full bg-white p-2"
        >
          <ArrowLeft color="#0f766e" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text numberOfLines={1} className="text-2xl font-extrabold">
            Calendario de pagos
          </Text>
          <Text className="text-slate-500">{card?.bank ?? "Tarjeta"}</Text>
        </View>
      </View>
      {card && !datesConfigured && (
        <TouchableOpacity
          onPress={() =>
            irUnaVez({
              pathname: "/credit-card-settings",
              params: { cardId: card.id },
            })
          }
          className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-3"
        >
          <Text className="font-extrabold text-amber-900">
            Configura las fechas de la tarjeta
          </Text>
          <Text className="mt-1 text-xs text-amber-800">
            Falta el día de corte o el último día de pago. Toca aquí para
            corregirlos; Fino no mostrará vencimientos inventados.
          </Text>
        </TouchableOpacity>
      )}
      {nextUrgent && (
        <View className="mt-3 flex-row items-center rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 shadow-sm">
          <View className="mr-3 flex-1">
            <Text className="text-[10px] font-extrabold uppercase text-amber-700">
              Tu próximo pago
            </Text>
            <Text
              numberOfLines={1}
              className="mt-1 font-extrabold text-slate-900"
            >
              {purchases.get(nextUrgent.purchaseId)?.description ?? "Compra"} ·{" "}
              {symbol} {outstandingAmount(nextUrgent).toFixed(2)}
            </Text>
            <Text className="text-xs font-semibold text-amber-700">
              Vence {formatDueDate(nextUrgent.dueDate)} ·{" "}
              {nextUrgent.total === 1
                ? "Pago único"
                : `Cuota ${nextUrgent.number} de ${nextUrgent.total}`}
            </Text>
          </View>
          <View className="gap-1">
            <TouchableOpacity
              onPress={() => openPayment(nextUrgent)}
              className="rounded-xl bg-emerald-600 px-4 py-2"
            >
              <Text className="text-center text-xs font-extrabold text-white">
                Pagar
              </Text>
            </TouchableOpacity>
            {nextUrgent.total === 1 && (
              <TouchableOpacity
                onPress={() => moveToInstallments(nextUrgent)}
                className={`rounded-xl px-3 py-2 ${datesConfigured ? "bg-cyan-100" : "bg-slate-200"}`}
              >
                <Text className={`text-center text-[10px] font-extrabold ${datesConfigured ? "text-cyan-800" : "text-slate-400"}`}>
                  Pasar a cuotas
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      <View className="mt-3 flex-row gap-2">
        <Summary
          label="Por pagar"
          value={`${symbol} ${totalPendingAmount.toFixed(2)}`}
          color="amber"
        />
        <Summary
          label="Pagado"
          value={`${symbol} ${monthPaidAmount.toFixed(2)}`}
          color="emerald"
        />
        <Summary
          label="Se pasó"
          value={`${symbol} ${totalOverdueAmount.toFixed(2)}`}
          color="rose"
        />
      </View>
      <View className="mt-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => changeMonth(-1)} className="p-1">
            <ChevronLeft color="#0f766e" />
          </TouchableOpacity>
          <Text className="font-extrabold">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)} className="p-1">
            <ChevronRight color="#0f766e" />
          </TouchableOpacity>
        </View>
        <View className="mt-1 flex-row">
          {DAYS.map((day, index) => (
            <Text
              key={`${day}-${index}`}
              className="w-[14.28%] text-center text-[10px] font-bold text-slate-400"
            >
              {day}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {cells.map((day, index) => {
            const events = day
              ? allCalendarEvents.filter(
                  (event) =>
                    event.date.startsWith(monthKey) &&
                    Number(event.date.slice(8, 10)) === day,
                )
              : [];
            const isClose = day === closingDay,
              isPay = day === paymentDay,
              selected = day === selectedDay,
              isToday =
                Boolean(day) &&
                monthKey === today.slice(0, 7) &&
                day === Number(today.slice(8, 10));
            const eventCount = new Set(events.map((event) => event.item.id))
              .size;
            const eventColor = events.some(
              (event) =>
                (event.kind === "due" || event.kind === "purchase") &&
                !event.item.paid,
            )
              ? status(
                  events.find(
                    (event) =>
                      (event.kind === "due" || event.kind === "purchase") &&
                      !event.item.paid,
                  )!.item,
                ).dot
              : events[0]
                ? "#059669"
                : "#94a3b8";
            return (
              <TouchableOpacity
                disabled={!day}
                onPress={() => {
                  setSelectedDay(selected ? null : day);
                  if (!selected) {
                    const hasPendingSingle = events.some(
                      (event) =>
                        (event.kind === "due" || event.kind === "purchase") &&
                        !event.item.paid &&
                        event.item.total === 1,
                    );
                    const hasInstallments = events.some(
                      (event) =>
                        (event.kind === "due" || event.kind === "purchase") &&
                        !event.item.paid &&
                        event.item.total > 1,
                    );
                    const hasPaid = events.some(
                      (event) => event.kind === "payment",
                    );
                    const hasOverdue = events.some(
                      (event) =>
                        event.kind === "due" &&
                        !event.item.paid &&
                        event.item.dueDate < today,
                    );
                    setFilter(
                      hasPendingSingle
                        ? "all"
                        : hasInstallments
                          ? "installments"
                          : hasPaid
                            ? "paid"
                            : hasOverdue
                              ? "overdue"
                              : "all",
                    );
                  }
                  setExpandedId(null);
                }}
                key={index}
                className={`relative h-14 w-[14.28%] items-center justify-center rounded-lg ${selected ? "border border-teal-500 bg-teal-50" : isPay ? "bg-rose-50" : isClose ? "bg-violet-50" : ""}`}
              >
                {day ? (
                  <Text
                    className={`font-semibold ${selected ? "text-teal-800" : isPay ? "text-rose-700" : isClose ? "text-violet-700" : "text-slate-800"}`}
                  >
                    {day}
                  </Text>
                ) : null}
                {isToday && (
                  <View className="mt-0.5 h-1.5 w-1.5 rounded-full bg-teal-600" />
                )}
                {eventCount > 0 && (
                  <View
                    style={{ backgroundColor: eventColor }}
                    className="absolute right-1 top-1 min-w-4 rounded-full px-1"
                  >
                    <Text className="text-center text-[9px] font-extrabold text-white">
                      {eventCount}
                    </Text>
                  </View>
                )}
                {isClose && (
                  <Text className="text-[7px] font-bold text-violet-700">
                    CORTE
                  </Text>
                )}
                {isPay && (
                  <Text className="text-[7px] font-bold text-rose-700">
                    PAGAR
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {card?.paymentCutoffTime && (
          <Text className="mt-2 text-[10px] text-slate-500">
            Paga antes de las {card.paymentCutoffTime}; después podría
            registrarse al día siguiente.
          </Text>
        )}
      </View>
      <View className="mt-3 flex-row rounded-xl border border-slate-300 bg-slate-100 p-1 shadow-sm">
        <FilterButton
          tone="teal"
          active={filter === "all"}
          label="Por pagar"
          count={selectedDay === null ? filterCounts.all : selectedCounts.all}
          onPress={() => {
            setFilter("all");
          }}
        />
        <FilterButton
          tone="cyan"
          active={filter === "installments"}
          label="Cuotas"
          count={
            selectedDay === null
              ? filterCounts.installments
              : selectedCounts.installments
          }
          onPress={() => {
            setFilter("installments");
          }}
        />
        <FilterButton
          tone="emerald"
          active={filter === "paid"}
          label="Pagados"
          count={selectedDay === null ? filterCounts.paid : selectedCounts.paid}
          onPress={() => {
            setFilter("paid");
          }}
        />
        <FilterButton
          tone="rose"
          active={filter === "overdue"}
          label="Vencidos"
          count={
            selectedDay === null ? filterCounts.overdue : selectedCounts.overdue
          }
          onPress={() => {
            setFilter("overdue");
          }}
        />
      </View>
      {visibleItems.length === 0 ? (
        <Text className="mt-2 rounded-xl border border-slate-300 bg-white p-3 text-center text-sm text-slate-500 shadow-sm">
          No hay pagos en esta vista
        </Text>
      ) : (
        visibleItems.map((item) => {
          const hasPaymentOnSelectedDate = selectedEvents.some(
            (event) => event.item.id === item.id && event.kind === "payment",
          );
          const purchase = purchases.get(item.purchaseId);
          const expanded = expandedId === item.id;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setExpandedId(expanded ? null : item.id)}
              key={item.id}
              className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 shadow-sm"
            >
              <View className="flex-row items-center justify-between">
                <View className="mr-2 flex-1">
                  <Text numberOfLines={1} className="font-extrabold">
                    {purchase?.description ?? "Compra"}
                  </Text>
                  <Text className="text-xs text-slate-500">
                    {item.total === 1
                      ? "Pago único"
                      : `Cuota ${item.number} de ${item.total}`}
                  </Text>
                </View>
                <View className="max-w-[65%] flex-row items-center gap-1.5">
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    className={`mr-1 font-extrabold ${filter === "paid" || hasPaymentOnSelectedDate ? "text-emerald-700" : "text-slate-900"}`}
                  >
                    {symbol}{" "}
                    {((filter === "paid" || hasPaymentOnSelectedDate)
                      ? selectedDateKey
                        ? paidDuringDate(item, selectedDateKey)
                        : paidDuringMonth(item, monthKey)
                      : outstandingAmount(item)
                    ).toFixed(2)}
                  </Text>
                  {!item.paid && (
                    <>
                      <TouchableOpacity
                        onPress={(event) => {
                          event.stopPropagation();
                          openPayment(item);
                        }}
                        className="rounded-lg bg-teal-600 px-3 py-2"
                      >
                        <Text className="text-[10px] font-extrabold text-white">
                          Pagar
                        </Text>
                      </TouchableOpacity>
                      {item.total === 1 && (
                        <TouchableOpacity
                          onPress={(event) => {
                            event.stopPropagation();
                            moveToInstallments(item);
                          }}
                          className={`rounded-lg px-3 py-2 ${datesConfigured ? "bg-cyan-50" : "bg-slate-200"}`}
                        >
                          <Text className={`text-[10px] font-extrabold ${datesConfigured ? "text-cyan-800" : "text-slate-400"}`}>
                            Cuotas
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
              {expanded && (
                <View className="mt-2 border-t border-slate-100 pt-2">
                  <Text className="text-xs text-slate-500">
                    Vence: {item.dueDate}
                  </Text>
                  {item.paid && (
                    <Text className="mt-1 text-xs font-semibold text-emerald-700">
                      Pagada {item.paidAt ? formatDateTime(item.paidAt) : ""} ·{" "}
                      {item.paidMethod ?? "Pago registrado"}
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })
      )}
      {selectedDay === null && filter !== "paid" && visibleItems.length > 0 && (
        <Text className="mt-2 text-center text-[10px] text-slate-500">
          Mostrando todos los pagos pendientes, ordenados por vencimiento.
        </Text>
      )}
      <Text className="mb-16 mt-3 text-center text-[10px] text-slate-500">
        Toca un pago para ver sus detalles.
      </Text>
    </ScrollView>
  );
}
function status(item: CreditInstallment) {
  if (processingAmount(item) > 0 && !item.paid)
    return {
      label: "En proceso",
      box: "bg-amber-100",
      text: "text-amber-700",
      dot: "#d97706",
    };
  if (item.paid)
    return {
      label: "Pagada",
      box: "bg-emerald-100",
      text: "text-emerald-700",
      dot: "#059669",
    };
  const today = localDateKey(new Date());
  if (item.dueDate < today)
    return {
      label: "Vencida",
      box: "bg-rose-100",
      text: "text-rose-700",
      dot: "#e11d48",
    };
  const days = Math.ceil(
    (new Date(`${item.dueDate}T12:00:00`).getTime() - Date.now()) / 86400000,
  );
  if (days <= 7)
    return {
      label: "Próxima",
      box: "bg-amber-100",
      text: "text-amber-700",
      dot: "#d97706",
    };
  return {
    label: "Pendiente",
    box: "bg-sky-100",
    text: "text-sky-700",
    dot: "#0284c7",
  };
}
function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function paymentDateKey(value: string) {
  return localDateKey(new Date(value));
}
function confirmedPaymentsInMonth(item: CreditInstallment, monthKey: string) {
  return (item.payments ?? []).filter(
    (payment) =>
      payment.status === "confirmed" &&
      paymentDateKey(payment.createdAt).startsWith(monthKey),
  );
}
function paidDuringMonth(item: CreditInstallment, monthKey: string) {
  const records = confirmedPaymentsInMonth(item, monthKey);
  if (records.length)
    return records.reduce((sum, payment) => sum + payment.amount, 0);
  return item.paidAt && paymentDateKey(item.paidAt).startsWith(monthKey)
    ? confirmedPaidAmount(item)
    : 0;
}
function paidDuringDate(item: CreditInstallment, dateKey: string) {
  const records = (item.payments ?? []).filter(
    (payment) =>
      payment.status === "confirmed" &&
      paymentDateKey(payment.createdAt) === dateKey,
  );
  if (records.length)
    return records.reduce((sum, payment) => sum + payment.amount, 0);
  return item.paidAt && paymentDateKey(item.paidAt) === dateKey
    ? confirmedPaidAmount(item)
    : 0;
}
function calendarEvents(
  items: CreditInstallment[],
  purchases: Map<string, { createdAt: string }>,
  datesConfigured: boolean,
) {
  return items.flatMap((item) => {
    const payments = (item.payments ?? [])
      .filter((payment) => payment.status === "confirmed")
      .map((payment) => ({
        item,
        date: paymentDateKey(payment.createdAt),
        kind: "payment" as const,
      }));
    if (!payments.length && item.paid && item.paidAt) {
      payments.push({
        item,
        date: paymentDateKey(item.paidAt),
        kind: "payment" as const,
      });
    }
    const purchase = purchases.get(item.purchaseId);
    const purchaseEvent =
      !item.paid && item.number === 1 && purchase?.createdAt
        ? [
            {
              item,
              date: paymentDateKey(purchase.createdAt),
              kind: "purchase" as const,
            },
          ]
        : [];
    return item.paid
      ? payments
      : [
          ...purchaseEvent,
          ...payments,
          ...(datesConfigured && item.dueDate
            ? [{ item, date: item.dueDate, kind: "due" as const }]
            : []),
        ];
  });
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
function formatDueDate(dueDate: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(`${dueDate}T12:00:00`))
    .replaceAll(".", "");
}
function Summary({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "amber" | "emerald" | "rose";
}) {
  const box =
    color === "amber"
      ? "border-amber-300 bg-amber-50"
      : color === "emerald"
        ? "border-emerald-300 bg-emerald-50"
        : "border-rose-300 bg-rose-50";
  const text =
    color === "amber"
      ? "text-amber-700"
      : color === "emerald"
        ? "text-emerald-700"
        : "text-rose-700";
  return (
    <View className={`flex-1 rounded-xl border px-3 py-2 shadow-sm ${box}`}>
      <Text className={`text-[10px] font-bold ${text}`}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        className={`font-extrabold ${text}`}
      >
        {value}
      </Text>
    </View>
  );
}

function FilterButton({
  active,
  label,
  count,
  onPress,
  tone,
}: {
  active: boolean;
  label: string;
  count: number;
  onPress: () => void;
  tone: "teal" | "cyan" | "emerald" | "amber" | "rose";
}) {
  const activeBox =
    tone === "teal"
      ? "bg-teal-600"
      : tone === "cyan"
        ? "bg-cyan-600"
        : tone === "emerald"
          ? "bg-emerald-600"
          : tone === "amber"
            ? "bg-amber-500"
            : "bg-rose-600";
  const idleText =
    tone === "teal"
      ? "text-teal-800"
      : tone === "cyan"
        ? "text-cyan-800"
        : tone === "emerald"
          ? "text-emerald-700"
          : tone === "amber"
            ? "text-amber-700"
            : "text-rose-700";
  const idleCount =
    tone === "teal"
      ? "bg-teal-100 text-teal-800"
      : tone === "cyan"
        ? "bg-cyan-100 text-cyan-800"
        : tone === "emerald"
          ? "bg-emerald-100 text-emerald-800"
          : tone === "amber"
            ? "bg-amber-100 text-amber-800"
            : "bg-rose-100 text-rose-800";
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 items-center rounded-lg py-2 ${active ? activeBox : "bg-transparent"}`}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className={`text-[10px] font-extrabold ${active ? "text-white" : idleText}`}
      >
        {label}
      </Text>
      {count > 0 && (
        <View
          className={`mt-1 min-w-5 rounded-full px-1 ${active ? "bg-white/25" : idleCount.split(" ")[0]}`}
        >
          <Text
            className={`text-center text-[9px] font-extrabold ${active ? "text-white" : idleCount.split(" ")[1]}`}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

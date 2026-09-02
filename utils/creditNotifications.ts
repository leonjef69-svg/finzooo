import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { CreditState } from "@/utils/creditStore";
import { currencySymbolFor } from "@/constants/currencies";

const MARK = "creditPayments";
const CHANNEL = "finzo-credit-payments-v1";

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function cutReminderDates(
  card: CreditState["cards"][number],
  nowDate = new Date(),
  count = 6,
) {
  if (!card.closingDay || count <= 0) return [];
  const [hour, minute] = (card.cutReminderTime ?? "09:00")
    .split(":")
    .map(Number);
  const dates: { cutDate: Date; notificationDate: Date }[] = [];
  for (
    let monthOffset = 0;
    monthOffset < count + 2 && dates.length < count;
    monthOffset += 1
  ) {
    const monthStart = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth() + monthOffset,
      1,
    );
    const lastDay = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    ).getDate();
    const cutDate = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth(),
      Math.min(card.closingDay, lastDay),
      12,
    );
    const notificationDate = new Date(cutDate);
    notificationDate.setDate(
      notificationDate.getDate() - (card.cutReminderDaysBefore ?? 2),
    );
    notificationDate.setHours(hour || 0, minute || 0, 0, 0);
    if (notificationDate.getTime() > nowDate.getTime())
      dates.push({ cutDate, notificationDate });
  }
  return dates;
}

function outstandingAmount(
  installment: CreditState["installments"][number],
) {
  const paid = installment.payments?.length
    ? installment.payments
        .filter((payment) => payment.status === "confirmed")
        .reduce((sum, payment) => sum + payment.amount, 0)
    : installment.paid
      ? installment.amount
      : 0;
  return Math.max(0, installment.amount - paid);
}

let queue: Promise<void> = Promise.resolve();

export function syncCreditNotifications(state: CreditState) {
  queue = queue.then(() => sync(state)).catch(() => undefined);
  return queue;
}

async function sync(state: CreditState) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.[MARK])
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier,
      );
  }

  const enabledCards = state.cards.filter((card) => card.reminderEnabled);
  const cutEnabledCards = state.cards.filter(
    (card) => card.cutReminderEnabled && card.closingDay,
  );
  if (!enabledCards.length && !cutEnabledCards.length) return;
  const pending = state.installments
    .filter(
      (installment) =>
        !installment.paid &&
        outstandingAmount(installment) > 0 &&
        enabledCards.some((card) => card.id === installment.cardId),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 36);

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Pagos de tarjetas",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const now = Date.now();
  const cutCandidates = cutEnabledCards
    .flatMap((card) =>
      cutReminderDates(card, new Date(now)).map((dates) => ({
        card,
        ...dates,
      })),
    )
    .sort(
      (a, b) =>
        a.notificationDate.getTime() - b.notificationDate.getTime(),
    )
    .slice(0, 12);

  for (const candidate of cutCandidates) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Corte próximo · ${candidate.card.bank}`,
        body: `Tu tarjeta corta el ${localDateKey(candidate.cutDate)}.`,
        sound: "default",
        data: {
          [MARK]: true,
          kind: "credit-cut",
          cardId: candidate.card.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: Platform.OS === "android" ? CHANNEL : undefined,
        date: candidate.notificationDate,
      },
    });
  }

  for (const installment of pending) {
    const card = state.cards.find((item) => item.id === installment.cardId);
    if (!card) continue;
    const purchase = state.purchases.find(
      (item) => item.id === installment.purchaseId,
    );
    const [hour, minute] = (card.reminderTime ?? "09:00")
      .split(":")
      .map(Number);
    const notificationDate = new Date(`${installment.dueDate}T12:00:00`);
    notificationDate.setDate(
      notificationDate.getDate() - (card.reminderDaysBefore ?? 2),
    );
    notificationDate.setHours(hour || 0, minute || 0, 0, 0);
    if (notificationDate.getTime() <= now) continue;
    const symbol = currencySymbolFor(card.currency ?? "PEN");
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Próximo pago · ${card.bank}`,
        body: `${purchase?.description ?? "Compra"}: ${symbol} ${outstandingAmount(installment).toFixed(2)} vence el ${installment.dueDate}${card.paymentCutoffTime ? ` antes de ${card.paymentCutoffTime}` : ""}.`,
        sound: "default",
        data: {
          [MARK]: true,
          cardId: card.id,
          purchaseId: installment.purchaseId,
          installmentId: installment.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: Platform.OS === "android" ? CHANNEL : undefined,
        date: notificationDate,
      },
    });
  }
}

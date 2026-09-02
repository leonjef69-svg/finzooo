import type {
  CreditInstallment,
  CreditPurchase,
} from "@/utils/creditStore";

export type CreditCalendarEvent = {
  item: CreditInstallment;
  date: string;
  kind: "purchase" | "payment" | "due";
};

export function creditLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function creditTimestampDateKey(value: string) {
  return creditLocalDateKey(new Date(value));
}

/**
 * Mantiene separados los tres hechos que enseña el calendario: cuándo se hizo
 * la compra, cuándo vence y cuándo se pagó. Pagar una cuota no puede borrar la
 * fecha histórica en la que se realizó la compra.
 */
export function buildCreditCalendarEvents(
  items: CreditInstallment[],
  purchases: Map<string, Pick<CreditPurchase, "createdAt">>,
) {
  const events: CreditCalendarEvent[] = [];

  for (const item of items) {
    for (const payment of item.payments ?? []) {
      if (payment.status !== "confirmed") continue;
      events.push({
        item,
        date: creditTimestampDateKey(payment.createdAt),
        kind: "payment",
      });
    }
    if (!(item.payments ?? []).some((payment) => payment.status === "confirmed") && item.paid && item.paidAt) {
      events.push({
        item,
        date: creditTimestampDateKey(item.paidAt),
        kind: "payment",
      });
    }
    if (!item.paid && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) {
      events.push({ item, date: item.dueDate, kind: "due" });
    }
  }

  const installmentsByPurchase = new Map<string, CreditInstallment[]>();
  for (const item of items) {
    const group = installmentsByPurchase.get(item.purchaseId) ?? [];
    group.push(item);
    installmentsByPurchase.set(item.purchaseId, group);
  }
  for (const [purchaseId, group] of installmentsByPurchase) {
    const purchase = purchases.get(purchaseId);
    if (!purchase?.createdAt) continue;
    const representative =
      group
        .filter((item) => !item.paid)
        .sort((a, b) => a.number - b.number)[0] ??
      [...group].sort((a, b) => a.number - b.number)[0];
    if (!representative) continue;
    events.push({
      item: representative,
      date: creditTimestampDateKey(purchase.createdAt),
      kind: "purchase",
    });
  }

  return events;
}

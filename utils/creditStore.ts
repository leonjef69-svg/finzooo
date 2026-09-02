import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@fino/credit-v1";

export type CreditCardItem = {
  id: string;
  bank: string;
  limit: number;
  currency?: string;
  closingDay?: number;
  paymentDay?: number;
  paymentCutoffTime?: string;
  membershipMonthlyGoal?: number;
  membershipStartDate?: string;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  reminderTime?: string;
  cutReminderEnabled?: boolean;
  cutReminderDaysBefore?: number;
  cutReminderTime?: string;
  statementMinimumPayment?: number;
  color: string;
};

export type CreditPurchase = {
  id: string;
  cardId: string;
  description: string;
  total: number;
  installments: number;
  createdAt: string;
  balanceMode?: "fino" | "separate";
};

export type CreditInstallment = {
  id: string;
  purchaseId: string;
  cardId: string;
  number: number;
  total: number;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidAt?: string;
  paidMethod?: string;
  homeTransactionId?: number;
  homeCurrency?: string;
  homeAmount?: number;
  payments?: CreditPaymentRecord[];
};

export type CreditPaymentRecord = {
  id: string;
  amount: number;
  status: "confirmed" | "legacy-pending";
  createdAt: string;
  method: string;
  homeTransactionId?: number;
  homeCurrency?: string;
  homeAmount?: number;
};

export type CreditState = {
  cards: CreditCardItem[];
  purchases: CreditPurchase[];
  installments: CreditInstallment[];
};

export const EMPTY_CREDIT_STATE: CreditState = {
  cards: [],
  purchases: [],
  installments: [],
};

type StoredPaymentRecord = Omit<CreditPaymentRecord, "status"> & {
  status?: string;
};

type StoredInstallment = Omit<CreditInstallment, "payments"> & {
  payments?: StoredPaymentRecord[];
};

type StoredCreditState = Partial<Omit<CreditState, "installments">> & {
  installments?: StoredInstallment[];
};

/**
 * Conserva internamente cualquier estado antiguo distinto de "confirmed" sin
 * contarlo como pago. No aparece como una función disponible ni se convierte
 * en pago: la deuda queda pendiente hasta registrar uno realmente confirmado.
 */
export function normalizeCreditState(value: unknown): CreditState {
  const stored =
    value && typeof value === "object" ? (value as StoredCreditState) : {};
  const installments = (stored.installments ?? []).map((item) => {
    if (!item.payments?.some((payment) => payment.status !== "confirmed"))
      return item as CreditInstallment;

    const payments: CreditPaymentRecord[] = item.payments.map((payment) => ({
      ...payment,
      status:
        payment.status === "confirmed" ? "confirmed" : "legacy-pending",
    }));
    const confirmedPayments = payments.filter(
      (payment) => payment.status === "confirmed",
    );
    const confirmed = confirmedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const paid = confirmed >= Number(item.amount) - 0.005;
    const latest = [...confirmedPayments].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )[confirmedPayments.length - 1];

    return {
      ...item,
      payments,
      paid,
      paidAt: paid ? latest?.createdAt : undefined,
      paidMethod: latest?.method ?? item.paidMethod,
      homeTransactionId: latest?.homeTransactionId ?? item.homeTransactionId,
      homeCurrency: latest?.homeCurrency ?? item.homeCurrency,
      homeAmount: latest?.homeAmount ?? item.homeAmount,
    };
  });

  return {
    cards: (stored.cards ?? []).map((card) => ({
      ...card,
      // Las tarjetas anteriores al selector mundial nacieron en soles.
      // Fijarlas evita que cambien si luego cambia la moneda de la cuenta.
      currency: card.currency ?? "PEN",
    })),
    purchases: stored.purchases ?? [],
    installments,
  };
}

export async function loadCreditState(): Promise<CreditState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? normalizeCreditState(JSON.parse(raw)) : EMPTY_CREDIT_STATE;
  } catch {
    return EMPTY_CREDIT_STATE;
  }
}

export async function saveCreditState(state: CreditState) {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
  // Carga las notificaciones solo cuando se guarda una tarjeta. Importarlas al
  // iniciar toda la app rompe builds antiguas que no incluyen ese módulo nativo.
  void import("@/utils/creditNotifications")
    .then(({ syncCreditNotifications }) => syncCreditNotifications(state))
    .catch(() => undefined);
}

export function addMonthsDue(start: Date, months: number, paymentDay?: number) {
  if (!paymentDay) return "";
  const result = new Date(
    start.getFullYear(),
    start.getMonth() + months + 1,
    1,
  );
  const last = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(paymentDay, last));
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

export function dueDateForPurchase(
  purchaseDate: Date,
  installmentIndex: number,
  closingDay?: number,
  paymentDay?: number,
) {
  const afterCut = closingDay != null && purchaseDate.getDate() > closingDay;
  return addMonthsDue(
    purchaseDate,
    installmentIndex + (afterCut ? 1 : 0),
    paymentDay,
  );
}

export function confirmedPaidAmount(item: CreditInstallment) {
  if (item.payments?.length) {
    return item.payments
      .filter((payment) => payment.status === "confirmed")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
  }
  return item.paid ? item.amount : 0;
}

export function outstandingAmount(item: CreditInstallment) {
  return Math.max(0, Number(item.amount) - confirmedPaidAmount(item));
}

/**
 * Mantiene Inicio y las tarjetas sincronizados. Si se borra de Inicio un gasto
 * que representaba un pago de tarjeta, se retira solo ese pago: la compra se
 * conserva y vuelve a quedar pendiente por el saldo que corresponda.
 */
export async function unlinkCreditPaymentsForHomeTransactions(ids: number[]) {
  if (!ids.length) return 0;
  const deletedIds = new Set(ids);
  const state = await loadCreditState();
  let changed = 0;
  const installments = state.installments.map((item) => {
    const linkedInstallment =
      item.homeTransactionId != null && deletedIds.has(item.homeTransactionId);
    const payments = (item.payments ?? []).filter(
      (payment) =>
        payment.homeTransactionId == null ||
        !deletedIds.has(payment.homeTransactionId),
    );
    const removedPayment = payments.length !== (item.payments ?? []).length;
    if (!linkedInstallment && !removedPayment) return item;

    changed += 1;
    const confirmed = payments
      .filter((payment) => payment.status === "confirmed")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const paidAmount = confirmed.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const paid = paidAmount >= Number(item.amount) - 0.005;
    const latest = confirmed[confirmed.length - 1];

    return {
      ...item,
      payments,
      paid,
      paidAt: paid ? latest?.createdAt : undefined,
      paidMethod: latest?.method,
      homeTransactionId: linkedInstallment
        ? latest?.homeTransactionId
        : item.homeTransactionId,
      homeCurrency: linkedInstallment ? latest?.homeCurrency : item.homeCurrency,
      homeAmount: linkedInstallment ? latest?.homeAmount : item.homeAmount,
    };
  });

  if (changed > 0) await saveCreditState({ ...state, installments });
  return changed;
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function cardHasFinancialActivity(
  state: CreditState,
  cardId: string,
) {
  return (
    state.purchases.some((purchase) => purchase.cardId === cardId) ||
    state.installments.some((installment) => installment.cardId === cardId)
  );
}

export function cardTotals(state: CreditState, cardId: string) {
  const pending = state.installments.filter(
    (i) => i.cardId === cardId && !i.paid,
  );
  const debt = pending.reduce((sum, i) => sum + outstandingAmount(i), 0);
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const monthPayment = pending
    .filter((i) => i.dueDate.startsWith(month))
    .reduce((sum, i) => sum + outstandingAmount(i), 0);
  const next = pending
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return { debt, monthPayment, next };
}

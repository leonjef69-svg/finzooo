import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadJSON, saveJSONNow, STORAGE_KEYS } from "@/utils/storage";

const LEGACY_KEY = "@fino/credit-v1";

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
  /** Moneda real en la que el banco registró esta compra. */
  currency?: string;
  installments: number;
  createdAt: string;
  balanceMode?: "fino" | "separate";
  icon?: "shopping" | "service" | "food";
};

export type CreditInstallment = {
  id: string;
  purchaseId: string;
  cardId: string;
  number: number;
  total: number;
  amount: number;
  /** Moneda de la deuda. No necesariamente coincide con la del límite. */
  currency?: string;
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

type CreditEntityTimes = {
  cards: Record<string, number>;
  purchases: Record<string, number>;
  installments: Record<string, number>;
};

/** Formato versionado que viaja tanto al disco cifrado como a Firebase. */
export type CreditBackupV1 = {
  version: 1;
  updatedAt: number;
  state: CreditState;
  changedAt: CreditEntityTimes;
  deletedAt: CreditEntityTimes;
};

const EMPTY_ENTITY_TIMES = (): CreditEntityTimes => ({
  cards: {},
  purchases: {},
  installments: {},
});

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
  const cards = (stored.cards ?? []).map((card) => ({
    ...card,
    // Las tarjetas anteriores al selector mundial nacieron en soles.
    currency: card.currency ?? "PEN",
  }));
  const cardCurrencies = new Map(cards.map((card) => [card.id, card.currency ?? "PEN"]));
  const purchases = (stored.purchases ?? []).map((purchase) => ({
    ...purchase,
    // Los datos antiguos sí usaban la moneda única de la tarjeta.
    currency: purchase.currency ?? cardCurrencies.get(purchase.cardId) ?? "PEN",
  }));
  const purchaseCurrencies = new Map(
    purchases.map((purchase) => [purchase.id, purchase.currency ?? "PEN"]),
  );
  const installments = (stored.installments ?? []).map((storedItem) => {
    const item = {
      ...storedItem,
      currency:
        storedItem.currency ??
        purchaseCurrencies.get(storedItem.purchaseId) ??
        cardCurrencies.get(storedItem.cardId) ??
        "PEN",
    };
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
    const paid = confirmed >= Number(item.amount) - 1e-9;
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
    cards,
    purchases,
    installments,
  };
}

function isBackup(value: unknown): value is CreditBackupV1 {
  const candidate = value as Partial<CreditBackupV1> | null;
  return Boolean(
    candidate &&
      candidate.version === 1 &&
      candidate.state &&
      candidate.changedAt &&
      candidate.deletedAt,
  );
}

function backupFromState(state: CreditState, updatedAt = Date.now()): CreditBackupV1 {
  const changedAt = EMPTY_ENTITY_TIMES();
  for (const card of state.cards) changedAt.cards[card.id] = updatedAt;
  for (const purchase of state.purchases) changedAt.purchases[purchase.id] = updatedAt;
  for (const installment of state.installments)
    changedAt.installments[installment.id] = updatedAt;
  return {
    version: 1,
    updatedAt,
    state: normalizeCreditState(state),
    changedAt,
    deletedAt: EMPTY_ENTITY_TIMES(),
  };
}

function changedEntityTimes<T extends { id: string }>(
  previous: T[],
  next: T[],
  previousChanged: Record<string, number>,
  previousDeleted: Record<string, number>,
  now: number,
) {
  const before = new Map(previous.map((item) => [item.id, item]));
  const after = new Map(next.map((item) => [item.id, item]));
  const changed = { ...previousChanged };
  const deleted = { ...previousDeleted };
  for (const item of next) {
    const old = before.get(item.id);
    if (!old || JSON.stringify(old) !== JSON.stringify(item)) changed[item.id] = now;
    if (deleted[item.id] != null) delete deleted[item.id];
  }
  for (const item of previous) {
    if (!after.has(item.id)) {
      deleted[item.id] = now;
      delete changed[item.id];
    }
  }
  return { changed, deleted };
}

function mergeEntity<T extends { id: string }>(
  local: T[],
  remote: T[],
  localChanged: Record<string, number>,
  remoteChanged: Record<string, number>,
  localDeleted: Record<string, number>,
  remoteDeleted: Record<string, number>,
) {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const ids = new Set([
    ...localMap.keys(),
    ...remoteMap.keys(),
    ...Object.keys(localDeleted),
    ...Object.keys(remoteDeleted),
  ]);
  const result: T[] = [];
  const changed: Record<string, number> = {};
  const deleted: Record<string, number> = {};
  for (const id of ids) {
    const localTime = localChanged[id] ?? 0;
    const remoteTime = remoteChanged[id] ?? 0;
    const changeTime = Math.max(localTime, remoteTime);
    const deleteTime = Math.max(localDeleted[id] ?? 0, remoteDeleted[id] ?? 0);
    if (deleteTime >= changeTime && deleteTime > 0) {
      deleted[id] = deleteTime;
      continue;
    }
    const chosen =
      remoteTime > localTime
        ? remoteMap.get(id)
        : localMap.get(id) ?? remoteMap.get(id);
    if (!chosen) continue;
    result.push(chosen);
    changed[id] = changeTime || Date.now();
  }
  return { result, changed, deleted };
}

export function mergeCreditBackups(
  local: CreditBackupV1,
  remote: CreditBackupV1,
): CreditBackupV1 {
  const cards = mergeEntity(
    local.state.cards,
    remote.state.cards,
    local.changedAt.cards,
    remote.changedAt.cards,
    local.deletedAt.cards,
    remote.deletedAt.cards,
  );
  const purchases = mergeEntity(
    local.state.purchases,
    remote.state.purchases,
    local.changedAt.purchases,
    remote.changedAt.purchases,
    local.deletedAt.purchases,
    remote.deletedAt.purchases,
  );
  const installments = mergeEntity(
    local.state.installments,
    remote.state.installments,
    local.changedAt.installments,
    remote.changedAt.installments,
    local.deletedAt.installments,
    remote.deletedAt.installments,
  );
  return {
    version: 1,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    state: normalizeCreditState({
      cards: cards.result,
      purchases: purchases.result,
      installments: installments.result,
    }),
    changedAt: {
      cards: cards.changed,
      purchases: purchases.changed,
      installments: installments.changed,
    },
    deletedAt: {
      cards: cards.deleted,
      purchases: purchases.deleted,
      installments: installments.deleted,
    },
  };
}

async function loadLocalCreditBackup(): Promise<CreditBackupV1> {
  const stored = await loadJSON<unknown>(STORAGE_KEYS.creditCards, null);
  if (isBackup(stored)) return { ...stored, state: normalizeCreditState(stored.state) };
  if (stored && typeof stored === "object") return backupFromState(normalizeCreditState(stored));

  // Migración única desde la versión que dejaba las tarjetas en texto plano.
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = backupFromState(normalizeCreditState(JSON.parse(legacy)));
      if (await saveJSONNow(STORAGE_KEYS.creditCards, migrated))
        await AsyncStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
  } catch {
    // Un dato viejo dañado no impide abrir el módulo.
  }
  return backupFromState(EMPTY_CREDIT_STATE, 0);
}

export async function loadCreditState(): Promise<CreditState> {
  const local = await loadLocalCreditBackup();
  let backup = local;
  try {
    const { loadCreditCloudBackup, saveCreditCloudBackup } = await import(
      "@/utils/creditCloud"
    );
    const remote = await loadCreditCloudBackup();
    if (remote) {
      backup = mergeCreditBackups(local, remote);
      await saveJSONNow(STORAGE_KEYS.creditCards, backup);
      if (JSON.stringify(backup) !== JSON.stringify(remote))
        void saveCreditCloudBackup(backup);
    } else if (local.updatedAt > 0) {
      void saveCreditCloudBackup(local);
    }
  } catch {
    // Sin internet se usa la copia cifrada del teléfono.
  }
  const state = backup.state;
  // Al abrir el módulo se renueva la ventana de avisos; así no caduca meses
  // después solo porque la persona no volvió a editar la tarjeta.
  void import("@/utils/creditNotifications")
    .then(({ syncCreditNotifications }) => syncCreditNotifications(state))
    .catch(() => undefined);
  return state;
}

export async function saveCreditState(state: CreditState) {
  const previous = await loadLocalCreditBackup();
  const normalized = normalizeCreditState(state);
  const now = Date.now();
  const cards = changedEntityTimes(
    previous.state.cards,
    normalized.cards,
    previous.changedAt.cards,
    previous.deletedAt.cards,
    now,
  );
  const purchases = changedEntityTimes(
    previous.state.purchases,
    normalized.purchases,
    previous.changedAt.purchases,
    previous.deletedAt.purchases,
    now,
  );
  const installments = changedEntityTimes(
    previous.state.installments,
    normalized.installments,
    previous.changedAt.installments,
    previous.deletedAt.installments,
    now,
  );
  const backup: CreditBackupV1 = {
    version: 1,
    updatedAt: now,
    state: normalized,
    changedAt: {
      cards: cards.changed,
      purchases: purchases.changed,
      installments: installments.changed,
    },
    deletedAt: {
      cards: cards.deleted,
      purchases: purchases.deleted,
      installments: installments.deleted,
    },
  };
  const stored = await saveJSONNow(STORAGE_KEYS.creditCards, backup);
  if (!stored) throw new Error("No se pudieron guardar las tarjetas");
  void import("@/utils/creditCloud")
    .then(async ({ loadCreditCloudBackup, saveCreditCloudBackup }) => {
      const remote = await loadCreditCloudBackup();
      const merged = remote ? mergeCreditBackups(backup, remote) : backup;
      if (await saveCreditCloudBackup(merged))
        await saveJSONNow(STORAGE_KEYS.creditCards, merged);
    })
    .catch(() => undefined);
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
  // Si el pago cae DESPUES del corte dentro del mismo mes (por ejemplo,
  // corte 4 y pago 15), la primera fecha de pago pertenece a ese mes. Antes
  // siempre se sumaba un mes y todas esas tarjetas quedaban un ciclo tarde.
  const paymentIsLaterInSameMonth =
    closingDay != null && paymentDay != null && paymentDay > closingDay;
  return addMonthsDue(
    purchaseDate,
    installmentIndex +
      (afterCut ? 1 : 0) -
      (paymentIsLaterInSameMonth ? 1 : 0),
    paymentDay,
  );
}

export function localMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
    const paid = paidAmount >= Number(item.amount) - 1e-9;
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

export function cardTotals(
  state: CreditState,
  cardId: string,
  now = new Date(),
) {
  const pending = state.installments.filter(
    (i) => i.cardId === cardId && !i.paid,
  );
  const card = state.cards.find((item) => item.id === cardId);
  const limitCurrency = card?.currency ?? "PEN";
  const debtsByCurrency: Record<string, number> = {};
  for (const item of pending) {
    const currency = item.currency ?? limitCurrency;
    debtsByCurrency[currency] =
      (debtsByCurrency[currency] ?? 0) + outstandingAmount(item);
  }
  // Solo la deuda en la moneda del límite puede restarse sin inventar un cambio.
  const debt = debtsByCurrency[limitCurrency] ?? 0;
  const month = localMonthKey(now);
  const monthPayment = pending
    .filter(
      (i) =>
        i.dueDate.startsWith(month) &&
        (i.currency ?? limitCurrency) === limitCurrency,
    )
    .reduce((sum, i) => sum + outstandingAmount(i), 0);
  const next = pending
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return { debt, monthPayment, next, debtsByCurrency };
}

export function installmentCurrency(
  item: Pick<CreditInstallment, "currency" | "purchaseId" | "cardId">,
  state: Pick<CreditState, "cards" | "purchases">,
) {
  return (
    item.currency ??
    state.purchases.find((purchase) => purchase.id === item.purchaseId)?.currency ??
    state.cards.find((card) => card.id === item.cardId)?.currency ??
    "PEN"
  );
}

import {
  addMonthsDue,
  cardHasFinancialActivity,
  cardTotals,
  dueDateForPurchase,
  mergeCreditBackups,
  outstandingAmount,
  normalizeCreditState,
  type CreditBackupV1,
  type CreditInstallment,
  type CreditState,
} from "@/utils/creditStore";
import { cutReminderDates } from "@/utils/creditNotifications";

let fallos = 0;
function ok(condition: boolean, message: string) {
  console.log(`  ${condition ? "OK   " : "FALLA"} ${message}`);
  if (!condition) fallos += 1;
}

console.log("\nFechas reales de cuotas");
ok(
  addMonthsDue(new Date(2027, 0, 10), 0, 31) === "2027-02-28",
  "el día 31 se ajusta al último día real de febrero",
);
ok(
  addMonthsDue(new Date(2028, 0, 10), 0, 31) === "2028-02-29",
  "febrero bisiesto conserva el día 29",
);
ok(
  dueDateForPurchase(new Date(2027, 0, 26), 0, 25, 15) === "2027-03-15",
  "una compra posterior al corte pasa al siguiente periodo",
);
ok(
  dueDateForPurchase(new Date(2027, 0, 2), 0, 4, 15) === "2027-01-15",
  "si el pago viene después del corte, una compra previa vence ese mismo mes",
);
ok(
  dueDateForPurchase(new Date(2027, 0, 5), 0, 4, 15) === "2027-02-15",
  "después del corte avanza exactamente un periodo",
);
ok(
  dueDateForPurchase(new Date(2027, 0, 10), 0, 25, undefined) === "",
  "sin último día de pago no se inventa un vencimiento",
);

console.log("\nAvisos antes del corte");
const card = {
  id: "card",
  bank: "Banco",
  limit: 2000,
  color: "#0f766e",
  closingDay: 31,
  cutReminderDaysBefore: 2,
  cutReminderTime: "09:30",
};
const cutDates = cutReminderDates(card, new Date(2027, 0, 1, 8), 2);
ok(
  cutDates[0]?.cutDate.getDate() === 31 &&
    cutDates[0]?.notificationDate.getDate() === 29,
  "enero avisa dos días antes del corte 31",
);
ok(
  cutDates[1]?.cutDate.getMonth() === 1 &&
    cutDates[1]?.cutDate.getDate() === 28 &&
    cutDates[1]?.notificationDate.getDate() === 26,
  "en febrero el corte 31 se ajusta al 28 y avisa el 26",
);
ok(
  cutDates[0]?.notificationDate.getHours() === 9 &&
    cutDates[0]?.notificationDate.getMinutes() === 30,
  "el aviso respeta la hora elegida",
);
ok(
  cutReminderDates({ ...card, closingDay: undefined }, new Date(), 2).length === 0,
  "sin día de corte no se programa ningún aviso falso",
);

console.log("\nPagos parciales y deuda sin fecha");
const installment: CreditInstallment = {
  id: "q1",
  purchaseId: "p1",
  cardId: "card",
  number: 1,
  total: 1,
  amount: 100,
  dueDate: "",
  paid: false,
  payments: [
    { id: "ok", amount: 30, status: "confirmed", createdAt: "2027-01-01", method: "Fino" },
  ],
};
ok(outstandingAmount(installment) === 70, "un pago confirmado reduce correctamente la deuda");
const state: CreditState = {
  cards: [card],
  purchases: [
    { id: "p1", cardId: "card", description: "Compra", total: 100, installments: 1, createdAt: "2027-01-01" },
  ],
  installments: [installment],
};
const totals = cardTotals(state, "card");
ok(totals.debt === 70, "la deuda sigue visible aunque falten las fechas de la tarjeta");
ok(totals.next === undefined, "una compra sin fecha no aparece como vencimiento inventado");
ok(cardHasFinancialActivity(state, "card"), "la moneda se bloquea cuando la tarjeta ya tiene movimientos");
ok(
  !cardHasFinancialActivity({ ...state, purchases: [], installments: [] }, "card"),
  "la moneda puede elegirse mientras la tarjeta no tenga movimientos",
);

const normalized = normalizeCreditState({
  ...state,
  installments: [
    {
      ...installment,
      payments: [
        ...installment.payments!,
        { id: "old", amount: 20, status: "processing", createdAt: "2027-01-02", method: "Fino" },
      ],
    },
  ],
});
ok(
  normalized.installments[0].payments?.length === 2 &&
    normalized.installments[0].payments?.[1]?.status === "legacy-pending" &&
    outstandingAmount(normalized.installments[0]) === 70,
  "un registro antiguo se conserva sin marcarlo como pagado",
);
ok(
  normalized.cards[0].currency === "PEN",
  "una tarjeta antigua sin moneda queda fijada en soles",
);

console.log("\nSincronización entre teléfonos");
const localBackup: CreditBackupV1 = {
  version: 1,
  updatedAt: 30,
  state: { cards: [card], purchases: [], installments: [] },
  changedAt: { cards: { card: 10 }, purchases: {}, installments: {} },
  deletedAt: { cards: {}, purchases: { borrada: 30 }, installments: {} },
};
const remoteBackup: CreditBackupV1 = {
  version: 1,
  updatedAt: 20,
  state: {
    cards: [{ ...card, id: "remote", bank: "Otro banco" }],
    purchases: [
      { id: "borrada", cardId: "remote", description: "Vieja", total: 50, installments: 1, createdAt: "2027-01-01" },
    ],
    installments: [],
  },
  changedAt: { cards: { remote: 20 }, purchases: { borrada: 20 }, installments: {} },
  deletedAt: { cards: {}, purchases: {}, installments: {} },
};
const merged = mergeCreditBackups(localBackup, remoteBackup);
ok(merged.state.cards.length === 2, "las tarjetas de dos teléfonos se conservan");
ok(
  !merged.state.purchases.some((purchase) => purchase.id === "borrada"),
  "un borrado más reciente no reaparece desde otro teléfono",
);

if (fallos) process.exit(1);
console.log("Tarjeta de crédito: fechas, avisos y pagos correctos.");

import {
  addMonthsDue,
  cardTotals,
  dueDateForPurchase,
  outstandingAmount,
  processingAmount,
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
    { id: "wait", amount: 20, status: "processing", createdAt: "2027-01-01", method: "Fino" },
  ],
};
ok(outstandingAmount(installment) === 70, "un pago confirmado reduce correctamente la deuda");
ok(processingAmount(installment) === 20, "un pago en proceso se informa sin descontarlo dos veces");
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

if (fallos) process.exit(1);
console.log("Tarjeta de crédito: fechas, avisos y pagos correctos.");

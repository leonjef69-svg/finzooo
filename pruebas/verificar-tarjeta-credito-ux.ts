import {
  formatCreditMoney,
  formatCreditMoneyCompact,
  parseCreditMoneyInput,
} from "@/utils/creditMoney";
import { membershipProgress } from "@/utils/creditMembership";
import { buildCreditCalendarEvents } from "@/utils/creditCalendar";

let failures = 0;
function ok(condition: boolean, message: string) {
  console.log(`  ${condition ? "OK   " : "FALLA"} ${message}`);
  if (!condition) failures += 1;
}

console.log("\nMontos mundiales de tarjetas");
ok(formatCreditMoney(1234, "JPY") === "¥ 1,234", "JPY no inventa centavos");
ok(formatCreditMoney(1.235, "KWD") === "KWD 1.235", "KWD conserva tres decimales");
ok(
  formatCreditMoneyCompact(1359, "PEN") === "S/ 1,359.00",
  "un monto normal conserva su valor exacto",
);
ok(
  formatCreditMoneyCompact(1_500_000_000, "VES").length <
    formatCreditMoney(1_500_000_000, "VES").length,
  "un monto realmente largo se abrevia",
);
ok(
  parseCreditMoneyInput("1.359,50", "PEN") === 1359.5,
  "acepta el formato decimal usado en varios países",
);
ok(
  parseCreditMoneyInput("1.2.3", "PEN") === null,
  "rechaza separadores inválidos",
);
ok(
  parseCreditMoneyInput("999999999999999999999999", "PEN") === null,
  "rechaza montos que perderían precisión",
);

console.log("\nMeta para evitar membresía");
const progress = membershipProgress(
  [
    { total: 800, createdAt: "2025-02-01T12:00:00" },
    { total: 1200, createdAt: "2026-02-01T12:00:00" },
  ],
  1000,
  "2025-01-15",
  new Date("2026-02-10T12:00:00"),
);
ok(progress?.current === 1200, "el ciclo anual nuevo no mezcla compras del ciclo anterior");
ok(progress?.completed === 1, "la meta cuenta compras por su fecha real");
ok(progress?.excess === 200, "el exceso no se suma como una membresía cobrada");

console.log("\nHistorial del calendario");
const paidItem = {
  id: "quota",
  purchaseId: "purchase",
  cardId: "card",
  number: 1,
  total: 1,
  amount: 100,
  dueDate: "2026-09-15",
  paid: true,
  paidAt: "2026-09-02T10:00:00",
};
const calendarEvents = buildCreditCalendarEvents(
  [paidItem],
  new Map([["purchase", { createdAt: "2026-09-01T10:00:00" }]]),
);
ok(
  calendarEvents.some((event) => event.kind === "purchase" && event.date === "2026-09-01"),
  "pagar no borra del calendario el día histórico de la compra",
);
ok(
  calendarEvents.some((event) => event.kind === "payment" && event.date === "2026-09-02"),
  "el calendario conserva por separado el día del pago",
);

if (failures) process.exit(1);
console.log("Tarjetas: montos y membresía coherentes.");

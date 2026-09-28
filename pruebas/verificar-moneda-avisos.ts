import assert from "node:assert/strict";

import type { PagoProgramado } from "@/utils/calendarioPagos";
import { reprogramarAvisosDePagos } from "@/utils/avisosDePagos";
import { paymentNotificationFormatter } from "@/utils/notificationCurrency";
import {
  cancelledNotificationIds,
  resetNotificationStub,
  scheduledNotifications,
  seedScheduledNotification,
} from "./stubs/notif";

const payment: PagoProgramado = {
  id: "luz",
  nombre: "Luz",
  tipo: "pago",
  monto: 1250.5,
  dia: 20,
  repite: "mensual",
  avisoDiasAntes: 2,
  avisoHora: "09:00",
  pagados: [],
  creado: 1,
};
const translate = (key: string, values?: Record<string, string | number>) =>
  key === "calendario.avisoTitulo"
    ? `Aviso: ${values?.nombre}`
    : `Monto: ${values?.monto ?? ""}`;
const now = new Date(2026, 8, 1, 8, 0, 0);

resetNotificationStub();
seedScheduledNotification({
  identifier: "exportacion-1",
  content: { data: { exportacion: true } },
  trigger: {},
});

const soles = await reprogramarAvisosDePagos(
  [payment],
  translate,
  now,
  paymentNotificationFormatter("PEN"),
);
assert.equal(soles.puestos, 3, "deben programarse tres meses por delante");
assert.equal(scheduledNotifications.length, 4, "el aviso ajeno del exportador debe conservarse");
const bodiesInSoles = scheduledNotifications
  .filter((notification) => notification.content.data.calendarioPagos)
  .map((notification) => notification.content.body);
assert.ok(bodiesInSoles.every((body) => body.includes("S/ 1,250.50")));

const dollars = await reprogramarAvisosDePagos(
  [payment],
  translate,
  now,
  paymentNotificationFormatter("USD"),
);
assert.equal(dollars.puestos, 3);
assert.equal(scheduledNotifications.length, 4, "reprogramar no debe duplicar avisos");
assert.equal(cancelledNotificationIds.length, 3, "los tres avisos anteriores deben retirarse");
assert.ok(scheduledNotifications.some((notification) => notification.identifier === "exportacion-1"));
const bodiesInDollars = scheduledNotifications
  .filter((notification) => notification.content.data.calendarioPagos)
  .map((notification) => notification.content.body);
assert.ok(bodiesInDollars.every((body) => body.includes("US$ 1,250.50")));
assert.ok(bodiesInDollars.every((body) => !body.includes("S/")));

const partiallyPaid = await reprogramarAvisosDePagos(
  [{ ...payment, pagados: ["2026-09"] }],
  translate,
  now,
  paymentNotificationFormatter("USD"),
);
assert.equal(partiallyPaid.puestos, 2, "un mes ya pagado no debe volver a avisarse");
assert.equal(scheduledNotifications.length, 3, "deben quedar dos avisos del calendario y el externo");

const disabled = await reprogramarAvisosDePagos([], translate, now);
assert.equal(disabled.puestos, 0);
assert.deepEqual(
  scheduledNotifications.map((notification) => notification.identifier),
  ["exportacion-1"],
  "quitar los pagos debe retirar solo sus avisos",
);

console.log("Avisos: moneda, pagados, duplicados y cancelación selectiva correctos.");

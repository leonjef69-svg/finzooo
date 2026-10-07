import assert from "node:assert/strict";

import type { PagoProgramado } from "@/utils/calendarioPagos";
import { translations } from "@/constants/i18n";
import { reprogramarAvisosDePagos } from "@/utils/avisosDePagos";
import { paymentNotificationFormatter } from "@/utils/notificationCurrency";
import {
  cancelledNotificationIds,
  resetNotificationStub,
  scheduledNotifications,
  seedScheduledNotification,
  setNotificationPermissions,
  setScheduleDelay,
  setScheduleFailure,
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
    : `Monto: ${values?.monto ?? ""} · vence ${values?.fecha ?? ""}`;
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
assert.ok(scheduledNotifications.some((notification) => notification.content.data?.mes === "2026-09"
  && notification.content.body?.includes("20/09/2026")),
"el aviso del celular incluye día, mes y año del vencimiento");

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

resetNotificationStub();
setNotificationPermissions(false, false);
const denied = await reprogramarAvisosDePagos(
  [payment],
  translate,
  now,
  paymentNotificationFormatter("PEN"),
);
assert.equal(denied.puestos, 0);
assert.equal(denied.fallo, "sin-permiso");
assert.equal(scheduledNotifications.length, 0, "sin permiso no debe fingirse ningún aviso");

resetNotificationStub();
setScheduleFailure("agenda no disponible");
const failed = await reprogramarAvisosDePagos(
  [payment],
  translate,
  now,
  paymentNotificationFormatter("PEN"),
);
assert.equal(failed.puestos, 0);
assert.match(failed.fallo ?? "", /programando Luz/);
assert.match(failed.fallo ?? "", /agenda no disponible/);

resetNotificationStub();
setScheduleDelay(2);
const firstRun = reprogramarAvisosDePagos(
  [payment],
  translate,
  now,
  paymentNotificationFormatter("PEN"),
);
const secondRun = reprogramarAvisosDePagos(
  [payment],
  translate,
  now,
  paymentNotificationFormatter("USD"),
);
const [firstResult, secondResult] = await Promise.all([firstRun, secondRun]);
assert.equal(firstResult.puestos, 3);
assert.equal(secondResult.puestos, 3);
assert.equal(scheduledNotifications.length, 3, "dos reprogramaciones juntas no deben duplicar avisos");
assert.ok(
  scheduledNotifications.every((notification) => notification.content.body.includes("US$")),
  "la última reprogramación debe quedar activa completa",
);

for (const language of ["es", "en", "pt"] as const) {
  for (const key of ["calendario.avisoPago", "calendario.avisoIngreso", "calendario.avisoRecordatorio"]) {
    assert.ok(translations[language][key].includes("{fecha}"), `${language}: ${key} debe mostrar la fecha`);
  }
}
resetNotificationStub();
await reprogramarAvisosDePagos(
  [{ ...payment, tipo: "recordatorio", monto: undefined, dia: 31 }],
  translate,
  new Date(2026, 0, 1, 8),
  paymentNotificationFormatter("PEN"),
);
assert.ok(scheduledNotifications.some((notification) => notification.content.data?.mes === "2026-02"
  && notification.content.body?.includes("28/02/2026")),
"el aviso de un recordatorio del día 31 muestra la fecha real de febrero");

console.log("Avisos: moneda, permisos, fallos y reprogramaciones simultáneas correctos.");

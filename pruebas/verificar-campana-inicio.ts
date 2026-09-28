import assert from "node:assert/strict";
import { summarizeHomeNotifications } from "@/utils/homeNotifications";

const now = 1_000;

assert.deepEqual(
  summarizeHomeNotifications({ hasUrgentPayments: false, hasPendingImport: false, nextScheduledExportAt: 0, now }),
  { hasUrgentNotification: false, hasScheduledExport: false, hasAnythingToShow: false },
);

assert.equal(
  summarizeHomeNotifications({ hasUrgentPayments: true, hasPendingImport: false, nextScheduledExportAt: 0, now }).hasUrgentNotification,
  true,
  "un pago urgente debe encender el indicador",
);

assert.equal(
  summarizeHomeNotifications({ hasUrgentPayments: false, hasPendingImport: true, nextScheduledExportAt: 0, now }).hasUrgentNotification,
  true,
  "una importación pendiente debe encender el indicador",
);

const scheduled = summarizeHomeNotifications({
  hasUrgentPayments: false,
  hasPendingImport: false,
  nextScheduledExportAt: now + 60_000,
  now,
});
assert.equal(scheduled.hasScheduledExport, true, "la próxima exportación debe aparecer en el panel");
assert.equal(scheduled.hasAnythingToShow, true, "el panel no debe verse vacío si hay una exportación programada");
assert.equal(scheduled.hasUrgentNotification, false, "una exportación futura no es una alerta urgente");

console.log("La campana distingue avisos urgentes de información programada");

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  mergeSeenHomeNotificationIds,
  shouldNotifyAutomaticExportResult,
  shouldShowHomeExportResult,
  summarizeHomeNotifications,
  unreadHomeNotificationIds,
} from "@/utils/homeNotifications";

assert.deepEqual(
  summarizeHomeNotifications({ hasUrgentPayments: false, hasPendingImport: false, hasExportResult: false }),
  { hasUrgentNotification: false, hasAnythingToShow: false },
);

assert.equal(
  summarizeHomeNotifications({ hasUrgentPayments: true, hasPendingImport: false, hasExportResult: false }).hasUrgentNotification,
  true,
  "un pago urgente debe encender el indicador",
);

assert.equal(
  summarizeHomeNotifications({ hasUrgentPayments: false, hasPendingImport: true, hasExportResult: false }).hasUrgentNotification,
  true,
  "una importación pendiente debe encender el indicador",
);

const exportada = summarizeHomeNotifications({
  hasUrgentPayments: false,
  hasPendingImport: false,
  hasExportResult: true,
});
assert.equal(exportada.hasAnythingToShow, true, "el resultado real de una exportación debe aparecer en la campana");
assert.equal(exportada.hasUrgentNotification, false, "el resultado informativo no se pinta como urgencia");
assert.equal(shouldShowHomeExportResult("hecho", true), true, "una exportación automática guardada se informa");
assert.equal(shouldShowHomeExportResult("error", true), true, "un fallo automático real se informa");
assert.equal(shouldShowHomeExportResult("sin-movimientos", true), true, "también se explica si no se creó archivo por falta de movimientos");
assert.equal(shouldShowHomeExportResult("hecho", false), false, "probar ahora no se confunde con una exportación programada");
assert.equal(shouldShowHomeExportResult("hecho", undefined), false, "un resultado antiguo sin origen no se anuncia como recién programado");
assert.equal(shouldShowHomeExportResult("apagado", true), false, "apagar la función no genera una notificación de exportación");
assert.equal(shouldShowHomeExportResult("no-toca-hoy", true), false, "un día sin ejecución no genera una notificación");
assert.equal(shouldShowHomeExportResult("ya-se-hizo-hoy", true), false, "un intento duplicado no genera otra notificación");

assert.deepEqual(
  unreadHomeNotificationIds([
    { id: "pago-hoy", arrivedAt: 100 },
    { id: "pago-futuro", arrivedAt: 300 },
    { id: "export-visto", arrivedAt: 80 },
    { id: "export-visto", arrivedAt: 80 },
  ], ["export-visto"], 200),
  ["pago-hoy"],
  "solo cuentan avisos que ya llegaron y que la persona no abrió",
);
assert.deepEqual(
  mergeSeenHomeNotificationIds(["a", "b"], ["b", "c"]),
  ["a", "b", "c"],
  "abrir el buzón marca cada aviso una sola vez sin resolver su pago",
);
assert.equal(shouldNotifyAutomaticExportResult("hecho", true), true, "el éxito automático avisa al celular");
assert.equal(shouldNotifyAutomaticExportResult("error", true), true, "el fallo automático también avisa");
assert.equal(shouldNotifyAutomaticExportResult("hecho", false), false, "Probar ahora no manda un aviso de llegada");
assert.equal(shouldNotifyAutomaticExportResult("no-toca-hoy", true), false, "un día sin exportación no avisa");

const home = fs.readFileSync(path.join(process.cwd(), "screens/Home.tsx"), "utf8");
assert.match(home, /fmt\(pago\.monto\)/, "la notificación del calendario incluye el monto");
assert.match(home, /fechaEnElMes\(pago, mes\)/, "la notificación muestra la fecha real del vencimiento");
assert.match(home, /setAvisoCalendarioSeleccionado\(/, "tocar un vencimiento abre su ficha de acciones");
assert.match(home, /marcarPagoDelMes\(pago\.id, mes, true\)/, "la acción marca el mes y registra el movimiento con la lógica existente");
assert.match(home, /exportacionVisible\.archivo/, "el resultado de exportación puede identificar el archivo guardado");
assert.match(home, /visible=\{avisosAbiertos\}/, "la campana abre una hoja inferior con su lista");
assert.match(home, /animationType="slide"/, "la lista se desliza desde abajo");
assert.match(home, /mergeSeenHomeNotificationIds\(avisosVistos, idsNoLeidos\)/, "ver el buzón quita el indicador sin marcar los pagos como realizados");
assert.match(home, /withTiming\(-15/, "la campana vibra brevemente al llegar avisos nuevos");
assert.doesNotMatch(home, /proximaExportacion > Date\.now\(\)/, "una exportación futura no aparece como si ya hubiera llegado");

const exportacionFondo = fs.readFileSync(path.join(process.cwd(), "utils/exportarEnFondo.ts"), "utf8");
assert.match(exportacionFondo, /scheduleNotificationAsync/, "el resultado de la exportación genera una notificación del celular");
assert.match(exportacionFondo, /screen: "export-result"/, "tocar el aviso del celular lleva al resultado de exportación");
const ajustesExportacion = fs.readFileSync(path.join(process.cwd(), "screens/ScheduledExportSettings.tsx"), "utf8");
assert.match(ajustesExportacion, /notifyAtScheduledTime: !saldraSolo/, "la exportación automática no avisa antes de conocer el resultado");

console.log("La campana anima y cuenta avisos nuevos, muestra la bandeja inferior y anuncia el resultado de exportación");

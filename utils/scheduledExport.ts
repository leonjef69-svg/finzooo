// Exportaciones programadas: diaria, semanal o mensual.
//
// LO QUE SE PUEDE Y LO QUE NO
//
// Lo que uno esperaría de "exportación automática" es que a la hora fijada
// el celular arme el PDF y lo mande al correo solo, con la app cerrada. Eso
// NO se puede hacer desde una app de Android sin un servidor detrás, y no es
// por falta de ganas:
//
//   1. El PDF se arma en un WebView (expo-print). Un WebView necesita que la
//      app esté abierta y en pantalla; con la app cerrada no hay dónde
//      dibujar y no sale ningún archivo.
//   2. Mandar un correo abre la aplicación de correo, que es otra app. Nadie
//      puede abrirla y darle a enviar mientras el dueño del celular duerme.
//   3. Android mata los procesos en segundo plano cuando quiere, y los
//      Honor y Xiaomi son de los más agresivos. Aunque los dos puntos de
//      arriba se resolvieran, la tarea no se ejecutaría de forma fiable.
//
// Así que esto hace lo que sí se puede y funciona siempre: a la hora fijada
// llega un aviso al celular, y al tocarlo se abre la pantalla de exportar con
// el mes, el formato y el destino ya puestos. Queda un toque, no seis.
//
// Y hay un caso donde sí es completamente automático: si el destino es
// Drive, al abrir la app se sube el archivo solo, sin ventanas ni toques.
// Drive es el único destino que no necesita que nadie elija nada.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { loadJSON, saveJSON } from "@/utils/storage";
import { isDecoyActive } from "@/utils/decoyMode";

export type ExportFrequency = "off" | "daily" | "weekly" | "monthly";
export type ExportDestination = "share" | "mail" | "drive";
export type ExportFormat = "pdf" | "csv";
export type ExportType = "all" | "expense" | "income";

export type ScheduledExport = {
  frequency: ExportFrequency;
  /** Hora del día, 0..23. */
  hour: number;
  minute: number;
  /** Día de la semana para "weekly": 1 = domingo … 7 = sábado (lo que pide expo-notifications). */
  weekday: number;
  /** Día del mes para "monthly", 1..28. Se corta en 28 a propósito, ver abajo. */
  day: number;
  format: ExportFormat;
  type: ExportType;
  destination: ExportDestination;
  /** "AAAA-MM-DD" de la última vez que se subió sola a Drive. Evita repetir. */
  lastAutoRun?: string;
};

export const DEFAULT_SCHEDULE: ScheduledExport = {
  frequency: "off",
  hour: 9,
  minute: 0,
  weekday: 2, // lunes
  day: 1,
  format: "pdf",
  type: "all",
  destination: "share",
};

const STORAGE_KEY = "finzo:scheduledExport";

// Todos los avisos de exportación llevan esta marca para poder cancelar solo
// los nuestros. Cancelar todos los avisos programados se llevaría por delante
// los de otras partes de la app que puedan existir mañana.
const TAG = "finzo-export";

export async function loadSchedule(): Promise<ScheduledExport> {
  const saved = await loadJSON<Partial<ScheduledExport>>(STORAGE_KEY, {});
  return { ...DEFAULT_SCHEDULE, ...saved };
}

export function saveSchedule(schedule: ScheduledExport): void {
  saveJSON(STORAGE_KEY, schedule);
}

/**
 * El día más alto que se puede elegir para la programación mensual.
 *
 * Se corta en 28 porque febrero tiene 28 días. Si se dejara elegir el 31, en
 * febrero, abril, junio, septiembre y noviembre ese día no existe y el aviso
 * simplemente no llegaría — sin error, sin señal, nada. La persona creería
 * que tiene un reporte mensual y le faltarían cinco meses al año.
 */
export const MAX_MONTH_DAY = 28;

async function cancelOurs(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => n.content.data?.tag === TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/**
 * Deja programado el aviso según los ajustes. Cancela el anterior siempre,
 * incluso si la frecuencia queda en "off": así apagarlo apaga de verdad.
 *
 * Devuelve false si no se pudo (permiso denegado). Quien llame debe avisar,
 * no dejarlo pasar en silencio: si no, se queda esperando un aviso que nunca
 * va a llegar.
 */
export async function applySchedule(
  schedule: ScheduledExport,
  texts: { title: string; body: string }
): Promise<boolean> {
  // Dentro del modo señuelo no se toca nada. Programar un aviso desde la
  // cuenta falsa dejaría rastro de la real —o al revés— y además el aviso
  // sobreviviría a salir del señuelo.
  if (isDecoyActive()) return false;

  await cancelOurs();
  if (schedule.frequency === "off") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("finzo-export", {
      name: texts.title,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const content = {
    title: texts.title,
    body: texts.body,
    data: { tag: TAG, screen: "export" as const },
  };

  const { hour, minute } = schedule;
  // El canal va DENTRO del disparador, no al lado del contenido. Puesto
  // fuera, TypeScript lo acepta como propiedad de más y Android lo ignora:
  // el aviso se programa igual pero sin canal, y en Android 8 en adelante un
  // aviso sin canal no suena ni aparece.
  const channelId = Platform.OS === "android" ? "finzo-export" : undefined;
  const trigger =
    schedule.frequency === "daily"
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY as const, channelId, hour, minute }
      : schedule.frequency === "weekly"
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY as const,
          channelId,
          weekday: schedule.weekday,
          hour,
          minute,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY as const,
          channelId,
          day: Math.min(schedule.day, MAX_MONTH_DAY),
          hour,
          minute,
        };

  await Notifications.scheduleNotificationAsync({ content, trigger });
  return true;
}

/**
 * ¿Toca subir sola la copia a Drive?
 *
 * Solo aplica al destino Drive, que es el único que no necesita que nadie
 * elija nada. Se comprueba al abrir la app, no en segundo plano, porque en
 * segundo plano no se puede armar el PDF.
 *
 * `lastAutoRun` guarda el día en que se hizo la última para no repetirla cada
 * vez que se abre la app. Se compara por fecha y no por hora: abrir la app
 * cinco veces el mismo día tiene que dar una sola subida.
 */
export function isAutoRunDue(schedule: ScheduledExport, now: Date): boolean {
  if (schedule.frequency === "off") return false;
  if (schedule.destination !== "drive") return false;

  const today = toDateKey(now);
  if (schedule.lastAutoRun === today) return false;

  // Antes de la hora fijada todavía no toca, aunque el día sea el correcto.
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (minutesNow < schedule.hour * 60 + schedule.minute) return false;

  if (schedule.frequency === "daily") return true;
  // getDay() da 0..6 empezando en domingo; weekday guarda 1..7 empezando en
  // domingo, que es lo que pide expo-notifications. De ahí el +1.
  if (schedule.frequency === "weekly") return now.getDay() + 1 === schedule.weekday;
  return now.getDate() === Math.min(schedule.day, MAX_MONTH_DAY);
}

// Cuándo se entregó el último aviso que ya se atendió.
//
// Hace falta porque getLastNotificationResponseAsync() no olvida: devuelve el
// último aviso tocado SIEMPRE, también tres días después y aunque la app se
// abra normalmente desde el icono. Sin esto, tocar el recordatorio del lunes
// haría que la pantalla de exportar saltara sola cada vez que se abre Finzo
// el resto de la semana.
//
// Se guarda la FECHA DE ENTREGA y no el identificador del aviso: un aviso que
// se repite conserva el mismo identificador en todas sus entregas, así que
// con el identificador no habría forma de distinguir el del lunes del
// del martes. La fecha de entrega sí cambia cada vez.
const KEY_LAST_TAP = "finzo:scheduledExport.lastTap";

export async function alreadyHandledTap(deliveredAt: number): Promise<boolean> {
  const last = await loadJSON<number>(KEY_LAST_TAP, 0);
  return deliveredAt <= last;
}

export function markTapHandled(deliveredAt: number): void {
  saveJSON(KEY_LAST_TAP, deliveredAt);
}

export function toDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Qué mes debe llevar el reporte programado.
 *
 * Un reporte mensual que llega el día 1 tiene que traer el mes que TERMINÓ,
 * no el que acaba de empezar: el día 1 el mes en curso está vacío y saldría
 * una hoja sin movimientos. Los reportes diarios y semanales sí miran el mes
 * en curso, que es lo que se está llenando.
 */
export function monthForSchedule(schedule: ScheduledExport, now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  if (schedule.frequency === "monthly") d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

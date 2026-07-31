// Recordatorio de exportación: diario, semanal, mensual o personalizado.
//
// EL NOMBRE ES LO QUE HACE, Y ES A PROPÓSITO
//
// Antes se llamaba "exportación automática" y no lo era. Lo que uno esperaría
// con ese nombre es que a la hora fijada el celular arme el PDF y lo mande al
// correo solo, con la app cerrada. Eso NO se puede hacer desde una app de
// Android sin un servidor detrás, y no es por falta de ganas:
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
// Prometer "automático" y entregar esto es la forma más rápida de ganarse una
// reseña de una estrella. Así que se llama recordatorio, que es lo que es: a
// la hora fijada llega un aviso, y al tocarlo se abre la pantalla de exportar
// con el mes, el formato, el destino y hasta el nombre del archivo ya
// puestos. Queda un toque, no seis.
//
// Con un destino sí es casi automático: Drive. Es el único que no necesita
// que nadie elija a quién mandar el archivo, así que la copia se sube sola la
// primera vez que se abra la app pasada la hora.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { loadJSON, saveJSON } from "@/utils/storage";
import { isDecoyActive } from "@/utils/decoyMode";

export type ExportFrequency = "daily" | "weekly" | "monthly" | "custom";
export type ExportDestination = "share" | "mail" | "gmail" | "drive";
export type ExportFormat = "pdf" | "csv";
export type ExportType = "all" | "expense" | "income";
export type FileNameMode = "auto" | "custom";

export type ScheduledExport = {
  /** El interruptor principal. Apagado, no hay ningún aviso programado. */
  enabled: boolean;
  frequency: ExportFrequency;
  /** Hora del día, 0..23. */
  hour: number;
  minute: number;
  /** Día de la semana para "weekly": 1 = domingo … 7 = sábado (lo que pide expo-notifications). */
  weekday: number;
  /** Días elegidos para "custom", en el mismo 1..7. Puede haber varios. */
  customDays: number[];
  /** Día del mes para "monthly", 1..28. Se corta en 28 a propósito, ver abajo. */
  day: number;
  format: ExportFormat;
  type: ExportType;
  destination: ExportDestination;
  fileNameMode: FileNameMode;
  /** Nombre escrito a mano, sin extensión. Solo se usa con fileNameMode "custom". */
  fileName: string;
  /** Volver a avisar a los N minutos si ese día todavía no se exportó. 0 = no. */
  retryMinutes: number;
  /** "AAAA-MM-DD" de la última vez que se subió sola a Drive. Evita repetir. */
  lastAutoRun?: string;
};

export const DEFAULT_SCHEDULE: ScheduledExport = {
  enabled: false,
  frequency: "monthly",
  hour: 9,
  minute: 0,
  weekday: 2, // lunes
  customDays: [2, 6], // lunes y viernes
  day: 1,
  format: "pdf",
  type: "all",
  destination: "drive",
  fileNameMode: "auto",
  fileName: "",
  retryMinutes: 30,
};

export const RETRY_OPTIONS = [0, 5, 15, 30, 60];

const STORAGE_KEY = "finzo:scheduledExport";

// Todos los avisos de exportación llevan esta marca para poder cancelar solo
// los nuestros. Cancelar todos los avisos programados se llevaría por delante
// los de otras partes de la app que puedan existir mañana.
const TAG = "finzo-export";
// El segundo aviso, el de "todavía no exportaste". Va con su propia marca
// para poder retirarlo en cuanto se exporte, sin tocar el recordatorio fijo.
const TAG_RETRY = "finzo-export-retry";

export async function loadSchedule(): Promise<ScheduledExport> {
  const saved = await loadJSON<Partial<ScheduledExport>>(STORAGE_KEY, {});
  const merged = { ...DEFAULT_SCHEDULE, ...saved };
  // Los ajustes guardados por una versión anterior traían frequency "off" y
  // no traían enabled. Se traduce: "off" era el apagado de entonces.
  if ((saved as { frequency?: string }).frequency === "off") merged.enabled = false;
  if (!Array.isArray(merged.customDays) || merged.customDays.length === 0) {
    merged.customDays = DEFAULT_SCHEDULE.customDays;
  }
  return merged;
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

// ---------------------------------------------------------------------------
// EL NOMBRE DEL ARCHIVO
// ---------------------------------------------------------------------------

/**
 * Deja un texto en algo que Android acepte como nombre de archivo.
 *
 * No es quisquillosería: los caracteres de abajo están PROHIBIDOS en los
 * sistemas de archivos. Un nombre como "Gastos 07/2026" crearía una carpeta
 * "Gastos 07" con un archivo "2026" dentro, o directamente fallaría al
 * guardar — y el fallo aparecería al exportar, lejos de la pantalla donde se
 * escribió el nombre.
 */
export function sanitizeFileName(raw: string): string {
  const limpio = raw
    .replace(/[/\\:*?"<>|]/g, "")
    // Los caracteres de control no se ven al escribirlos pero rompen igual.
    // Van escritos con su código y no como caracteres de verdad: un carácter
    // invisible dentro del código es de las cosas que un editor o una fusión
    // de ramas convierte en otra cosa sin que nadie lo note.
    .replace(/[\u0000-\u001f]/g, "")
    // Primero se recortan los extremos y DESPUÉS se juntan los espacios de
    // dentro. Al revés —como estaba— "  Julio  " salía "__Julio__": cuando
    // llegaba el recorte, los espacios de los bordes ya eran guiones bajos, y
    // el recorte solo mira espacios y puntos.
    //
    // Los puntos van en el mismo recorte porque un punto final lo borra
    // Windows en silencio al copiar el archivo.
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60)
    // Y el corte a 60 puede partir justo donde había un espacio, dejando un
    // guion bajo colgando al final.
    .replace(/[._]+$/g, "");
  return limpio;
}

/**
 * Cómo se va a llamar el archivo.
 *
 * En automático sale "Gastos_2026-07-31.pdf": qué es, y de cuándo. La fecha
 * va al final y en formato año-mes-día para que al ordenar por nombre en
 * Drive o en el explorador queden en orden cronológico solos.
 */
export function buildFileName(opts: {
  mode: FileNameMode;
  custom: string;
  typeLabel: string;
  dateKey: string;
  extension: "pdf" | "csv";
}): string {
  if (opts.mode === "custom") {
    const limpio = sanitizeFileName(opts.custom);
    if (limpio) return `${limpio}.${opts.extension}`;
    // Si lo escrito se quedó en nada tras limpiarlo (alguien escribió solo
    // "???"), se cae al automático en vez de generar un archivo sin nombre.
  }
  const tipo = sanitizeFileName(opts.typeLabel) || "Finzo";
  return `${tipo}_${opts.dateKey}.${opts.extension}`;
}

// ---------------------------------------------------------------------------
// PROGRAMAR LOS AVISOS
// ---------------------------------------------------------------------------

async function cancelByTag(tag: string): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => n.content.data?.tag === tag)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

/** Qué días de la semana dispara la programación. Vacío si no es semanal. */
export function activeWeekdays(schedule: ScheduledExport): number[] {
  if (schedule.frequency === "weekly") return [schedule.weekday];
  if (schedule.frequency === "custom") return [...new Set(schedule.customDays)].sort();
  return [];
}

/**
 * Deja programados los avisos según los ajustes. Cancela los anteriores
 * siempre, incluso con el interruptor apagado: así apagarlo apaga de verdad.
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

  await cancelByTag(TAG);
  await cancelByTag(TAG_RETRY);
  if (!schedule.enabled) return true;

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

  const dias = activeWeekdays(schedule);
  if (dias.length > 0) {
    // "Personalizado" son varios avisos semanales, uno por día elegido, y no
    // un disparador de "cada N días". Es lo que hace que caigan siempre en el
    // mismo día de la semana: un "cada 3 días" se cuenta desde el momento en
    // que se programó, así que se corre por el calendario y además se
    // reinicia cada vez que se cambia cualquier ajuste.
    await Promise.all(
      dias.map((weekday) =>
        Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            channelId,
            weekday,
            hour,
            minute,
          },
        })
      )
    );
    return true;
  }

  const trigger =
    schedule.frequency === "daily"
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY as const, channelId, hour, minute }
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

// ---------------------------------------------------------------------------
// EL SEGUNDO AVISO ("todavía no exportaste")
// ---------------------------------------------------------------------------

/**
 * Programa el recordatorio de repesca a los N minutos.
 *
 * Es un aviso de UNA sola vez, y se arma en el momento en que sabemos que el
 * primero ya sonó (al tocarlo, o al abrir la app con la hora pasada y sin
 * exportar). No puede ser otro aviso repetido puesto a las 9:30: ese sonaría
 * también los días en que sí se exportó a las 9:05, y un recordatorio que
 * insiste cuando ya hiciste la tarea se silencia en dos días.
 */
export async function armRetry(minutes: number, texts: { title: string; body: string }): Promise<void> {
  if (isDecoyActive() || minutes <= 0) return;
  await cancelByTag(TAG_RETRY);
  await Notifications.scheduleNotificationAsync({
    content: { title: texts.title, body: texts.body, data: { tag: TAG_RETRY, screen: "export" } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      repeats: false,
      ...(Platform.OS === "android" ? { channelId: "finzo-export" } : {}),
    },
  });
}

/** Retira la repesca. Se llama en cuanto se exporta de verdad. */
export async function cancelRetry(): Promise<void> {
  await cancelByTag(TAG_RETRY);
}

// ---------------------------------------------------------------------------
// QUÉ SE EXPORTÓ Y CUÁNDO
// ---------------------------------------------------------------------------

const KEY_LAST_EXPORT = "finzo:scheduledExport.lastExport";

/** Se apunta al terminar CUALQUIER exportación, programada o a mano. */
export function markExported(now: Date): void {
  saveJSON(KEY_LAST_EXPORT, toDateKey(now));
}

export async function exportedOn(day: Date): Promise<boolean> {
  const last = await loadJSON<string>(KEY_LAST_EXPORT, "");
  return last === toDateKey(day);
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

// ---------------------------------------------------------------------------
// CALENDARIO
// ---------------------------------------------------------------------------

/** ¿Hoy es uno de los días en que toca, sin mirar la hora? */
export function isScheduledDay(schedule: ScheduledExport, now: Date): boolean {
  if (!schedule.enabled) return false;
  if (schedule.frequency === "daily") return true;
  // getDay() da 0..6 empezando en domingo; los días se guardan 1..7 también
  // desde el domingo, que es lo que pide expo-notifications. De ahí el +1.
  const dias = activeWeekdays(schedule);
  if (dias.length > 0) return dias.includes(now.getDay() + 1);
  return now.getDate() === Math.min(schedule.day, MAX_MONTH_DAY);
}

/** ¿Ya pasó la hora fijada? */
export function isPastTime(schedule: ScheduledExport, now: Date): boolean {
  return now.getHours() * 60 + now.getMinutes() >= schedule.hour * 60 + schedule.minute;
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
  if (schedule.destination !== "drive") return false;
  if (schedule.lastAutoRun === toDateKey(now)) return false;
  if (!isScheduledDay(schedule, now)) return false;
  return isPastTime(schedule, now);
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

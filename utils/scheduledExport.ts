// EXPORTACIÓN AUTOMÁTICA: diaria, semanal, mensual o en los días que se elijan.
//
// QUÉ ES AUTOMÁTICO DE VERDAD, Y QUÉ NO
//
// A la hora fijada, la copia se genera y se guarda SOLA, sin que nadie toque
// nada. Los tres destinos que ofrece cumplen eso: la carpeta del teléfono,
// Google Drive y Dropbox (ver DESTINOS_AUTOMATICOS).
//
// Lo único que no es automático es EL MOMENTO EXACTO. La copia se hace la
// primera vez que se abre la app pasada la hora, no a la hora en punto con el
// celular guardado en el bolsillo. Y eso no es dejadez:
//
//   1. El PDF se arma en un WebView (expo-print). Un WebView necesita que la
//      app esté abierta; con la app cerrada no hay dónde dibujar y no sale
//      ningún archivo.
//   2. Android mata los procesos en segundo plano cuando quiere, y los Honor y
//      Xiaomi son de los más agresivos. Una tarea programada a las 3 de la
//      mañana no se ejecutaría de forma fiable.
//
// Para que ocurra a la hora en punto con la app cerrada hace falta armar el
// archivo en código nativo (sin WebView) y meterlo en un WorkManager. Es un
// cambio de APK, no de actualización, y está anotado como pendiente en
// ESTADO.md.
//
// Mientras tanto llega un AVISO a la hora fijada, así que la app se abre y la
// copia sale enseguida. Los destinos que necesitan que una persona elija a
// quién mandar el archivo —correo, WhatsApp, compartir— no se ofrecen aquí, por
// la sencilla razón de que no se pueden hacer solos.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { loadJSON, saveJSON } from "@/utils/storage";
import { isDecoyActive } from "@/utils/decoyMode";
import { cancelarExportacion, programarExportacion } from "@/modules/export-scheduler";

export type ExportFrequency = "daily" | "weekly" | "monthly" | "custom";
export type ExportDestination =
  | "share"
  | "mail"
  | "gmail"
  | "whatsapp"
  | "drive"
  | "folder"
  | "dropbox";

/**
 * LOS DESTINOS QUE DE VERDAD SE HACEN SOLOS.
 *
 * Esta lista es la que decide qué puede ofrecer la pantalla de exportación
 * automática, y el criterio es uno: que NADIE tenga que elegir a quién mandar
 * el archivo ni darle a un botón de enviar.
 *
 *   drive   → la cuenta ya está conectada y la carpeta la crea Finzo.
 *   folder  → la carpeta se elige una vez y el permiso de Android se queda.
 *   dropbox → se autoriza una vez en el navegador y el permiso es de larga
 *             duración, así que después no vuelve a pedir nada.
 *
 * Los demás (compartir, correo, Gmail, WhatsApp) abren OTRA aplicación y
 * esperan a que una persona toque enviar. Siguen existiendo para exportar a
 * mano, pero ofrecerlos como "automáticos" sería mentir. Por eso se quitaron de
 * esta pantalla el 05/08/2026, a pedido del usuario: "que todas las opciones en
 * dónde guardarlo sean de manera automática".
 */
const DESTINOS_AUTOMATICOS = ["drive", "folder", "dropbox"] as const;

export function esDestinoAutomatico(d: ExportDestination): boolean {
  return (DESTINOS_AUTOMATICOS as readonly string[]).includes(d);
}

export type ExportFormat = "pdf" | "xlsx" | "csv";
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
  /** "AAAA-MM-DD" de la última vez que se guardó sola. Evita repetir. */
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
};

const STORAGE_KEY = "finzo:scheduledExport";
/** Para cuándo quedó puesto el despertador. Ver applySchedule. */
const KEY_PROXIMA = "finzo:scheduledExport.proxima";

/** Para cuándo está puesto el despertador, o 0 si no hay ninguno. */
export async function proximaProgramada(): Promise<number> {
  return await loadJSON<number>(KEY_PROXIMA, 0);
}

// Todos los avisos de exportación llevan esta marca para poder cancelar solo
// los nuestros. Cancelar todos los avisos programados se llevaría por delante
// los de otras partes de la app que puedan existir mañana.
const TAG = "finzo-export";
// La marca del segundo aviso ("todavía no exportaste"), que ya no se programa.
// Se conserva SOLO para poder retirar los que quedaran puestos en celulares que
// venían de una versión anterior. Ver donde se cancela.
const TAG_VIEJO_REPESCA = "finzo-export-retry";

export async function loadSchedule(): Promise<ScheduledExport> {
  const saved = await loadJSON<Partial<ScheduledExport>>(STORAGE_KEY, {});
  const merged = { ...DEFAULT_SCHEDULE, ...saved };
  // Los ajustes guardados por una versión anterior traían frequency "off" y
  // no traían enabled. Se traduce: "off" era el apagado de entonces.
  if ((saved as { frequency?: string }).frequency === "off") merged.enabled = false;
  if (!Array.isArray(merged.customDays) || merged.customDays.length === 0) {
    merged.customDays = DEFAULT_SCHEDULE.customDays;
  }
  // Quien tuviera guardado "compartir", "correo", "Gmail" o "WhatsApp" se queda
  // con Drive. Esos destinos dejaron de ofrecerse aquí el 05/08/2026 y sin esto
  // el ajuste guardado apuntaría a una opción que ya no sale en la pantalla:
  // se vería sin destino elegido y la exportación automática no haría nada.
  if (!esDestinoAutomatico(merged.destination)) merged.destination = "drive";
  // Y la hora, por si llega de una versión futura o de una copia estropeada:
  // una hora inválida deja el aviso sin programar, sin error y sin señal.
  merged.hour = horaValida(merged.hour, DEFAULT_SCHEDULE.hour);
  merged.minute = minutoValido(merged.minute, DEFAULT_SCHEDULE.minute);
  return merged;
}

/** Deja una hora en 0..23. Cualquier cosa rara cae en el valor de reserva. */
export function horaValida(h: unknown, reserva = 9): number {
  const n = Math.floor(Number(h));
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : reserva;
}

/** Deja un minuto en 0..59. */
export function minutoValido(m: unknown, reserva = 0): number {
  const n = Math.floor(Number(m));
  return Number.isFinite(n) && n >= 0 && n <= 59 ? n : reserva;
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
  extension: "pdf" | "xlsx" | "csv";
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
  // Y se retiran los segundos avisos de "todavía no exportaste" que pudiera
  // haber dejado programados una versión anterior. Ese aviso se quitó el
  // 05/08/2026; sin esta línea, a quien lo tuviera puesto le seguiría sonando
  // una vez y no habría forma de callarlo desde la app.
  await cancelByTag(TAG_VIEJO_REPESCA);

  // EL DESPERTADOR DE ANDROID, el que hace el reporte con la app cerrada.
  //
  // Va aquí y no en la pantalla porque este es el único sitio por el que pasan
  // TODOS los cambios de la programación. Puesto en la pantalla, cualquier
  // camino que no fuera tocar un botón —una restauración de la nube, un ajuste
  // cambiado por voz— dejaría el aviso puesto y el despertador sin poner.
  //
  // Si el APK no trae el módulo nativo, estas dos funciones no hacen nada y
  // queda el comportamiento de siempre. Ver modules/export-scheduler.
  if (schedule.enabled) {
    const cuando = proximaEjecucion(schedule, new Date());
    programarExportacion(cuando);
    // Se apunta PARA CUÁNDO quedó puesto, y la pantalla lo enseña.
    //
    // Sin este dato no había forma de saber por qué no llegó un reporte: si el
    // despertador no había sonado o si había sonado y el trabajo falló. Se veía
    // igual. El usuario puso la hora un minuto adelante, no llegó nada, y para
    // averiguar el motivo hubo que leer código — cuando la respuesta ("quedó
    // puesto para mañana") cabía en una línea de la pantalla.
    saveJSON(KEY_PROXIMA, cuando.getTime());
  } else {
    cancelarExportacion();
    saveJSON(KEY_PROXIMA, 0);
  }
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
// QUÉ SE EXPORTÓ Y CUÁNDO
// ---------------------------------------------------------------------------

const KEY_LAST_EXPORT = "finzo:scheduledExport.lastExport";

/** Se apunta al terminar CUALQUIER exportación, programada o a mano. */
export function markExported(now: Date): void {
  saveJSON(KEY_LAST_EXPORT, toDateKey(now));
}

// Aquí había un exportedOn(día) que respondía "¿ya se exportó hoy?". Lo usaba
// solo la repesca, que se quitó el 05/08/2026. Se sigue APUNTANDO la fecha
// (markExported) porque no cuesta nada y es el dato que haría falta el día que
// se quiera un historial de exportaciones.

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
 * ¿Toca guardar sola la copia?
 *
 * Solo con los destinos que no necesitan que nadie elija nada — ver
 * DESTINOS_AUTOMATICOS. Se comprueba al abrir la app, no en segundo plano,
 * porque en segundo plano no se puede armar el PDF.
 *
 * `lastAutoRun` guarda el día en que se hizo la última para no repetirla cada
 * vez que se abre la app. Se compara por fecha y no por hora: abrir la app
 * cinco veces el mismo día tiene que dar una sola subida.
 */
export function isAutoRunDue(schedule: ScheduledExport, now: Date): boolean {
  if (!esDestinoAutomatico(schedule.destination)) return false;
  if (schedule.lastAutoRun === toDateKey(now)) return false;
  if (!isScheduledDay(schedule, now)) return false;
  return isPastTime(schedule, now);
}

/**
 * CUÁNDO TOCA LA PRÓXIMA VEZ, para poner el despertador de Android.
 *
 * El despertador nativo no sabe nada de frecuencias ni de días: solo entiende
 * "avísame en este instante". El calendario vive aquí, en un solo sitio, y no
 * duplicado en Kotlin — dos calendarios se desincronizan y el que falla es
 * siempre el que nadie mira.
 *
 * LAS TRAMPAS QUE TIENE ESTA CUENTA
 *
 *   · Si la hora de hoy YA PASÓ, toca mañana (o el siguiente día válido). Sin
 *     eso, el despertador se pondría para un momento del pasado y Android lo
 *     dispararía de inmediato: reporte al instante y luego nunca más.
 *   · El día del mes se corta en 28, igual que los avisos. El 31 no existe en
 *     cinco meses del año.
 *   · Los días de la semana van 1..7 empezando en domingo, que es lo que pide
 *     expo-notifications; getDay() da 0..6. De ahí el +1 de siempre.
 */
export function proximaEjecucion(schedule: ScheduledExport, ahora: Date): Date {
  const h = horaValida(schedule.hour);
  const m = minutoValido(schedule.minute);

  /** Ese mismo día a la hora fijada. */
  const aLaHora = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);

  if (schedule.frequency === "monthly") {
    const dia = Math.min(schedule.day, MAX_MONTH_DAY);
    const esteMes = new Date(ahora.getFullYear(), ahora.getMonth(), dia, h, m, 0, 0);
    if (esteMes.getTime() > ahora.getTime()) return esteMes;
    return new Date(ahora.getFullYear(), ahora.getMonth() + 1, dia, h, m, 0, 0);
  }

  const dias = activeWeekdays(schedule);
  if (dias.length === 0) {
    // Diario. Hoy si todavía no ha pasado la hora; si no, mañana.
    const hoy = aLaHora(ahora);
    if (hoy.getTime() > ahora.getTime()) return hoy;
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    return aLaHora(manana);
  }

  // Semanal o los días elegidos. Se prueban los siete días siguientes en orden
  // y se toma el primero que valga: es más corto que calcular la diferencia de
  // días, y no se equivoca al cruzar de semana, de mes ni de año.
  for (let i = 0; i <= 7; i++) {
    const d = new Date(ahora);
    d.setDate(d.getDate() + i);
    if (!dias.includes(d.getDay() + 1)) continue;
    const candidato = aLaHora(d);
    if (candidato.getTime() > ahora.getTime()) return candidato;
  }
  // No puede llegar aquí —en siete días siempre cae uno—, pero devolver algo
  // válido es mejor que devolver undefined y que el despertador reciba basura.
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  return aLaHora(manana);
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

// EL REPORTE QUE SE ARMA Y SE GUARDA CON LA APP CERRADA
//
// Android despierta esto a la hora fijada, sin abrir la app ni enseñar nada.
// Ver modules/export-scheduler.
//
// AQUÍ NO HAY APP. Ni pantalla, ni estado, ni contexto de React: solo el disco.
// Por eso todo se vuelve a leer de ahí — los movimientos, el idioma, los
// ajustes— igual que hace utils/capturaEnFondo con los yapes.
//
// SI ESTO NO CORRE, NO SE PIERDE NADA
//
// Y es a propósito. Android puede negarse a despertarlo, y los Honor y Xiaomi
// son de los más duros. En ese caso queda el comportamiento de siempre: el aviso
// a la hora fijada y el reporte al abrir la app. El peor caso es lo de antes.

import { loadJSON, saveJSON, flushPendingSaves, STORAGE_KEYS } from "@/utils/storage";
import { monthNamesFor, translations } from "@/constants/i18n";
import { archivoCsv, archivoExcel, filasDelReporte } from "@/utils/reporteArchivo";
import { guardarEnCarpeta } from "@/utils/carpetaTelefono";
import { subirADropbox } from "@/utils/dropbox";
import { uploadToDrive } from "@/utils/googleDrive";
import { programarExportacion } from "@/modules/export-scheduler";
import {
  buildFileName,
  esDestinoAutomatico,
  isScheduledDay,
  loadSchedule,
  markExported,
  monthForSchedule,
  proximaEjecucion,
  saveSchedule,
  toDateKey,
  type ScheduledExport,
} from "@/utils/scheduledExport";
import type { Profile, Transaction } from "@/types";

/**
 * Por qué no se hizo el reporte, para poder saberlo después.
 *
 * "No pasó nada" es lo peor que puede devolver un trabajo de fondo: obliga a
 * adivinar entre diez causas. Esto se guarda y la pantalla lo puede enseñar.
 */
// Sin "export": lo nombra UltimoIntento, que si sale de aqui.
type ResultadoDeFondo =
  | "hecho"
  | "apagado"
  | "no-toca-hoy"
  | "ya-se-hizo-hoy"
  | "pdf-no-se-puede"
  | "destino-no-automatico"
  | "sin-movimientos"
  | "error";

const CLAVE_ULTIMO = "finzo:exportacionEnFondo.ultimo";

/** Lo último que hizo el trabajo de fondo, para la pantalla de ajustes. */
export type UltimoIntento = { cuando: number; resultado: ResultadoDeFondo; archivo: string };

export async function ultimoIntentoEnFondo(): Promise<UltimoIntento | null> {
  return await loadJSON<UltimoIntento | null>(CLAVE_ULTIMO, null);
}

async function apuntar(resultado: ResultadoDeFondo, archivo = ""): Promise<ResultadoDeFondo> {
  saveJSON(CLAVE_ULTIMO, { cuando: Date.now(), resultado, archivo });
  await flushPendingSaves();
  return resultado;
}

/**
 * Vuelve a poner el despertador para la próxima vez.
 *
 * Se hace SIEMPRE, incluso cuando el reporte no se pudo hacer. Si solo se
 * repusiera al terminar bien, un día sin internet dejaría la exportación
 * automática muerta para siempre — y sin ningún aviso.
 */
function reprogramar(schedule: ScheduledExport): void {
  if (!schedule.enabled) return;
  programarExportacion(proximaEjecucion(schedule, new Date()));
}

export async function exportarEnFondo(): Promise<ResultadoDeFondo> {
  const schedule = await loadSchedule();
  reprogramar(schedule);

  if (!schedule.enabled) return await apuntar("apagado");

  const ahora = new Date();
  // El despertador puede desviarse unos minutos (ver el módulo nativo), así que
  // se comprueba el día aquí. Sin esto, un despertador que se retrasa hasta
  // pasada la medianoche haría el reporte de un día que no tocaba.
  if (!isScheduledDay(schedule, ahora)) return await apuntar("no-toca-hoy");
  if (schedule.lastAutoRun === toDateKey(ahora)) return await apuntar("ya-se-hizo-hoy");

  // El PDF se dibuja en una ventana del navegador de Android, y esa ventana
  // necesita la app en pantalla. No se intenta: se deja para cuando la app se
  // abra, que es lo que hacía antes de que este trabajo existiera.
  if (schedule.format === "pdf") return await apuntar("pdf-no-se-puede");
  if (!esDestinoAutomatico(schedule.destination)) return await apuntar("destino-no-automatico");

  try {
    const [movimientos, perfil] = await Promise.all([
      loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []),
      loadJSON<Partial<Profile>>(STORAGE_KEYS.profile, {}),
    ]);

    const idioma = perfil.userLanguage ?? "es";
    const textos = (translations as Record<string, Record<string, string>>)[idioma] ?? {};
    const t = (clave: string) => textos[clave] ?? clave;

    // El mes que toca, con la misma regla que usa la app: un reporte mensual
    // que sale el día 1 trae el mes que TERMINÓ, no el que acaba de empezar.
    const mes = monthForSchedule(schedule, ahora);
    const delMes = movimientos.filter((tx) => tx.date.slice(0, 7) === mes);
    const delTipo =
      schedule.type === "all" ? delMes : delMes.filter((tx) => tx.type === schedule.type);

    // Un reporte de cero movimientos es una hoja con solo la cabecera. No se
    // sube: llenaría la nube de archivos vacíos y taparía los que sí valen.
    if (delTipo.length === 0) return await apuntar("sin-movimientos");

    const total = delTipo.reduce(
      (suma, tx) => suma + (tx.type === "expense" ? -tx.amount : tx.amount),
      0
    );
    const etiquetaTipo =
      schedule.type === "expense"
        ? t("exportPdf.expenses")
        : schedule.type === "income"
          ? t("exportPdf.income")
          : t("exportPdf.all");

    const fileName = buildFileName({
      mode: schedule.fileNameMode,
      custom: schedule.fileName,
      typeLabel: etiquetaTipo,
      dateKey: toDateKey(ahora),
      extension: schedule.format,
    });

    const filas = filasDelReporte({
      movimientos: delTipo,
      total,
      nombresDeMes: monthNamesFor(idioma),
      t,
    });
    const archivo =
      schedule.format === "xlsx"
        ? archivoExcel(filas, t("exportPdf.movements"), fileName)
        : archivoCsv(filas, fileName);

    if (schedule.destination === "folder") {
      await guardarEnCarpeta(archivo.uri, archivo.fileName, archivo.mimeType);
    } else if (schedule.destination === "dropbox") {
      await subirADropbox(archivo.uri, archivo.fileName);
    } else {
      await uploadToDrive(archivo.uri, archivo.fileName, archivo.mimeType);
    }

    // Se apunta DESPUÉS de guardar, no antes. Al contrario que la copia al abrir
    // la app: allí se apunta antes porque un fallo a medias repetiría la subida
    // en bucle cada vez que se abre. Aquí no hay bucle —el despertador es uno al
    // día— así que conviene lo contrario: si falló, que mañana se reintente.
    saveSchedule({ ...schedule, lastAutoRun: toDateKey(ahora) });
    markExported(ahora);
    await flushPendingSaves();
    return await apuntar("hecho", archivo.fileName);
  } catch {
    // Nunca dejar que esto reviente: un trabajo de fondo que lanza una excepción
    // deja a Android con un candado de energía abierto y el proceso colgado.
    return await apuntar("error");
  }
}

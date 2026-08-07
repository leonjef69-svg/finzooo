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
import { currencySymbolFor } from "@/constants/currencies";
import { fmt as formatAmount } from "@/utils/format";
import { htmlDelReporte } from "@/utils/reportePdfDatos";
import { File, Paths } from "expo-file-system";
import { archivoCsv, archivoExcel, filasDelReporte } from "@/utils/reporteArchivo";
import { guardarEnCarpeta } from "@/utils/carpetaTelefono";
import { subirADropbox } from "@/utils/dropbox";
import { uploadToDrive } from "@/utils/googleDrive";
import {
  htmlAPdfEnFondo,
  PdfEnFondoNoDisponible,
  programarExportacion,
} from "@/modules/export-scheduler";
import {
  buildFileName,
  claveDeEjecucion,
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
  | "pdf-vacio"
  | "destino-no-automatico"
  | "sin-movimientos"
  | "error";

const CLAVE_ULTIMO = "finzo:exportacionEnFondo.ultimo";

/**
 * Cuánto del error se guarda.
 *
 * Suficiente para reconocer de qué se trata —el permiso de Drive, el archivo que
 * no está, la conversión que falló— y no tanto como para llenar la pantalla con
 * una pila de llamadas que nadie va a leer.
 */
const LARGO_DETALLE = 200;

/** Lo último que hizo el trabajo de fondo, para la pantalla de ajustes. */
export type UltimoIntento = {
  cuando: number;
  resultado: ResultadoDeFondo;
  archivo: string;
  /**
   * EL TEXTO DEL ERROR, cuando hubo uno.
   *
   * Faltaba, y se notó el 06/08/2026: el PDF automático no salía, el motivo
   * guardado era "error", y "error" no distingue entre el permiso de Drive
   * caducado, el archivo que no se escribió y la conversión que falló. El único
   * caso que necesita detalle era justo el que lo tiraba a la basura.
   */
  detalle?: string;
};

export async function ultimoIntentoEnFondo(): Promise<UltimoIntento | null> {
  return await loadJSON<UltimoIntento | null>(CLAVE_ULTIMO, null);
}

async function apuntar(
  resultado: ResultadoDeFondo,
  archivo = "",
  detalle = ""
): Promise<ResultadoDeFondo> {
  saveJSON(CLAVE_ULTIMO, {
    cuando: Date.now(),
    resultado,
    archivo,
    detalle: detalle.slice(0, LARGO_DETALLE),
  });
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

/**
 * @param forzar Hacer el reporte AHORA, aunque hoy no toque y aunque ya se
 *   hubiera hecho. Es lo que usa el botón "Probar ahora" de la pantalla.
 *
 *   Existe porque ese botón antes probaba OTRA COSA: abría la pantalla de
 *   exportar y hacía el archivo con la app delante. Salía bien, y a la hora
 *   fijada no llegaba nada — el camino automático no se había ejecutado nunca.
 *   Un botón de probar que no prueba lo que va a pasar es peor que no tenerlo.
 *
 *   Forzando NO se apunta el reporte como hecho: si se apuntara, probar a las
 *   tres de la tarde se llevaría por delante el reporte de verdad de las siete.
 */
export async function exportarEnFondo(forzar = false): Promise<ResultadoDeFondo> {
  const schedule = await loadSchedule();
  reprogramar(schedule);

  if (!schedule.enabled) return await apuntar("apagado");

  const ahora = new Date();
  // El despertador puede desviarse unos minutos (ver el módulo nativo), así que
  // se comprueba el día aquí. Sin esto, un despertador que se retrasa hasta
  // pasada la medianoche haría el reporte de un día que no tocaba.
  if (!forzar && !isScheduledDay(schedule, ahora)) return await apuntar("no-toca-hoy");
  if (!forzar && schedule.lastAutoRun === claveDeEjecucion(schedule, ahora)) {
    return await apuntar("ya-se-hizo-hoy");
  }

  // El PDF ya NO se salta: desde el 06/08/2026 se convierte con código de
  // Android que no necesita la app en pantalla. Ver modules/export-scheduler.
  // Si el APK es anterior, htmlAPdfEnFondo lanza y se apunta el motivo.
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

    let archivo: { uri: string; fileName: string; mimeType: string };
    if (schedule.format === "pdf") {
      // El MISMO armador que usa la pantalla de exportar a mano, para que el PDF
      // automático y el de a mano sean el mismo documento. Ver reportePdfDatos.
      //
      // Los gráficos van APAGADOS, igual que de fábrica en la pantalla: ocupan
      // media hoja y empujan la lista a la siguiente. Quien quiera gráficos los
      // enciende al exportar a mano.
      const html = htmlDelReporte({
        movimientos: delTipo,
        todos: movimientos,
        mes,
        tipo: schedule.type,
        charts: false,
        userName: perfil.userName ?? "",
        nombresDeMes: monthNamesFor(idioma),
        presupuestos: await loadJSON<Record<string, number>>(STORAGE_KEYS.categoryBudgets, {}),
        // El MISMO formateador que usa la app, con la moneda del perfil. Uno
        // hecho aquí a mano ("S/ 12.50") saldría distinto del de la pantalla en
        // cuanto alguien cambie el formato en un sitio y no en el otro.
        fmt: (n) => formatAmount(n, currencySymbolFor(perfil.userCurrency ?? "PEN")),
        titulo: t(
          schedule.type === "expense"
            ? "exportPdf.pdfTitleExpenses"
            : schedule.type === "income"
              ? "exportPdf.pdfTitleIncome"
              : "exportPdf.pdfTitleAll"
        ),
        etiquetaDelMes: `${monthNamesFor(idioma)[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`,
        t,
      });
      // La ruta se arma con la MISMA pieza que usa el Excel (new File(Paths.cache,
      // ...)) y no pegando textos. Pegándolos salía una barra doble —Paths.cache
      // ya acaba en barra— y una ruta con "//" en medio es de las que funcionan
      // en un sitio y no en el siguiente.
      //
      // Y se le quita el "file://" porque al otro lado hay código de Android, que
      // espera una ruta de archivo y no una dirección.
      const salida = new File(Paths.cache, fileName);
      const uri = await htmlAPdfEnFondo(html, salida.uri.replace("file://", ""));

      // QUE EL PDF NO ESTÉ VACÍO.
      //
      // La conversión puede contestar "listo" y dejar un archivo de cero bytes:
      // el WebView que lo dibuja no está en ninguna pantalla, y si algo sale mal
      // al medirlo el resultado es un PDF sin páginas. Sin esta comprobación se
      // subiría igual, el reporte diría "listo", y en Drive habría un archivo que
      // no abre — que es peor que no tener ninguno, porque nadie lo revisa.
      const hecho = new File(uri);
      if (!hecho.exists || (hecho.size ?? 0) === 0) {
        return await apuntar("pdf-vacio", fileName, `${uri} · ${hecho.size ?? "sin tamaño"}`);
      }
      archivo = { uri, fileName, mimeType: "application/pdf" };
    } else {
      const filas = filasDelReporte({
        movimientos: delTipo,
        total,
        nombresDeMes: monthNamesFor(idioma),
        t,
      });
      archivo =
        schedule.format === "xlsx"
          ? archivoExcel(filas, t("exportPdf.movements"), fileName)
          : archivoCsv(filas, fileName);
    }

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
    //
    // Probando no se apunta nada: probar a las tres de la tarde no puede dejar
    // sin reporte a las siete.
    if (!forzar) {
      saveSchedule({ ...schedule, lastAutoRun: claveDeEjecucion(schedule, ahora) });
      markExported(ahora);
    }
    await flushPendingSaves();
    return await apuntar("hecho", archivo.fileName);
  } catch (e) {
    // El APK viejo se dice aparte: "falló" mandaría a buscar un problema de
    // internet cuando lo que falta es instalar el APK nuevo. Los 6ago-01 y
    // 6ago-02 traen el despertador pero no el conversor de PDF.
    if (e instanceof PdfEnFondoNoDisponible) return await apuntar("pdf-no-se-puede");
    // Y nunca dejar que esto reviente: un trabajo de fondo que lanza una
    // excepción deja a Android con un candado de energía abierto y el proceso
    // colgado.
    //
    // El TEXTO del error se guarda. Antes se perdía, y con él la única pista de
    // qué había fallado: en la pantalla ponía "falló" y a partir de ahí solo
    // quedaba adivinar. Ver UltimoIntento.detalle.
    const detalle = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return await apuntar("error", "", detalle);
  }
}

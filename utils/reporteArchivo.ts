// ARMAR EL ARCHIVO DEL REPORTE, SIN PANTALLA
//
// POR QUÉ ESTO SALIÓ DE LA PANTALLA DE EXPORTAR
//
// Estaba dentro de screens/ExportPdfSheet.tsx, y ahí no sirve para lo que hace
// falta: que el reporte se genere a la hora fijada CON LA APP CERRADA. En ese
// momento no hay pantalla, no hay estado y no hay traductor de React — solo el
// disco. Una función metida en un componente no se puede llamar desde ahí.
//
// Así que aquí no se importa nada de React ni de la pantalla. Todo lo que la
// función necesita llega por parámetro.
//
// EL PDF NO ESTÁ AQUÍ, Y NO ES UN OLVIDO
//
// El PDF se dibuja en una ventana invisible del navegador de Android
// (expo-print), y esa ventana necesita que la app esté abierta. Excel y CSV se
// arman con cuentas y texto, así que sí pueden salir con la app cerrada. Es la
// única razón por la que la exportación automática de verdad empieza por Excel.

import { File, Paths } from "expo-file-system";
import * as XLSX from "xlsx";
import { catInfo } from "@/constants/categories";
import { methodLabel } from "@/constants/i18n";
import { fmtDate } from "@/utils/format";
import type { Transaction } from "@/types";

// Sin "export": nadie de fuera lo nombra, lo infiere TypeScript.
type ArchivoGenerado = { uri: string; mimeType: string; fileName: string };

/** Lo que hace falta para armar las filas. Nada de esto viene de una pantalla. */
type DatosDelReporte = {
  movimientos: Transaction[];
  /** El total ya calculado: la pantalla y el trabajo de fondo lo suman igual. */
  total: number;
  /** Los nombres de los meses, ya traducidos. */
  nombresDeMes: string[];
  t: (clave: string, valores?: Record<string, string | number>) => string;
};

/**
 * Las filas del reporte: cabecera, movimientos, una vacía y el total.
 *
 * Los montos van como NÚMERO y no como texto, y los gastos en negativo. Así el
 * Excel los puede sumar y ordenar sin que nadie toque nada. El CSV los convierte
 * a texto con dos decimales al escribirlos, que es lo que se espera de un CSV.
 */
export function filasDelReporte(datos: DatosDelReporte): (string | number)[][] {
  const { movimientos, total, nombresDeMes, t } = datos;
  const cabecera = [
    t("exportPdf.colDate"),
    t("exportPdf.colCategory"),
    t("exportPdf.colDescription"),
    t("exportPdf.colMethod"),
    t("exportPdf.colAmount"),
  ];
  const filas = movimientos.map((tx) => {
    const c = catInfo(tx.category);
    const montoConSigno = tx.type === "expense" ? -tx.amount : tx.amount;
    return [
      fmtDate(tx.date, nombresDeMes),
      t(c.label),
      tx.description || "",
      methodLabel(tx.method, t),
      montoConSigno,
    ];
  });
  return [cabecera, ...filas, [], [t("exportPdf.total"), "", "", "", total]];
}

/**
 * Deja un valor listo para un CSV.
 *
 * Un punto y coma o un salto de línea dentro de una descripción parte la fila en
 * dos al abrir el archivo, y entonces el reporte enseña movimientos que no
 * existen. Las comillas se doblan porque es así como se escapan en un CSV.
 */
export function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Escribe un archivo en la carpeta temporal y devuelve dónde quedó. */
function escribir(fileName: string, contenido: string | Uint8Array): string {
  const file = new File(Paths.cache, fileName);
  // Si ya había uno del mismo nombre se borra: escribir encima de un archivo
  // más largo dejaría el final del anterior pegado al nuevo.
  if (file.exists) file.delete();
  file.create();
  file.write(contenido);
  return file.uri;
}

/**
 * Excel de verdad (.xlsx), no un CSV con nombre de Excel.
 *
 * El formato que había se llamaba "Excel (CSV)" y era un CSV: se abre en Excel,
 * sí, pero con todo en una columna hasta que alguien sepa separarlo, y con los
 * montos como texto. Este sale con sus columnas y con los montos como NÚMEROS.
 */
export function archivoExcel(
  filas: (string | number)[][],
  nombreDeLaHoja: string,
  fileName: string
): ArchivoGenerado {
  const wb = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  // Formato visual: el reporte debe poder leerse de un vistazo, no ser una
  // cuadrícula gris. SheetJS conserva estos estilos al escribir el .xlsx.
  const encabezado = {
    fill: { fgColor: { rgb: "0F766E" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const gasto = { font: { color: { rgb: "BE123C" } }, numFmt: '#,##0.00;[Red]-#,##0.00' };
  const ingreso = { font: { color: { rgb: "047857" } }, numFmt: '#,##0.00;[Green]#,##0.00' };
  const total = {
    fill: { fgColor: { rgb: "D1FAE5" } },
    font: { bold: true, color: { rgb: "065F46" } },
    numFmt: '#,##0.00;[Red]-#,##0.00',
  };
  const rango = hoja["!ref"] ?? "A1:E1";
  const fin = XLSX.utils.decode_range(rango).e.r;
  for (let col = 0; col < 5; col++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: 0, c: col })];
    if (celda) celda.s = encabezado;
  }
  // La fila inmediatamente anterior a la última es la separación; la última
  // siempre es el total que arma filasDelReporte.
  const filaTotal = fin;
  for (let col = 0; col < 5; col++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: filaTotal, c: col })];
    if (celda) celda.s = total;
  }
  for (let fila = 1; fila < filaTotal; fila++) {
    const monto = hoja[XLSX.utils.encode_cell({ r: fila, c: 4 })];
    if (monto && typeof monto.v === "number") monto.s = monto.v < 0 ? gasto : ingreso;
    if (fila % 2 === 0) {
      for (let col = 0; col < 4; col++) {
        const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: col })];
        if (celda) celda.s = { fill: { fgColor: { rgb: "F0FDFA" } } };
      }
    }
  }
  hoja["!autofilter"] = { ref: `A1:E${Math.max(1, filaTotal - 2)}` };
  // Anchos de columna, o la descripción sale cortada y hay que arrastrar cada
  // borde a mano al abrirlo.
  hoja["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 34 }, { wch: 14 }, { wch: 12 }];
  // Excel no acepta nombres de hoja de más de 31 caracteres: con uno más largo
  // el archivo no abre, y el error no dice por qué.
  XLSX.utils.book_append_sheet(wb, hoja, nombreDeLaHoja.slice(0, 31));

  const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", cellStyles: true }) as ArrayBuffer);
  return {
    uri: escribir(fileName, bytes),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName,
  };
}

/**
 * Las filas convertidas a texto CSV.
 *
 * Va aparte de escribir el archivo para poder comprobarlo: los decimales y el
 * escapado son justo donde un CSV se rompe, y no se ven mirando el código.
 */
export function csvDeFilas(filas: (string | number)[][]): string {
  return filas
    .map((fila) =>
      fila
        // Los números con dos decimales: en un CSV se espera "12.50", no "12.5".
        // El Excel los lleva como número de verdad, que es otra cosa.
        .map((v) => csvEscape(typeof v === "number" ? v.toFixed(2) : String(v)))
        .join(",")
    )
    .join("\n");
}

/** El mismo reporte en CSV, de las mismas filas. */
export function archivoCsv(filas: (string | number)[][], fileName: string): ArchivoGenerado {
  return { uri: escribir(fileName, csvDeFilas(filas)), mimeType: "text/csv", fileName };
}

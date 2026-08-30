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
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
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
  hoja["!autofilter"] = { ref: `A1:E${Math.max(1, filas.length - 2)}` };
  // Anchos de columna, o la descripción sale cortada y hay que arrastrar cada
  // borde a mano al abrirlo.
  hoja["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 34 }, { wch: 14 }, { wch: 12 }];
  // Excel no acepta nombres de hoja de más de 31 caracteres: con uno más largo
  // el archivo no abre, y el error no dice por qué.
  XLSX.utils.book_append_sheet(wb, hoja, nombreDeLaHoja.slice(0, 31));

  const sinEstilos = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  const bytes = aplicarEstilosExcel(sinEstilos, filas);
  return {
    uri: escribir(fileName, bytes),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileName,
  };
}

/**
 * Mete los estilos directamente en el XLSX (que internamente es un ZIP de XML).
 *
 * La edición comunitaria actual de SheetJS lee estilos, pero descarta `celda.s`
 * al escribir. Eso dejó una prueba verde y un archivo real sin colores. Hacerlo
 * aquí evita cambiar a una versión antigua de terceros y permite comprobar el
 * resultado final, no el objeto que había antes de guardarlo.
 */
export function aplicarEstilosExcel(
  bytes: Uint8Array,
  filas: (string | number)[][]
): Uint8Array {
  const archivos = unzipSync(bytes);
  const rutaHoja = "xl/worksheets/sheet1.xml";
  const rutaEstilos = "xl/styles.xml";
  const hojaOriginal = archivos[rutaHoja];
  if (!hojaOriginal) return bytes;

  let hoja = strFromU8(hojaOriginal);
  const poner = (ref: string, estilo: number) => {
    const patron = new RegExp(`<c r="${ref}"(?![^>]*\\ss=)`);
    hoja = hoja.replace(patron, `<c r="${ref}" s="${estilo}"`);
  };

  for (const col of ["A", "B", "C", "D", "E"]) poner(`${col}1`, 1);
  const filaTotal = filas.length;
  for (let i = 1; i < filas.length - 2; i++) {
    const filaExcel = i + 1;
    if (i % 2 === 0) {
      for (const col of ["A", "B", "C", "D"]) poner(`${col}${filaExcel}`, 5);
    }
    const monto = filas[i]?.[4];
    if (typeof monto === "number") poner(`E${filaExcel}`, monto < 0 ? 2 : 3);
  }
  for (const col of ["A", "B", "C", "D", "E"]) poner(`${col}${filaTotal}`, 4);

  // Índices: 0 normal, 1 cabecera, 2 gasto, 3 ingreso, 4 total, 5 fila alterna.
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;[Red]-#,##0.00"/></numFmts>
  <fonts count="5">
    <font><sz val="12"/><name val="Calibri"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Calibri"/></font>
    <font><color rgb="FFBE123C"/><sz val="12"/><name val="Calibri"/></font>
    <font><color rgb="FF047857"/><sz val="12"/><name val="Calibri"/></font>
    <font><b/><color rgb="FF065F46"/><sz val="12"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
    <xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
    <xf numFmtId="164" fontId="4" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  archivos[rutaHoja] = strToU8(hoja);
  archivos[rutaEstilos] = strToU8(estilos);
  return zipSync(archivos, { level: 6 });
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

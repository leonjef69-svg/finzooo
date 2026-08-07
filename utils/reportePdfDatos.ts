// ARMAR EL HTML DEL REPORTE, SIN PANTALLA
//
// POR QUÉ ESTO SALIÓ DE LA PANTALLA DE EXPORTAR
//
// Mismo motivo que utils/reporteArchivo con el Excel: hasta ahora esto vivía
// dentro de screens/ExportPdfSheet.tsx, leyendo estado del componente. Con la app
// cerrada no hay componente, así que el PDF automático no podía armarse.
//
// Y NO SE DUPLICÓ, SE MOVIÓ. Copiar estas cuentas para el trabajo de fondo habría
// dejado DOS armadores del mismo documento: el PDF automático y el de a mano se
// irían separando con cada cambio, y el que nadie mira es el que se rompe. Es el
// fallo que más veces ha mordido este proyecto.
//
// Todo lo que hace falta llega por parámetro. Aquí no se importa nada de React.

import { catInfo } from "@/constants/categories";
import { COLOR_HEX_600 } from "@/constants/colors";
import { methodLabel } from "@/constants/i18n";
import { LOGO_DATA_URI } from "@/constants/logo";
import { fmtDate, monthKey } from "@/utils/format";
import { buildPdfHtml, type PdfTx } from "@/utils/exportPdfHtml";
import { toDateKey } from "@/utils/scheduledExport";
import type { Transaction } from "@/types";

type DatosDelPdf = {
  /** Los movimientos del mes y tipo elegidos, ya filtrados. */
  movimientos: Transaction[];
  /** TODOS los movimientos: hacen falta para las columnas de los tres meses. */
  todos: Transaction[];
  /** El mes elegido, "AAAA-MM". */
  mes: string;
  tipo: "all" | "expense" | "income";
  /** Dibujar los gráficos. */
  charts: boolean;
  userName: string;
  /** Los nombres de los meses, ya traducidos. */
  nombresDeMes: string[];
  /** Los límites por categoría, por id. */
  presupuestos: Record<string, number>;
  /** Cómo se escribe un monto ("S/ 12.50"). */
  fmt: (n: number) => string;
  /** El título del reporte, ya elegido según el tipo. */
  titulo: string;
  /** El mes en palabras ("Julio 2026"). */
  etiquetaDelMes: string;
  t: (clave: string, valores?: Record<string, string | number>) => string;
};

export function htmlDelReporte(d: DatosDelPdf): string {
  const { movimientos, todos, mes, tipo, charts, nombresDeMes, presupuestos, t } = d;
  const [y, m] = mes.split("-").map(Number);
  // Días que tiene el mes elegido. El día 0 del mes siguiente es el último del
  // actual, y así también sale bien febrero en año bisiesto.
  const daysInMonth = new Date(y, m, 0).getDate();

  const pdfTxs: PdfTx[] = movimientos.map((tx) => {
    const c = catInfo(tx.category);
    return {
      dateLabel: fmtDate(tx.date, nombresDeMes),
      day: Number(tx.date.slice(8, 10)),
      categoryLabel: t(c.label),
      categoryColor: c.color,
      description: tx.description || "",
      methodLabel: methodLabel(tx.method, t),
      amount: tx.amount,
      type: tx.type,
    };
  });

  // Los límites por categoría, con lo gastado DEL MES ELEGIDO.
  //
  // Se recalcula aquí y no se toma el "gasto del mes en curso" que ya tiene la
  // app: ese siempre mira el mes que se está viendo en Inicio, no el que se
  // eligió para el reporte. Exportando junio desde julio habría salido el gasto
  // de julio contra los límites, y nadie lo habría notado hasta comparar dos
  // meses.
  const gastadoPorCategoria: Record<string, number> = {};
  for (const tx of todos) {
    if (tx.type !== "expense" || !tx.date.startsWith(mes)) continue;
    gastadoPorCategoria[tx.category] = (gastadoPorCategoria[tx.category] || 0) + tx.amount;
  }
  const limites = Object.entries(presupuestos)
    .filter(([, limit]) => limit > 0)
    .map(([id, limit]) => {
      const c = catInfo(id);
      return {
        name: t(c.label),
        color: COLOR_HEX_600[c.color] || "#64748b",
        limit,
        spent: gastadoPorCategoria[id] || 0,
      };
    })
    // SOLO LAS QUE TUVIERON GASTO ESE MES.
    //
    // El usuario lo pidió el 07/08/2026 con la captura del PDF: trece filas
    // diciendo "€ 0.00 / € 50.00", una detrás de otra, y ni una con nada dentro.
    // *"Si no hay movimiento, quítalo; solo debe aparecer cuando haya algún
    // movimiento"*. Es media hoja que no contesta nada, y encima empuja los
    // gráficos y la lista de movimientos hacia abajo.
    //
    // Y ES LA MISMA REGLA QUE YA SEGUÍA LA PANTALLA DE REPORTES. Ahí solo se
    // dibujan los límites con gasto —desde antes que esto—, así que el PDF y la
    // pantalla enseñaban cosas distintas del mismo mes. Otra vez una decisión
    // tomada en un sitio y sin aplicar en el de al lado, que es el fallo que este
    // proyecto repite. Si algún día se cambia, se cambia en los dos.
    //
    // Si ninguna tuvo gasto, la lista queda vacía y buildPdfHtml no dibuja el
    // bloque: ya se salta lo que no tiene filas.
    .filter((l) => l.spent > 0)
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  // Los tres meses que TERMINAN en el mes elegido, del más antiguo al más
  // reciente. Solo los que tuvieron gasto: un mes en cero no aporta y hace que
  // las columnas de los otros se vean más chicas de lo que son.
  const meses = [2, 1, 0]
    .map((atras) => {
      const fecha = new Date(y, m - 1 - atras, 1);
      const clave = monthKey(fecha.getFullYear(), fecha.getMonth());
      const total = todos
        .filter((tx) => tx.type === "expense" && tx.date.startsWith(clave))
        .reduce((s, tx) => s + tx.amount, 0);
      return { label: nombresDeMes[fecha.getMonth()].slice(0, 3), value: total };
    })
    .filter((b) => b.value > 0);

  return buildPdfHtml({
    logoDataUri: LOGO_DATA_URI,
    userName: d.userName,
    title: d.titulo,
    monthLabel: d.etiquetaDelMes,
    txs: pdfTxs,
    daysInMonth,
    fmt: d.fmt,
    charts,
    // Los presupuestos y las columnas de los tres meses son de GASTO: no existe
    // un presupuesto de ingresos ni tiene sentido comparar cuánto gastaste en un
    // reporte donde pediste solo lo que entró. En un "exportar ingresos" salían
    // igual, hablando de otra cosa.
    categoryBudgets: charts && tipo !== "income" ? limites : [],
    monthly: charts && tipo !== "income" ? meses : [],
    // toDateKey y no toISOString(): toISOString da la fecha en horario de
    // Greenwich, y Perú va cinco horas por detrás. Un PDF exportado a las 8 de
    // la noche del 30 habría salido fechado el 31.
    generatedAt: fmtDate(toDateKey(new Date()), nombresDeMes),
    texts: {
      colDate: t("exportPdf.colDate"),
      colCategory: t("exportPdf.colCategory"),
      colDescription: t("exportPdf.colDescription"),
      colMethod: t("exportPdf.colMethod"),
      colAmount: t("exportPdf.colAmount"),
      total: t("exportPdf.total"),
      income: t("exportPdf.income"),
      expenses: t("exportPdf.expenses"),
      balance: t("exportPdf.balance"),
      byCategory: t("exportPdf.chartByCategory"),
      byCategoryBudget: t("categoryBudgets.rowLabel"),
      byMonth: t("reports.byMonth"),
      byDay: t("exportPdf.chartByDay"),
      generatedOn: t("exportPdf.generatedOn"),
      movements: t("exportPdf.movements"),
    },
  });
}

// Arma el HTML del PDF que se exporta.
//
// Está en su propio archivo, separado de la pantalla, por dos razones. La
// primera es que se puede probar con Node sin levantar la app: es texto que
// entra y texto que sale. La segunda es que la pantalla ya tenía 490 líneas
// y este HTML, con los gráficos, ocupa más que todo lo demás junto.
//
// Ojo con una cosa al tocar esto: expo-print arma el PDF en un WebView
// aislado. No puede leer archivos del celular ni bajar nada de internet, así
// que TODO —el logo, los colores, los gráficos— tiene que ir escrito dentro
// del propio HTML. Por eso los gráficos son cajas con ancho y alto en
// porcentaje y no una librería de gráficos: no habría forma de cargarla.

export type PdfTx = {
  /** Fecha ya escrita para leer ("12 de julio"). */
  dateLabel: string;
  /** Día del mes, 1..31. Lo usa el gráfico diario. */
  day: number;
  categoryLabel: string;
  categoryColor: string;
  description: string;
  methodLabel: string;
  amount: number;
  type: "expense" | "income";
};

export type PdfTexts = {
  colDate: string;
  colCategory: string;
  colDescription: string;
  colMethod: string;
  colAmount: string;
  total: string;
  income: string;
  expenses: string;
  balance: string;
  byCategory: string;
  byDay: string;
  generatedOn: string;
  movements: string;
};

export type PdfOptions = {
  logoDataUri: string;
  userName: string;
  title: string;
  monthLabel: string;
  txs: PdfTx[];
  daysInMonth: number;
  /** Formatea un monto con su moneda ("S/ 1,234.50"). */
  fmt: (n: number) => string;
  texts: PdfTexts;
  /** Dibujar los gráficos. Se puede apagar desde la pantalla. */
  charts: boolean;
  /** Fecha de generación, ya escrita. */
  generatedAt: string;
};

const VERDE = "#059669";
const ROJO = "#e11d48";

/**
 * Escapa el texto que escribió la persona antes de meterlo en el HTML.
 *
 * Hacía falta y no estaba: las descripciones se pegaban tal cual. Una
 * descripción con "<" o "&" —"pago 100 & pico", "arroz <de 5kg>"— rompía la
 * tabla desde esa fila en adelante, y el PDF salía a medias sin decir por
 * qué. No es un tema de seguridad aquí, porque el HTML no sale del celular;
 * es que el PDF quedaba mal.
 */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Suma por categoría, de mayor a menor, para el gráfico de barras.
 * Solo mira los movimientos del tipo pedido.
 */
export function byCategory(
  txs: PdfTx[],
  type: "expense" | "income"
): { label: string; color: string; amount: number; share: number }[] {
  const sums = new Map<string, { color: string; amount: number }>();
  let total = 0;
  for (const tx of txs) {
    if (tx.type !== type) continue;
    total += tx.amount;
    const prev = sums.get(tx.categoryLabel);
    if (prev) prev.amount += tx.amount;
    else sums.set(tx.categoryLabel, { color: tx.categoryColor, amount: tx.amount });
  }
  if (total === 0) return [];
  return [...sums.entries()]
    .map(([label, v]) => ({ label, color: v.color, amount: v.amount, share: v.amount / total }))
    .sort((a, b) => b.amount - a.amount);
}

/** Suma por día del mes. Devuelve un arreglo de daysInMonth posiciones. */
export function byDay(txs: PdfTx[], type: "expense" | "income", daysInMonth: number): number[] {
  const out = new Array(daysInMonth).fill(0);
  for (const tx of txs) {
    if (tx.type !== type) continue;
    if (tx.day < 1 || tx.day > daysInMonth) continue;
    out[tx.day - 1] += tx.amount;
  }
  return out;
}

/**
 * ¿Entran los números de todos los días debajo del gráfico diario?
 *
 * La hoja útil son 535 puntos y el mes más largo tiene 31 columnas: 17.2
 * puntos cada una. Un "31" a 7px ocupa unos 10.7 puntos, así que entra con
 * holgura y se puede numerar cada día.
 *
 * Esto ya salió mal una vez en la app, donde los números terminaron
 * señalando la barra equivocada, así que aquí se calcula en vez de suponer.
 * Si alguien sube el tamaño de letra o mete márgenes, esta cuenta lo avisa y
 * se numera de dos en dos en lugar de encimarse.
 */
export function dayLabelStep(daysInMonth: number, plotWidth = 535, fontSize = 7): number {
  const colW = plotWidth / daysInMonth;
  const labelW = 2 * fontSize * 0.62 + 2;
  return Math.max(1, Math.ceil(labelW / colW));
}

function barrasPorCategoria(
  filas: { label: string; color: string; amount: number; share: number }[],
  fmt: (n: number) => string
): string {
  // Se dibujan como una tabla y no como cajas flotantes a propósito: el
  // motor de impresión reparte el ancho de las columnas de una tabla de
  // forma fiable, mientras que con flex a veces la barra más larga empujaba
  // el monto fuera de la hoja.
  return filas
    .map(
      (f) => `
        <tr>
          <td style="padding:3px 8px 3px 0;font-size:10px;white-space:nowrap;">${esc(f.label)}</td>
          <td style="padding:3px 0;width:100%;">
            <div style="background:#f1f5f9;border-radius:3px;height:11px;">
              <div style="background:${f.color};width:${(f.share * 100).toFixed(1)}%;height:11px;border-radius:3px;"></div>
            </div>
          </td>
          <td style="padding:3px 0 3px 8px;font-size:10px;text-align:right;white-space:nowrap;font-weight:bold;">${esc(fmt(f.amount))}</td>
          <td style="padding:3px 0 3px 6px;font-size:9px;text-align:right;white-space:nowrap;color:#64748b;">${Math.round(f.share * 100)}%</td>
        </tr>`
    )
    .join("");
}

function barrasPorDia(dias: number[], color: string, paso: number): string {
  const max = Math.max(...dias, 0);
  if (max <= 0) return "";
  // Cada día es una celda de una fila de tabla, así que todas miden lo mismo
  // sin tener que calcular anchos a mano. La barra crece desde abajo con
  // vertical-align.
  const barras = dias
    .map((monto) => {
      const alto = monto > 0 ? Math.max(2, Math.round((monto / max) * 64)) : 0;
      return `<td style="vertical-align:bottom;padding:0 1px;">
          <div style="background:${color};height:${alto}px;border-radius:2px 2px 0 0;"></div>
        </td>`;
    })
    .join("");
  const numeros = dias
    .map((_, i) => {
      const dia = i + 1;
      const visible = dia === 1 || dia % paso === 0 || dia === dias.length;
      return `<td style="text-align:center;font-size:7px;color:#94a3b8;padding-top:3px;">${visible ? dia : ""}</td>`;
    })
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr style="height:66px;">${barras}</tr>
      <tr>${numeros}</tr>
    </table>`;
}

export function buildPdfHtml(o: PdfOptions): string {
  const { texts: T, fmt } = o;

  const ingresos = o.txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const gastos = o.txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = ingresos - gastos;

  // Los gráficos describen los gastos, que es lo que casi siempre se quiere
  // mirar. La excepción es un reporte que solo trae ingresos: ahí graficar
  // gastos daría una hoja en blanco.
  const foco: "expense" | "income" = gastos > 0 ? "expense" : "income";
  const colorFoco = foco === "expense" ? ROJO : VERDE;

  const cats = o.charts ? byCategory(o.txs, foco) : [];
  const dias = o.charts ? byDay(o.txs, foco, o.daysInMonth) : [];
  const hayDias = dias.some((d) => d > 0);
  const paso = dayLabelStep(o.daysInMonth);

  const filas = o.txs
    .map((tx) => {
      const color = tx.type === "expense" ? ROJO : VERDE;
      const signo = tx.type === "expense" ? "-" : "+";
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(tx.dateLabel)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${tx.categoryColor};margin-right:5px;"></span>${esc(tx.categoryLabel)}
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${esc(tx.description || "-")}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(tx.methodLabel)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:${color};font-weight:bold;">${signo}${esc(fmt(tx.amount))}</td>
        </tr>`;
    })
    .join("");

  const tarjeta = (etiqueta: string, monto: string, color: string) => `
    <td style="width:33.3%;padding:0 4px;">
      <div style="border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 11px;">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">${esc(etiqueta)}</div>
        <div style="font-size:15px;font-weight:bold;color:${color};margin-top:2px;">${esc(monto)}</div>
      </div>
    </td>`;

  const bloqueCategorias =
    cats.length > 0
      ? `
      <div style="page-break-inside:avoid;margin-top:20px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byCategory)}</div>
        <table style="width:100%;border-collapse:collapse;">${barrasPorCategoria(cats, fmt)}</table>
      </div>`
      : "";

  const bloqueDias =
    hayDias
      ? `
      <div style="page-break-inside:avoid;margin-top:20px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byDay)}</div>
        ${barrasPorDia(dias, colorFoco, paso)}
      </div>`
      : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 30px 30px 44px 30px; }
      body {
        font-family: -apple-system, Helvetica, Arial, sans-serif;
        color: #0f172a;
        margin: 0;
        font-size: 11px;
      }
      /* Que la cabecera de la tabla se repita en cada hoja. Sin esto, a
         partir de la segunda página las columnas van sin nombre y no se
         sabe cuál es el monto y cuál la fecha. */
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    </style>
  </head>
  <body>

    <!-- CABECERA -->
    <table style="width:100%;border-collapse:collapse;border-bottom:2.5px solid ${VERDE};padding-bottom:0;">
      <tr>
        <td style="width:46px;padding-bottom:11px;">
          <img src="${o.logoDataUri}" style="width:42px;height:42px;border-radius:9px;" />
        </td>
        <td style="padding-bottom:11px;padding-left:10px;vertical-align:middle;">
          <div style="font-size:19px;font-weight:bold;color:${VERDE};line-height:1.1;">Finzo</div>
          <div style="font-size:10px;color:#64748b;">${esc(o.userName)}</div>
        </td>
        <td style="padding-bottom:11px;text-align:right;vertical-align:middle;">
          <div style="font-size:13px;font-weight:bold;">${esc(o.title)}</div>
          <div style="font-size:10px;color:#64748b;">${esc(o.monthLabel)}</div>
        </td>
      </tr>
    </table>

    <!-- RESUMEN -->
    <table style="width:100%;border-collapse:collapse;margin:15px -4px 0 -4px;">
      <tr>
        ${tarjeta(T.income, fmt(ingresos), VERDE)}
        ${tarjeta(T.expenses, fmt(gastos), ROJO)}
        ${tarjeta(T.balance, fmt(balance), balance < 0 ? ROJO : VERDE)}
      </tr>
    </table>

    ${bloqueCategorias}
    ${bloqueDias}

    <!-- MOVIMIENTOS -->
    <div style="font-size:11px;font-weight:bold;color:#334155;margin:22px 0 7px 0;">
      ${esc(T.movements)} (${o.txs.length})
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="text-align:left;padding:7px 8px;border-bottom:1.5px solid #cbd5e1;">${esc(T.colDate)}</th>
          <th style="text-align:left;padding:7px 8px;border-bottom:1.5px solid #cbd5e1;">${esc(T.colCategory)}</th>
          <th style="text-align:left;padding:7px 8px;border-bottom:1.5px solid #cbd5e1;">${esc(T.colDescription)}</th>
          <th style="text-align:left;padding:7px 8px;border-bottom:1.5px solid #cbd5e1;">${esc(T.colMethod)}</th>
          <th style="text-align:right;padding:7px 8px;border-bottom:1.5px solid #cbd5e1;">${esc(T.colAmount)}</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:11px;">
      <tr>
        <td style="text-align:right;font-size:13px;font-weight:bold;padding-top:7px;border-top:2px solid #334155;">
          ${esc(T.total)}: <span style="color:${balance < 0 ? ROJO : VERDE};">${esc(fmt(balance))}</span>
        </td>
      </tr>
    </table>

    <div style="margin-top:22px;font-size:8px;color:#94a3b8;text-align:center;">
      ${esc(T.generatedOn)} ${esc(o.generatedAt)} · Finzo
    </div>
  </body>
</html>`;
}

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
  byCategoryBudget: string;
  byMonth: string;
  byDay: string;
  generatedOn: string;
  movements: string;
};

/** Un límite por categoría y lo que se lleva gastado de él. */
export type PdfCategoryBudget = {
  name: string;
  color: string;
  limit: number;
  spent: number;
};

/** Lo gastado en un mes, para el gráfico de los últimos meses. */
export type PdfMonth = { label: string; value: number };

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
  /** Los límites por categoría que estén puestos. Vacío si no hay ninguno. */
  categoryBudgets: PdfCategoryBudget[];
  /** Los últimos meses con gasto, del más antiguo al más reciente. */
  monthly: PdfMonth[];
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
 * Un trozo de la rosquilla, como orden de dibujo.
 *
 * Se calcula a mano porque el PDF se arma en un WebView aislado donde no se
 * puede cargar ninguna librería de gráficos: todo tiene que ir escrito dentro
 * del propio HTML.
 *
 * Empieza arriba (−90°) y avanza en el sentido del reloj, que es como se lee
 * una rosquilla y como la dibuja la app en Reportes. Sin ese giro empezaría a
 * las tres en punto y no coincidiría con la pantalla.
 */
export function donutSlice(
  desde: number,
  hasta: number,
  cx: number,
  cy: number,
  rFuera: number,
  rDentro: number
): string {
  const a0 = (desde * 2 - 0.5) * Math.PI;
  const a1 = (hasta * 2 - 0.5) * Math.PI;
  const grande = hasta - desde > 0.5 ? 1 : 0;

  const x0 = cx + rFuera * Math.cos(a0);
  const y0 = cy + rFuera * Math.sin(a0);
  const x1 = cx + rFuera * Math.cos(a1);
  const y1 = cy + rFuera * Math.sin(a1);
  const x2 = cx + rDentro * Math.cos(a1);
  const y2 = cy + rDentro * Math.sin(a1);
  const x3 = cx + rDentro * Math.cos(a0);
  const y3 = cy + rDentro * Math.sin(a0);

  const n = (v: number) => v.toFixed(2);
  return [
    `M${n(x0)},${n(y0)}`,
    `A${rFuera},${rFuera} 0 ${grande} 1 ${n(x1)},${n(y1)}`,
    `L${n(x2)},${n(y2)}`,
    `A${rDentro},${rDentro} 0 ${grande} 0 ${n(x3)},${n(y3)}`,
    "Z",
  ].join(" ");
}

/**
 * La rosquilla de gastos por categoría, igual que la de Reportes.
 *
 * Va en SVG y no como imagen: un PDF se imprime y se le hace zoom, y una
 * imagen se ve pastosa. Dibujado así se mantiene nítido a cualquier tamaño.
 */
function rosquilla(
  filas: { label: string; color: string; amount: number; share: number }[],
  total: number,
  fmt: (n: number) => string,
  totalLabel: string
): string {
  const CX = 78;
  const CY = 78;
  const R_FUERA = 66;
  const R_DENTRO = 44;

  let acumulado = 0;
  const trozos = filas
    .map((f) => {
      const desde = acumulado;
      acumulado += f.share;
      // Una categoría que no llega al medio grado no se dibuja: saldría como
      // una raya sobre el borde y ensuciaría el resto.
      if (f.share < 0.0015) return "";
      return `<path d="${donutSlice(desde, acumulado, CX, CY, R_FUERA, R_DENTRO)}" fill="${f.color}" />`;
    })
    .join("");

  return `
    <svg width="156" height="156" viewBox="0 0 156 156">
      ${trozos}
      <text x="${CX}" y="${CY - 4}" text-anchor="middle" font-size="9" fill="#64748b">${esc(totalLabel)}</text>
      <text x="${CX}" y="${CY + 11}" text-anchor="middle" font-size="13" font-weight="bold" fill="#0f172a">${esc(fmt(total))}</text>
    </svg>`;
}

/** Los límites por categoría: cuánto se lleva de cada uno. */
function barrasPresupuesto(filas: PdfCategoryBudget[], fmt: (n: number) => string): string {
  return filas
    .map((f) => {
      const parte = f.limit > 0 ? Math.min(1, f.spent / f.limit) : 0;
      // Pasarse del límite se pinta en rojo. Es el dato que se busca en esta
      // tabla, así que se ve sin tener que comparar los dos números.
      const color = f.spent > f.limit ? ROJO : f.color;
      return `
        <tr>
          <td style="padding:3px 8px 3px 0;font-size:10px;white-space:nowrap;">${esc(f.name)}</td>
          <td style="padding:3px 0;width:100%;">
            <div style="background:#f1f5f9;border-radius:3px;height:10px;">
              <div style="background:${color};width:${(parte * 100).toFixed(1)}%;height:10px;border-radius:3px;"></div>
            </div>
          </td>
          <td style="padding:3px 0 3px 8px;font-size:9px;text-align:right;white-space:nowrap;color:#64748b;">
            ${esc(fmt(f.spent))} / ${esc(fmt(f.limit))}
          </td>
        </tr>`;
    })
    .join("");
}

/** Gasto de los últimos meses, en columnas. */
function barrasPorMes(meses: PdfMonth[], fmt: (n: number) => string): string {
  const max = Math.max(...meses.map((m) => m.value), 0);
  if (max <= 0) return "";
  const columnas = meses
    .map((m) => {
      const alto = Math.max(3, Math.round((m.value / max) * 70));
      return `<td style="vertical-align:bottom;padding:0 10px;text-align:center;">
          <div style="font-size:9px;color:#334155;margin-bottom:3px;">${esc(fmt(m.value))}</div>
          <div style="background:${VERDE};height:${alto}px;border-radius:3px 3px 0 0;"></div>
        </td>`;
    })
    .join("");
  const etiquetas = meses
    .map((m) => `<td style="text-align:center;font-size:9px;color:#64748b;padding-top:4px;">${esc(m.label)}</td>`)
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr style="height:86px;">${columnas}</tr>
      <tr>${etiquetas}</tr>
    </table>`;
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

/** Lo que ocupa un texto, aproximado. Suficiente para decidir si cabe. */
export function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58 + 2;
}

/**
 * Cómo se coloca el gráfico diario.
 *
 * Se separa del dibujo para poder comprobarla: que un monto no se salga de su
 * columna es una cuenta, no algo que haya que mirar a ojo. Ya pasó una vez en
 * la app que los números acabaron señalando la barra equivocada.
 *
 * Si los montos no caben tumbados, se ponen de pie. Es preferible girar el
 * texto a no enseñarlo: el monto es justo el dato que se busca en este
 * gráfico.
 */
export function dailyLayout(
  cuantos: number,
  etiquetas: string[],
  ancho = 535,
  fontSize = 7
): { colW: number; barW: number; girar: boolean; espacioArriba: number } {
  const colW = cuantos > 0 ? ancho / cuantos : ancho;
  const masAncha = Math.max(0, ...etiquetas.map((e) => textWidth(e, fontSize)));
  const girar = masAncha > colW - 2;
  return {
    colW,
    // La barra deja un respiro a cada lado, y no pasa de 30 para que con dos
    // o tres días no salgan tres columnas gordísimas.
    barW: Math.max(4, Math.min(30, colW - 8)),
    girar,
    // De pie, el monto ocupa a lo alto lo que ocupaba a lo ancho.
    espacioArriba: girar ? masAncha + 4 : fontSize + 4,
  };
}

/**
 * Gasto de cada día, con su monto encima.
 *
 * SOLO LOS DÍAS EN QUE HUBO MOVIMIENTO
 *
 * Antes se dibujaban los 31 días del mes. Con 31 columnas en el ancho de una
 * hoja, cada una queda en 17 puntos, y ahí no cabe un "S/ 1,234.56": por eso
 * el monto no se enseñaba y solo salía la barra. Un gráfico de gastos sin los
 * montos obliga a adivinar mirando la altura.
 *
 * Enseñando solo los días con gasto —lo mismo que hace la app en Reportes—
 * las columnas se ensanchan y el monto entra. Y los días vacíos no se pierden:
 * nunca dijeron nada.
 */
function barrasPorDia(
  dias: { day: number; amount: number }[],
  color: string,
  fmt: (n: number) => string
): string {
  if (dias.length === 0) return "";
  const max = Math.max(...dias.map((d) => d.amount));
  if (max <= 0) return "";

  const ANCHO = 535;
  const ALTO_BARRAS = 64;
  const etiquetas = dias.map((d) => fmt(d.amount));
  const { colW, barW, girar, espacioArriba } = dailyLayout(dias.length, etiquetas);

  const baseY = espacioArriba + ALTO_BARRAS;
  const alto = baseY + 16;

  const piezas = dias
    .map((d, i) => {
      const cx = i * colW + colW / 2;
      const h = Math.max(2, (d.amount / max) * ALTO_BARRAS);
      const y = baseY - h;
      const texto = esc(etiquetas[i]);
      const monto = girar
        ? `<text x="${cx.toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="7" fill="#334155" text-anchor="start" transform="rotate(-90 ${cx.toFixed(1)} ${(y - 4).toFixed(1)})">${texto}</text>`
        : `<text x="${cx.toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="7" fill="#334155" text-anchor="middle">${texto}</text>`;
      return `
        <rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}" />
        ${monto}
        <text x="${cx.toFixed(1)}" y="${(baseY + 11).toFixed(1)}" font-size="7" fill="#94a3b8" text-anchor="middle">${d.day}</text>`;
    })
    .join("");

  return `<svg width="100%" viewBox="0 0 ${ANCHO} ${alto.toFixed(0)}">
      <line x1="0" y1="${baseY}" x2="${ANCHO}" y2="${baseY}" stroke="#e2e8f0" stroke-width="1" />
      ${piezas}
    </svg>`;
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

  // Los dos repartos, cada uno con sus categorias. Antes solo se calculaba
  // el del "foco" —los gastos salvo que no hubiera ninguno—, asi que en un
  // reporte con las dos cosas los ingresos no salian en ningun grafico.
  const catsGasto = o.charts ? byCategory(o.txs, "expense") : [];
  const catsIngreso = o.charts ? byCategory(o.txs, "income") : [];
  // Solo los dias con movimiento, con su numero de dia de verdad. Enviar el
  // arreglo entero de 31 posiciones dejaba las columnas en 17 puntos, donde
  // no cabe ningun monto.
  const dias = o.charts
    ? byDay(o.txs, foco, o.daysInMonth)
        .map((amount, i) => ({ day: i + 1, amount }))
        .filter((d) => d.amount > 0)
    : [];
  const hayDias = dias.length > 0;

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

  // La rosquilla va al lado de la lista, no debajo: así el bloque entero cabe
  // en el alto de la propia rosquilla y no se come media hoja.
  const totalGastoCats = catsGasto.reduce((s, c) => s + c.amount, 0);
  const totalIngresoCats = catsIngreso.reduce((s, c) => s + c.amount, 0);
  /**
   * El reparto por categoría de un lado: la rosquilla y sus barras.
   *
   * Se saca a una función porque ahora se dibuja DOS VECES cuando el reporte
   * trae gastos e ingresos. Antes solo se dibujaba el reparto de los gastos,
   * aunque el documento llevara las dos cosas: quien exportaba su mes entero
   * veía sus 1.500 de sueldo en la lista del final y en ningún gráfico.
   */
  const repartoDe = (
    titulo: string,
    lista: { label: string; color: string; amount: number; share: number }[],
    total: number
  ) =>
    lista.length === 0
      ? ""
      : `
      <div style="page-break-inside:avoid;margin-top:20px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(titulo)}</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:170px;vertical-align:middle;">${rosquilla(lista, total, fmt, T.total)}</td>
            <td style="vertical-align:middle;padding-left:6px;">
              <table style="width:100%;border-collapse:collapse;">${barrasPorCategoria(lista, fmt)}</table>
            </td>
          </tr>
        </table>
      </div>`;

  // Con las dos cosas dentro, cada bloque dice de cuál habla. Dos rosquillas
  // seguidas bajo el mismo "Reparto por categoría" no se distinguirían: los
  // dos son montos por categoría y solo cambia el signo.
  const hayDeTodo = o.charts && catsGasto.length > 0 && catsIngreso.length > 0;
  const bloqueCategorias =
    repartoDe(hayDeTodo ? T.expenses : T.byCategory, catsGasto, totalGastoCats) +
    repartoDe(hayDeTodo ? T.income : T.byCategory, catsIngreso, totalIngresoCats);

  const bloquePresupuestos =
    o.charts && o.categoryBudgets.length > 0
      ? `
      <div style="page-break-inside:avoid;margin-top:20px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byCategoryBudget)}</div>
        <table style="width:100%;border-collapse:collapse;">${barrasPresupuesto(o.categoryBudgets, fmt)}</table>
      </div>`
      : "";

  const bloqueMeses =
    o.charts && o.monthly.length > 1
      ? `
      <div style="page-break-inside:avoid;margin-top:20px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byMonth)}</div>
        ${barrasPorMes(o.monthly, fmt)}
      </div>`
      : "";

  const bloqueDias =
    hayDias
      ? `
      <div style="page-break-inside:avoid;margin-top:20px;">
        <!-- Con las dos cosas dentro, el título dice de cuál son las columnas.
             Este gráfico sigue siendo de gasto: los ingresos de un mes son
             dos o tres días sueltos y un gráfico diario de eso serían tres
             columnas perdidas en una hoja vacía. Pero llamarlo solo "Día a
             día" en un reporte que trae las dos parecía que faltaban. -->
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(
          hayDeTodo ? `${T.byDay} · ${T.expenses}` : T.byDay
        )}</div>
        ${barrasPorDia(dias, colorFoco, fmt)}
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
    ${bloquePresupuestos}
    ${bloqueMeses}
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

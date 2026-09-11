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
  timeLabel?: string;
  typeLabel?: string;
  /** Día del mes, 1..31. Lo usa el gráfico diario. */
  day: number;
  categoryLabel: string;
  categoryColor: string;
  description: string;
  methodLabel: string;
  amount: number;
  type: "expense" | "income";
  internalTransfer?: boolean;
};

export type PdfTexts = {
  colDate: string;
  colTime?: string;
  colType?: string;
  colCategory: string;
  colDescription: string;
  colMethod: string;
  colAmount: string;
  total: string;
  income: string;
  expenses: string;
  balance: string;
  available?: string;
  budget?: string;
  previousBalance?: string;
  periodResult?: string;
  space?: string;
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
  spaceName?: string;
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
  summary?: {
    available: number;
    income: number;
    expenses: number;
    result: number;
    budget?: number;
    previousBalance?: number;
  };
};

const VERDE = "#059669";
const ROJO = "#e11d48";

/**
 * Lo más ancha que puede salir una columna, en los dos gráficos de columnas.
 *
 * POR QUÉ HACE FALTA UN TOPE
 *
 * Las columnas se reparten el ancho de la hoja: con veinte días salen finitas, y
 * con dos meses cada una se queda con media hoja. El gráfico de "Gasto por mes"
 * salía así y el usuario lo reportó el 07/08/2026: *"las barras tienen un tamaño
 * desproporcional, deberían tener un tamaño normal"*. Dos bloques enormes en vez
 * de dos columnas.
 *
 * ES UNA SOLA CONSTANTE PARA LOS DOS GRÁFICOS, y eso es el arreglo de verdad: el
 * de día a día YA tenía este tope —con su comentario y todo, "para que con dos o
 * tres días no salgan tres columnas gordísimas"— y el mensual no. La misma
 * lección aprendida en un gráfico y sin aplicar en el de al lado, que es el fallo
 * que este proyecto repite. Compartiendo el número no puede volver a pasar.
 */
export const ANCHO_MAX_BARRA = 30;

/**
 * Los gráficos necesitan una cifra que se lea de un vistazo. El valor exacto
 * sigue en la tabla de movimientos; aquí se abrevia únicamente cuando ocuparía
 * más que su columna. K, M, B y T evitan que una cifra enorme empuje la barra
 * y las demás etiquetas fuera de la hoja.
 */
export function compactChartAmount(amount: number, fmt: (n: number) => string): string {
  const exacto = fmt(amount);
  if (exacto.length <= 14) return exacto;

  const absoluto = Math.abs(amount);
  const unidades = [
    { valor: 1e12, sufijo: "T" },
    { valor: 1e9, sufijo: "B" },
    { valor: 1e6, sufijo: "M" },
    { valor: 1e3, sufijo: "K" },
  ];
  const unidad = unidades.find((u) => absoluto >= u.valor);
  if (!unidad) return exacto;

  const escalado = amount / unidad.valor;
  const decimales = Math.abs(escalado) >= 100 ? 0 : Math.abs(escalado) >= 10 ? 1 : 2;
  const numero = escalado.toFixed(decimales).replace(/\.0+$|(?<=\.[0-9])0$/g, "");
  const moneda = exacto.replace(/[\d\s.,'’\-]/g, "").trim();
  return `${moneda ? `${moneda} ` : ""}${numero} ${unidad.sufijo}`;
}

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
    if (tx.type !== type || tx.internalTransfer) continue;
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
    if (tx.type !== type || tx.internalTransfer) continue;
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
          <td style="padding:5px 10px 5px 0;font-size:9px;width:24%;overflow-wrap:anywhere;">${esc(f.name)}</td>
          <td style="padding:5px 0;width:52%;vertical-align:middle;">
            <div style="background:#e2e8f0;border-radius:5px;height:8px;overflow:hidden;">
              <div style="background:${color};width:${(parte * 100).toFixed(1)}%;height:8px;border-radius:5px;"></div>
            </div>
          </td>
          <td style="padding:5px 0 5px 10px;width:24%;font-size:8px;text-align:right;color:#475569;line-height:1.35;">
            <strong style="color:${color};">${esc(compactChartAmount(f.spent, fmt))}</strong><br />
            de ${esc(compactChartAmount(f.limit, fmt))} · ${Math.round((f.limit > 0 ? f.spent / f.limit : 0) * 100)}%
          </td>
        </tr>`;
    })
    .join("");
}

/** Gasto de los últimos meses, en columnas. */
function barrasPorMes(meses: PdfMonth[], fmt: (n: number) => string): string {
  const max = Math.max(...meses.map((m) => m.value), 0);
  if (max <= 0) return "";
  const filas = meses
    .map((m) => {
      const ancho = Math.max(2, (m.value / max) * 100);
      return `<tr>
        <td style="width:18%;padding:5px 10px 5px 0;font-size:9px;color:#475569;">${esc(m.label)}</td>
        <td style="width:58%;padding:5px 0;vertical-align:middle;">
          <div style="height:8px;background:#e2e8f0;border-radius:5px;overflow:hidden;">
            <div style="height:8px;width:${ancho.toFixed(1)}%;background:${VERDE};border-radius:5px;"></div>
          </div>
        </td>
        <td style="width:24%;padding:5px 0 5px 10px;text-align:right;font-size:9px;font-weight:bold;color:#0f766e;">${esc(compactChartAmount(m.value, fmt))}</td>
      </tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">${filas}</table>`;
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
          <td style="padding:5px 10px 5px 0;font-size:9px;width:24%;overflow-wrap:anywhere;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${f.color};margin-right:5px;"></span>${esc(f.label)}
          </td>
          <td style="padding:5px 0;width:52%;vertical-align:middle;">
            <div style="background:#e2e8f0;border-radius:5px;height:8px;overflow:hidden;">
              <div style="background:${f.color};width:${(f.share * 100).toFixed(1)}%;height:8px;border-radius:5px;"></div>
            </div>
          </td>
          <td style="padding:5px 0 5px 10px;width:24%;font-size:9px;text-align:right;font-weight:bold;line-height:1.35;">
            ${esc(compactChartAmount(f.amount, fmt))}<br /><span style="font-size:8px;font-weight:normal;color:#64748b;">${Math.round(f.share * 100)}%</span>
          </td>
        </tr>`
    )
    .join("");
}

/** Lo que ocupa un texto, aproximado. Suficiente para decidir si cabe. */
/**
 * Lo que ocupa un texto EN EL PDF, a ojo.
 *
 * Lleva el sufijo Pdf porque hay otra igual para el grafico de la pantalla,
 * en components/DailyBarsChart, con numeros distintos: no es la misma fuente
 * ni el mismo motor de dibujo. Las dos se llamaban textWidth, y con el mismo
 * nombre importar la que no toca dejaba el dibujo mal medido sin dar ningun
 * error — el peor tipo de fallo, porque se ve raro y no se sabe por que.
 */
export function textWidthPdf(text: string, fontSize: number): number {
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
  const masAncha = Math.max(0, ...etiquetas.map((e) => textWidthPdf(e, fontSize)));
  const girar = masAncha > colW - 2;
  return {
    colW,
    // La barra deja un respiro a cada lado, y no pasa del tope para que con dos
    // o tres días no salgan tres columnas gordísimas. Ver ANCHO_MAX_BARRA: el
    // mismo número lo usa el gráfico por mes.
    barW: Math.max(4, Math.min(ANCHO_MAX_BARRA, colW - 8)),
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

  const filas = dias
    .map((d) => {
      const ancho = Math.max(2, (d.amount / max) * 100);
      return `<tr>
        <td style="width:18%;padding:5px 10px 5px 0;font-size:9px;color:#475569;">Día ${d.day}</td>
        <td style="width:58%;padding:5px 0;vertical-align:middle;">
          <div style="height:8px;background:#e2e8f0;border-radius:5px;overflow:hidden;">
            <div style="height:8px;width:${ancho.toFixed(1)}%;background:${color};border-radius:5px;"></div>
          </div>
        </td>
        <td style="width:24%;padding:5px 0 5px 10px;text-align:right;font-size:9px;font-weight:bold;color:${color};">${esc(compactChartAmount(d.amount, fmt))}</td>
      </tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">${filas}</table>`;
}

/**
 * Alto aproximado del documento, en puntos, para saber si cabe en una hoja.
 *
 * Es una CUENTA A OJO, no una medida: quien mide de verdad es el motor que
 * arma el PDF, y ese no dice nada hasta que ya lo armó. Pero para esto basta
 * con acertar el orden de magnitud, porque lo único que se decide con el
 * número es apretar un poco el espaciado o no.
 *
 * Los valores salen de lo que ocupa cada bloque con el espaciado normal.
 */
export function alturaEstimada(p: {
  categorias: number;
  presupuestos: number;
  meses: number;
  dias: number;
  movimientos: number;
}): number {
  let alto = 120; // cabecera con el logo + las tres tarjetas de totales
  if (p.categorias > 0) alto += 34 + p.categorias * 20;
  if (p.presupuestos > 0) alto += 34 + p.presupuestos * 20;
  if (p.meses > 1) alto += 34 + p.meses * 20;
  if (p.dias > 0) alto += 34 + p.dias * 20;
  alto += 52 + p.movimientos * 26 + 44; // título, filas y la línea de Total
  return alto;
}

/** Alto util de una hoja A4 con sus margenes, en los mismos puntos. */
export const ALTO_HOJA = 1040;

/**
 * ¿Vale la pena apretar el documento para que quepa en una hoja?
 *
 * Solo cuando se pasa POCO. Si cabe de sobra no hay nada que apretar, y si se
 * pasa por mucho —veinte movimientos y todos los gráficos— no hay espaciado
 * que lo salve: apretarlo dejaría el documento incómodo de leer y seguiría
 * ocupando dos hojas igual.
 */
export function cabeApretando(alto: number): boolean {
  return alto > ALTO_HOJA && alto <= ALTO_HOJA * 1.3;
}

export function buildPdfHtml(o: PdfOptions): string {
  const { texts: T, fmt } = o;

  const ingresosCalculados = o.txs.filter((t) => t.type === "income" && !t.internalTransfer).reduce((s, t) => s + t.amount, 0);
  const gastosCalculados = o.txs.filter((t) => t.type === "expense" && !t.internalTransfer).reduce((s, t) => s + t.amount, 0);
  const resumen = o.summary ?? {
    available: ingresosCalculados - gastosCalculados,
    income: ingresosCalculados,
    expenses: gastosCalculados,
    result: ingresosCalculados - gastosCalculados,
  };
  const ingresos = resumen.income;
  const gastos = resumen.expenses;
  const balance = resumen.result;
  const totalSeleccionado = o.txs.reduce(
    (suma, tx) => suma + (tx.type === "expense" ? -tx.amount : tx.amount),
    0
  );

  // Los gráficos describen los gastos, que es lo que casi siempre se quiere
  // mirar. La excepción es un reporte que solo trae ingresos: ahí graficar
  // gastos daría una hoja en blanco.
  const gastosGraficables = o.txs
    .filter((tx) => tx.type === "expense" && !tx.internalTransfer)
    .reduce((suma, tx) => suma + tx.amount, 0);
  const foco: "expense" | "income" = gastosGraficables > 0 ? "expense" : "income";
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

  // ¿Se apreta el documento para que quepa en una hoja?
  //
  // Solo cuando falta poco. Con pocos movimientos ya cabía y no hay nada que
  // hacer; con muchos no cabría de ninguna forma y apretarlo solo lo dejaría
  // incómodo de leer para acabar ocupando dos hojas igual.
  const apretar = cabeApretando(
    alturaEstimada({
      // Solo las del lado que SE DIBUJA. Sumar los dos contaba una rosquilla
      // que ya no existe —desde que volvió a haber una sola— y hacía creer al
      // cálculo que el documento era más largo de lo que es. El efecto era
      // apretar documentos que cabían de sobra.
      categorias: foco === "expense" ? catsGasto.length : catsIngreso.length,
      presupuestos: o.charts ? o.categoryBudgets.length : 0,
      meses: o.charts ? o.monthly.length : 0,
      dias: dias.length,
      movimientos: o.txs.length,
    })
  );
  const sep = apretar ? 11 : 20;
  const padFila = apretar ? "3px 8px" : "6px 8px";

  const filas = o.txs
    .map((tx) => {
      const color = tx.type === "expense" ? ROJO : VERDE;
      const signo = tx.type === "expense" ? "-" : "+";
      return `
        <tr>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(tx.dateLabel)}</td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(tx.timeLabel || "-")}</td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere;">${esc(tx.typeLabel || (tx.type === "expense" ? T.expenses : T.income))}</td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${tx.categoryColor};margin-right:5px;"></span>${esc(tx.categoryLabel)}
          </td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere;">${esc(tx.description || "-")}</td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere;">${esc(tx.methodLabel)}</td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:${color};font-weight:bold;">${signo}${esc(compactChartAmount(tx.amount, fmt))}</td>
        </tr>`;
    })
    .join("");

  const tarjeta = (etiqueta: string, monto: string, color: string, width = "25%") => `
    <td style="width:${width};padding:0 4px 8px 4px;vertical-align:top;">
      <div style="border:1px solid #e2e8f0;border-radius:9px;padding:8px 10px;background:#fff;">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">${esc(etiqueta)}</div>
        <div style="font-size:13px;font-weight:bold;color:${color};margin-top:3px;white-space:nowrap;">${esc(monto)}</div>
      </div>
    </td>`;

  const tarjetasResumen =
    resumen.budget == null && resumen.previousBalance == null
      ? `<tr>
          ${tarjeta(T.income, compactChartAmount(ingresos, fmt), VERDE, "33.33%")}
          ${tarjeta(T.expenses, compactChartAmount(gastos, fmt), ROJO, "33.33%")}
          ${tarjeta(T.periodResult || T.balance, compactChartAmount(balance, fmt), balance < 0 ? ROJO : VERDE, "33.33%")}
        </tr>`
      : `<tr>
          ${resumen.budget == null ? "" : tarjeta(T.budget || "Presupuesto", compactChartAmount(resumen.budget, fmt), "#0f172a")}
          ${resumen.previousBalance == null ? "" : tarjeta(T.previousBalance || "Saldo anterior", compactChartAmount(resumen.previousBalance, fmt), "#0f766e")}
          ${tarjeta(T.income, compactChartAmount(ingresos, fmt), VERDE)}
          ${tarjeta(T.expenses, compactChartAmount(gastos, fmt), ROJO)}
        </tr>
        <tr>
          ${tarjeta(T.periodResult || T.balance, compactChartAmount(balance, fmt), balance < 0 ? ROJO : VERDE, "25%")}
        </tr>`;

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
      <div style="margin-top:${sep}px;border:1px solid #e2e8f0;border-radius:9px;padding:10px 12px;page-break-inside:avoid;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(titulo)}</div>
        <div style="font-size:8px;color:#64748b;margin-bottom:5px;">${esc(T.total)}: <strong style="color:#334155;">${esc(compactChartAmount(total, fmt))}</strong></div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">${barrasPorCategoria(lista, fmt)}</table>
      </div>`;

  // UNA SOLA ROSQUILLA, LA DE GASTOS.
  //
  // Se probó a dibujar también la de ingresos y no compensa: en un mes normal
  // los ingresos son dos o tres categorías —el sueldo y poco más—, así que
  // una rosquilla entera para eso empujaba la lista de movimientos a la hoja
  // siguiente a cambio de dos líneas de información. El reparto de ingresos
  // se ve igual de bien en la lista del final, con sus montos en verde.
  //
  // Un reporte de SOLO ingresos sí la lleva: ahí graficar gastos daría una
  // hoja en blanco. De eso se encarga el "foco" de arriba.
  const hayDeTodo = o.charts && catsGasto.length > 0 && catsIngreso.length > 0;
  const catsFoco = foco === "expense" ? catsGasto : catsIngreso;
  const totalFoco = foco === "expense" ? totalGastoCats : totalIngresoCats;
  // Con las dos cosas dentro, el título dice de cuál es la rosquilla. Sin
  // eso, "Reparto por categoría" en un documento que trae gastos e ingresos
  // se lee como si fueran los dos, y los números no cuadran con el total.
  const bloqueCategorias = repartoDe(
    hayDeTodo ? `${T.byCategory} · ${T.expenses}` : T.byCategory,
    catsFoco,
    totalFoco
  );

  const bloquePresupuestos =
    o.charts && o.categoryBudgets.length > 0
      ? `
      <div style="margin-top:${sep}px;border:1px solid #e2e8f0;border-radius:9px;padding:10px 12px;page-break-inside:avoid;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byCategoryBudget)}</div>
        <table style="width:100%;border-collapse:collapse;">${barrasPresupuesto(o.categoryBudgets, fmt)}</table>
      </div>`
      : "";

  const bloqueMeses =
    o.charts && o.monthly.length > 1
      ? `
      <div style="margin-top:${sep}px;border:1px solid #e2e8f0;border-radius:9px;padding:10px 12px;page-break-inside:avoid;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byMonth)}</div>
        ${barrasPorMes(o.monthly, fmt)}
      </div>`
      : "";

  const bloqueDias =
    hayDias
      ? `
      <div style="margin-top:${sep}px;border:1px solid #e2e8f0;border-radius:9px;padding:10px 12px;page-break-inside:avoid;">
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
      @page { size: A4; margin: 30px 30px 44px 30px; }
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
          <div style="font-size:19px;font-weight:bold;color:${VERDE};line-height:1.1;">Fino</div>
          <div style="font-size:10px;color:#64748b;">${esc(o.userName)}</div>
        </td>
        <td style="padding-bottom:11px;text-align:right;vertical-align:middle;">
          <div style="font-size:13px;font-weight:bold;">${esc(o.title)}</div>
          <div style="font-size:10px;color:#64748b;">${esc(o.monthLabel)}</div>
          <div style="font-size:9px;color:#0f766e;margin-top:2px;">${esc(T.space || "Espacio")}: ${esc(o.spaceName || "Personal")}</div>
        </td>
      </tr>
    </table>

    <!-- SALDO PRINCIPAL -->
    <div style="margin-top:14px;border-radius:11px;background:#ecfdf5;border:1px solid #a7f3d0;padding:11px 13px;">
      <div style="font-size:9px;color:#047857;text-transform:uppercase;letter-spacing:.5px;font-weight:bold;">${esc(T.available || "Saldo disponible")}</div>
      <div style="font-size:22px;line-height:1.2;font-weight:800;color:${resumen.available < 0 ? ROJO : VERDE};margin-top:2px;">${esc(compactChartAmount(resumen.available, fmt))}</div>
    </div>

    <!-- RESUMEN DEL MES -->
    <table style="width:calc(100% + 8px);border-collapse:collapse;margin:10px -4px 0 -4px;table-layout:fixed;">
      ${tarjetasResumen}
    </table>

    <!-- MOVIMIENTOS -->
    <!-- page-break-after:avoid pega el título a su tabla.
         Sin esto el corte de hoja caía justo debajo del título y la primera
         página terminaba con un "Movimientos (21)" solo, sin ni una fila
         debajo. Desde fuera parece que la lista no salió, no que siguiera en
         la hoja siguiente. -->
    <div style="font-size:11px;font-weight:bold;color:#334155;margin:${sep + 2}px 0 7px 0;page-break-after:avoid;">
      ${esc(T.movements)} (${o.txs.length})
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed;">
      <colgroup>
        <col style="width:10%;" /><col style="width:9%;" /><col style="width:11%;" />
        <col style="width:14%;" /><col style="width:28%;" /><col style="width:15%;" />
        <col style="width:13%;" />
      </colgroup>
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="text-align:left;padding:7px 8px;border-bottom:1.5px solid #cbd5e1;">${esc(T.colDate)}</th>
          <th style="text-align:left;padding:7px 8px;border-bottom:1.5px solid #cbd5e1;">${esc(T.colTime || "Hora")}</th>
          <th style="text-align:left;padding:7px 8px;border-bottom:1.5px solid #cbd5e1;">${esc(T.colType || "Tipo")}</th>
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
          ${esc(T.total)}: <span style="color:${totalSeleccionado < 0 ? ROJO : VERDE};">${esc(compactChartAmount(totalSeleccionado, fmt))}</span>
        </td>
      </tr>
    </table>

    <!-- LOS GRÁFICOS, DEBAJO DE LOS MOVIMIENTOS (13/08/2026).
         Pedido suyo: "las gráficas siempre deben estar debajo de los movimientos".
         Estaban arriba, y con un mes de pocos movimientos la primera hoja era casi toda
         gráficos: había que bajar para ver lo que se fue a buscar. Los movimientos son el
         documento; los gráficos, el resumen de lo que ya se leyó. -->
    ${bloqueCategorias}
    ${bloquePresupuestos}
    ${bloqueMeses}
    ${bloqueDias}

    <div style="margin-top:22px;font-size:8px;color:#94a3b8;text-align:center;">
      ${esc(T.generatedOn)} ${esc(o.generatedAt)} · Fino
    </div>
  </body>
</html>`;
}

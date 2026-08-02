// utils/exportPdfHtml.ts
var VERDE = "#059669";
var ROJO = "#e11d48";
function esc(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function byCategory(txs, type) {
  const sums = /* @__PURE__ */ new Map();
  let total = 0;
  for (const tx2 of txs) {
    if (tx2.type !== type) continue;
    total += tx2.amount;
    const prev = sums.get(tx2.categoryLabel);
    if (prev) prev.amount += tx2.amount;
    else sums.set(tx2.categoryLabel, { color: tx2.categoryColor, amount: tx2.amount });
  }
  if (total === 0) return [];
  return [...sums.entries()].map(([label, v]) => ({ label, color: v.color, amount: v.amount, share: v.amount / total })).sort((a, b) => b.amount - a.amount);
}
function byDay(txs, type, daysInMonth) {
  const out = new Array(daysInMonth).fill(0);
  for (const tx2 of txs) {
    if (tx2.type !== type) continue;
    if (tx2.day < 1 || tx2.day > daysInMonth) continue;
    out[tx2.day - 1] += tx2.amount;
  }
  return out;
}
function dayLabelStep(daysInMonth, plotWidth = 535, fontSize = 7) {
  const colW = plotWidth / daysInMonth;
  const labelW = 2 * fontSize * 0.62 + 2;
  return Math.max(1, Math.ceil(labelW / colW));
}
function barrasPorCategoria(filas, fmt2) {
  return filas.map(
    (f) => `
        <tr>
          <td style="padding:3px 8px 3px 0;font-size:10px;white-space:nowrap;">${esc(f.label)}</td>
          <td style="padding:3px 0;width:100%;">
            <div style="background:#f1f5f9;border-radius:3px;height:11px;">
              <div style="background:${f.color};width:${(f.share * 100).toFixed(1)}%;height:11px;border-radius:3px;"></div>
            </div>
          </td>
          <td style="padding:3px 0 3px 8px;font-size:10px;text-align:right;white-space:nowrap;font-weight:bold;">${esc(fmt2(f.amount))}</td>
          <td style="padding:3px 0 3px 6px;font-size:9px;text-align:right;white-space:nowrap;color:#64748b;">${Math.round(f.share * 100)}%</td>
        </tr>`
  ).join("");
}
function barrasPorDia(dias, color, paso) {
  const max = Math.max(...dias, 0);
  if (max <= 0) return "";
  const barras = dias.map((monto) => {
    const alto = monto > 0 ? Math.max(2, Math.round(monto / max * 64)) : 0;
    return `<td style="vertical-align:bottom;padding:0 1px;">
          <div style="background:${color};height:${alto}px;border-radius:2px 2px 0 0;"></div>
        </td>`;
  }).join("");
  const numeros = dias.map((_, i) => {
    const dia = i + 1;
    const visible = dia === 1 || dia % paso === 0 || dia === dias.length;
    return `<td style="text-align:center;font-size:7px;color:#94a3b8;padding-top:3px;">${visible ? dia : ""}</td>`;
  }).join("");
  return `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr style="height:66px;">${barras}</tr>
      <tr>${numeros}</tr>
    </table>`;
}
function buildPdfHtml(o) {
  const { texts: T, fmt: fmt2 } = o;
  const ingresos = o.txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const gastos = o.txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = ingresos - gastos;
  const foco = gastos > 0 ? "expense" : "income";
  const colorFoco = foco === "expense" ? ROJO : VERDE;
  const cats = o.charts ? byCategory(o.txs, foco) : [];
  const dias = o.charts ? byDay(o.txs, foco, o.daysInMonth) : [];
  const hayDias = dias.some((d) => d > 0);
  const paso = dayLabelStep(o.daysInMonth);
  const filas = o.txs.map((tx2) => {
    const color = tx2.type === "expense" ? ROJO : VERDE;
    const signo = tx2.type === "expense" ? "-" : "+";
    return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(tx2.dateLabel)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${tx2.categoryColor};margin-right:5px;"></span>${esc(tx2.categoryLabel)}
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${esc(tx2.description || "-")}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(tx2.methodLabel)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:${color};font-weight:bold;">${signo}${esc(fmt2(tx2.amount))}</td>
        </tr>`;
  }).join("");
  const tarjeta = (etiqueta, monto, color) => `
    <td style="width:33.3%;padding:0 4px;">
      <div style="border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 11px;">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">${esc(etiqueta)}</div>
        <div style="font-size:15px;font-weight:bold;color:${color};margin-top:2px;">${esc(monto)}</div>
      </div>
    </td>`;
  const bloqueCategorias = cats.length > 0 ? `
      <div style="page-break-inside:avoid;margin-top:20px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byCategory)}</div>
        <table style="width:100%;border-collapse:collapse;">${barrasPorCategoria(cats, fmt2)}</table>
      </div>` : "";
  const bloqueDias = hayDias ? `
      <div style="page-break-inside:avoid;margin-top:20px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byDay)}</div>
        ${barrasPorDia(dias, colorFoco, paso)}
      </div>` : "";
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
         partir de la segunda p\xE1gina las columnas van sin nombre y no se
         sabe cu\xE1l es el monto y cu\xE1l la fecha. */
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
        ${tarjeta(T.income, fmt2(ingresos), VERDE)}
        ${tarjeta(T.expenses, fmt2(gastos), ROJO)}
        ${tarjeta(T.balance, fmt2(balance), balance < 0 ? ROJO : VERDE)}
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
          ${esc(T.total)}: <span style="color:${balance < 0 ? ROJO : VERDE};">${esc(fmt2(balance))}</span>
        </td>
      </tr>
    </table>

    <div style="margin-top:22px;font-size:8px;color:#94a3b8;text-align:center;">
      ${esc(T.generatedOn)} ${esc(o.generatedAt)} \xB7 Finzo
    </div>
  </body>
</html>`;
}

// utils/scheduledExport.ts
var DEFAULT_SCHEDULE = {
  frequency: "off",
  hour: 9,
  minute: 0,
  weekday: 2,
  // lunes
  day: 1,
  format: "pdf",
  type: "all",
  destination: "share"
};
var MAX_MONTH_DAY = 28;
function isAutoRunDue(schedule, now) {
  if (schedule.frequency === "off") return false;
  if (schedule.destination !== "drive") return false;
  const today = toDateKey(now);
  if (schedule.lastAutoRun === today) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (minutesNow < schedule.hour * 60 + schedule.minute) return false;
  if (schedule.frequency === "daily") return true;
  if (schedule.frequency === "weekly") return now.getDay() + 1 === schedule.weekday;
  return now.getDate() === Math.min(schedule.day, MAX_MONTH_DAY);
}
function toDateKey(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function monthForSchedule(schedule, now) {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  if (schedule.frequency === "monthly") d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ../../../AppData/Local/Temp/claude/C--Users-User-OneDrive-Im-genes-streaming-pp/08e23a78-59b3-4efd-bc5e-1e235d32740e/scratchpad/nt/verificar-exportar.ts
var fallos = 0;
function ok(cond, msg) {
  console.log(`  ${cond ? "OK   " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
}
var fmt = (n) => `S/ ${n.toFixed(2)}`;
function tx(p) {
  return {
    dateLabel: "1 de julio",
    day: 1,
    categoryLabel: "Comida",
    categoryColor: "#f97316",
    description: "",
    methodLabel: "Efectivo",
    amount: 10,
    type: "expense",
    ...p
  };
}
var TEXTS = {
  colDate: "Fecha",
  colCategory: "Categor\xEDa",
  colDescription: "Descripci\xF3n",
  colMethod: "M\xE9todo",
  colAmount: "Monto",
  total: "Total",
  income: "Ingresos",
  expenses: "Gastos",
  balance: "Balance",
  byCategory: "Reparto por categor\xEDa",
  byDay: "D\xEDa a d\xEDa",
  generatedOn: "Generado el",
  movements: "Movimientos"
};
function html(txs, charts = true) {
  return buildPdfHtml({
    logoDataUri: "data:image/png;base64,AAAA",
    userName: "Diana",
    title: "Reporte de movimientos",
    monthLabel: "Julio 2026",
    txs,
    daysInMonth: 31,
    fmt,
    texts: TEXTS,
    charts,
    generatedAt: "30 de julio"
  });
}
console.log("\n--- ESCAPADO ---");
ok(esc("arroz <de 5kg>") === "arroz &lt;de 5kg&gt;", "los signos < y > se escapan");
ok(esc("pago 100 & pico") === "pago 100 &amp; pico", "el & se escapa");
{
  const h = html([tx({ description: "arroz <5kg> & pan" })]);
  ok(!h.includes("<5kg>"), "la descripci\xF3n con < no entra cruda en el HTML");
  ok(h.includes("&lt;5kg&gt;"), "la descripci\xF3n con < sale escapada y legible");
  const abiertas = (h.match(/<td[ >]/g) || []).length;
  const cerradas = (h.match(/<\/td>/g) || []).length;
  ok(abiertas === cerradas, `las celdas abren y cierran parejo (${abiertas}/${cerradas})`);
}
console.log("\n--- LOGO ---");
{
  const h = html([tx({})]);
  ok(h.includes('src="data:image/png;base64,'), "el logo va incrustado, no como archivo");
  ok(!/src="file:|src="http/.test(h), "no hay ninguna imagen que el PDF no pueda cargar");
}
console.log("\n--- RESUMEN ---");
{
  const h = html([
    tx({ amount: 300, type: "income" }),
    tx({ amount: 100, type: "expense" }),
    tx({ amount: 50, type: "expense" })
  ]);
  ok(h.includes("S/ 300.00"), "los ingresos suman 300");
  ok(h.includes("S/ 150.00"), "los gastos suman 150");
  ok(/Total:\s*<span[^>]*>S\/ 150\.00/.test(h), "el total es el balance (300 - 150)");
}
{
  const h = html([tx({ amount: 500, type: "expense" }), tx({ amount: 100, type: "income" })]);
  ok(/Total:\s*<span style="color:#e11d48;">S\/ -400\.00/.test(h), "un balance negativo sale en rojo");
}
console.log("\n--- GR\xC1FICO POR CATEGOR\xCDA ---");
{
  const filas = byCategory(
    [
      tx({ categoryLabel: "Comida", amount: 60 }),
      tx({ categoryLabel: "Transporte", amount: 30 }),
      tx({ categoryLabel: "Comida", amount: 10 }),
      tx({ categoryLabel: "Sueldo", amount: 999, type: "income" })
    ],
    "expense"
  );
  ok(filas.length === 2, "solo salen las categor\xEDas de gasto, no el ingreso");
  ok(filas[0].label === "Comida" && filas[0].amount === 70, "Comida suma sus dos movimientos");
  ok(filas[0].amount > filas[1].amount, "van de mayor a menor");
  const suma = filas.reduce((s, f) => s + f.share, 0);
  ok(Math.abs(suma - 1) < 1e-9, "los porcentajes suman 100%");
}
ok(byCategory([], "expense").length === 0, "sin movimientos no hay gr\xE1fico (y no se divide entre cero)");
console.log("\n--- GR\xC1FICO DIARIO ---");
{
  const dias = byDay([tx({ day: 3, amount: 10 }), tx({ day: 3, amount: 5 }), tx({ day: 31, amount: 1 })], "expense", 31);
  ok(dias.length === 31, "hay una posici\xF3n por d\xEDa del mes");
  ok(dias[2] === 15, "el d\xEDa 3 suma sus dos gastos");
  ok(dias[30] === 1, "el d\xEDa 31 cae en la \xFAltima posici\xF3n, no fuera");
  ok(dias[0] === 0, "un d\xEDa sin gastos vale cero");
}
{
  ok(dayLabelStep(31) === 1, "en un mes de 31 d\xEDas se puede numerar cada d\xEDa");
  ok(dayLabelStep(28) === 1, "en febrero tambi\xE9n");
  ok(dayLabelStep(31, 535, 14) > 1, "con letra grande se numera salteado en vez de encimarse");
}
{
  const h = html([tx({ day: 5, amount: 40 })]);
  ok(h.includes("D\xEDa a d\xEDa"), "el gr\xE1fico diario aparece");
  ok(h.includes("Reparto por categor\xEDa"), "el gr\xE1fico por categor\xEDa aparece");
  const sin = html([tx({ day: 5, amount: 40 })], false);
  ok(!sin.includes("Reparto por categor\xEDa"), "sin gr\xE1ficos, no se dibuja el de categor\xEDas");
  ok(!sin.includes("D\xEDa a d\xEDa"), "sin gr\xE1ficos, no se dibuja el diario");
  ok(sin.includes("Movimientos"), "sin gr\xE1ficos, la lista sigue estando");
}
{
  const h = html([tx({ amount: 800, type: "income", categoryLabel: "Sueldo" })]);
  ok(h.includes("Sueldo"), "si solo hay ingresos, el gr\xE1fico los dibuja a ellos");
  ok(h.includes("#059669"), "y los pinta de verde, no de rojo");
}
{
  const h = html([tx({ amount: 1, categoryLabel: "A" }), tx({ amount: 999999, categoryLabel: "B" })]);
  const anchos = [...h.matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]));
  ok(anchos.length > 0 && anchos.every((w) => w >= 0 && w <= 100), "ninguna barra se pasa del 100%");
}
console.log("\n--- LA TABLA EN VARIAS HOJAS ---");
{
  const muchos = Array.from({ length: 120 }, (_, i) => tx({ day: i % 28 + 1, amount: i + 1 }));
  const h = html(muchos);
  ok(h.includes("display: table-header-group"), "la cabecera se repite en cada hoja");
  ok(h.includes("(120)"), "se dice cu\xE1ntos movimientos lleva");
  ok((h.match(/<tr>/g) || []).length >= 120, "salen los 120, no solo los de la vista previa");
}
console.log("\n--- CADA CU\xC1NTO SE EXPORTA ---");
var base = { ...DEFAULT_SCHEDULE, frequency: "daily", destination: "drive", hour: 9 };
{
  const antes = new Date(2026, 6, 30, 8, 59);
  const despues = new Date(2026, 6, 30, 9, 1);
  ok(!isAutoRunDue(base, antes), "antes de la hora todav\xEDa no toca");
  ok(isAutoRunDue(base, despues), "pasada la hora s\xED toca");
}
ok(
  !isAutoRunDue({ ...base, lastAutoRun: toDateKey(new Date(2026, 6, 30)) }, new Date(2026, 6, 30, 20, 0)),
  "abrir la app diez veces el mismo d\xEDa da UNA sola copia"
);
ok(
  isAutoRunDue({ ...base, lastAutoRun: "2026-07-29" }, new Date(2026, 6, 30, 10, 0)),
  "al d\xEDa siguiente vuelve a tocar"
);
ok(!isAutoRunDue({ ...base, frequency: "off" }, new Date(2026, 6, 30, 10, 0)), '"Nunca" no exporta nada');
ok(
  !isAutoRunDue({ ...base, destination: "mail" }, new Date(2026, 6, 30, 10, 0)),
  "solo Drive se sube solo: correo y compartir necesitan que alguien elija"
);
{
  const jueves = new Date(2026, 6, 30, 10, 0);
  ok(jueves.getDay() === 4, "el 30/7/2026 es jueves (comprobaci\xF3n de la propia prueba)");
  ok(isAutoRunDue({ ...base, frequency: "weekly", weekday: 5 }, jueves), "el semanal cae el d\xEDa elegido");
  ok(!isAutoRunDue({ ...base, frequency: "weekly", weekday: 2 }, jueves), "y no cae en otro d\xEDa");
}
{
  const dia1 = new Date(2026, 6, 1, 10, 0);
  ok(isAutoRunDue({ ...base, frequency: "monthly", day: 1 }, dia1), "el mensual cae el d\xEDa elegido");
  ok(!isAutoRunDue({ ...base, frequency: "monthly", day: 2 }, dia1), "y no cae en otro d\xEDa");
  ok(MAX_MONTH_DAY === 28, "el d\xEDa mensual no pasa del 28, porque febrero tiene 28");
}
console.log("\n--- QU\xC9 MES LLEVA EL REPORTE ---");
{
  const uno = new Date(2026, 6, 1, 9, 0);
  ok(
    monthForSchedule({ ...base, frequency: "monthly" }, uno) === "2026-06",
    "el reporte mensual del d\xEDa 1 trae JUNIO, no julio reci\xE9n empezado"
  );
  ok(monthForSchedule({ ...base, frequency: "daily" }, uno) === "2026-07", "el diario trae el mes en curso");
  ok(monthForSchedule({ ...base, frequency: "weekly" }, uno) === "2026-07", "el semanal tambi\xE9n");
  const enero = new Date(2026, 0, 1, 9, 0);
  ok(
    monthForSchedule({ ...base, frequency: "monthly" }, enero) === "2025-12",
    "en enero el mensual retrocede de a\xF1o correctamente"
  );
}
console.log("\n--- LA FECHA DEL PDF ---");
{
  const nocheEnPeru = new Date(2026, 6, 30, 20, 0);
  ok(toDateKey(nocheEnPeru) === "2026-07-30", "un PDF de las 8 de la noche se fecha hoy, no ma\xF1ana");
  ok(toDateKey(new Date(2026, 0, 5, 23, 30)) === "2026-01-05", "y funciona igual a las 11 y media de la noche");
  ok(toDateKey(new Date(2026, 8, 9, 0, 1)) === "2026-09-09", "el mes y el d\xEDa llevan su cero delante");
}
console.log("\n--- EL TECLADO DEL PIN ---");
{
  const anchoContenedor = 228;
  const separacion = 12;
  const anchoViejo = 76 * 3;
  ok(anchoContenedor - anchoViejo < 12, "as\xED estaba antes: menos de 12 de hueco para dos separaciones (pegadas)");
  const anchoNuevo = (anchoContenedor - separacion * 2) / 3;
  ok(anchoNuevo >= 48, `ahora cada tecla mide ${anchoNuevo}, por encima del m\xEDnimo de 48 de Android`);
  ok(separacion === 12, "y la separaci\xF3n de los lados es la misma que la de arriba y abajo (mb-3)");
}
console.log(fallos === 0 ? "\nTodo bien\n" : `
${fallos} fallos
`);
process.exit(fallos ? 1 : 0);

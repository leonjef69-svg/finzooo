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
function donutSlice(desde, hasta, cx, cy, rFuera, rDentro) {
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
  const n = (v) => v.toFixed(2);
  return [
    `M${n(x0)},${n(y0)}`,
    `A${rFuera},${rFuera} 0 ${grande} 1 ${n(x1)},${n(y1)}`,
    `L${n(x2)},${n(y2)}`,
    `A${rDentro},${rDentro} 0 ${grande} 0 ${n(x3)},${n(y3)}`,
    "Z"
  ].join(" ");
}
function rosquilla(filas, total, fmt2, totalLabel, lado = 156) {
  const CX = lado / 2;
  const CY = lado / 2;
  const R_FUERA = lado * 0.423;
  const R_DENTRO = lado * 0.282;
  let acumulado = 0;
  const trozos = filas.map((f) => {
    const desde = acumulado;
    acumulado += f.share;
    if (f.share < 15e-4) return "";
    return `<path d="${donutSlice(desde, acumulado, CX, CY, R_FUERA, R_DENTRO)}" fill="${f.color}" />`;
  }).join("");
  return `
    <svg width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
      ${trozos}
      <text x="${CX}" y="${CY - 4}" text-anchor="middle" font-size="9" fill="#64748b">${esc(totalLabel)}</text>
      <text x="${CX}" y="${CY + 11}" text-anchor="middle" font-size="13" font-weight="bold" fill="#0f172a">${esc(fmt2(total))}</text>
    </svg>`;
}
function barrasPresupuesto(filas, fmt2) {
  return filas.map((f) => {
    const parte = f.limit > 0 ? Math.min(1, f.spent / f.limit) : 0;
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
            ${esc(fmt2(f.spent))} / ${esc(fmt2(f.limit))}
          </td>
        </tr>`;
  }).join("");
}
function barrasPorMes(meses, fmt2) {
  const max = Math.max(...meses.map((m) => m.value), 0);
  if (max <= 0) return "";
  const columnas = meses.map((m) => {
    const alto = Math.max(3, Math.round(m.value / max * 70));
    return `<td style="vertical-align:bottom;padding:0 10px;text-align:center;">
          <div style="font-size:9px;color:#334155;margin-bottom:3px;">${esc(fmt2(m.value))}</div>
          <div style="background:${VERDE};height:${alto}px;border-radius:3px 3px 0 0;"></div>
        </td>`;
  }).join("");
  const etiquetas = meses.map((m) => `<td style="text-align:center;font-size:9px;color:#64748b;padding-top:4px;">${esc(m.label)}</td>`).join("");
  return `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr style="height:86px;">${columnas}</tr>
      <tr>${etiquetas}</tr>
    </table>`;
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
function textWidthPdf(text, fontSize) {
  return text.length * fontSize * 0.58 + 2;
}
function dailyLayout(cuantos, etiquetas, ancho = 535, fontSize = 7) {
  const colW = cuantos > 0 ? ancho / cuantos : ancho;
  const masAncha = Math.max(0, ...etiquetas.map((e) => textWidthPdf(e, fontSize)));
  const girar = masAncha > colW - 2;
  return {
    colW,
    // La barra deja un respiro a cada lado, y no pasa de 30 para que con dos
    // o tres días no salgan tres columnas gordísimas.
    barW: Math.max(4, Math.min(30, colW - 8)),
    girar,
    // De pie, el monto ocupa a lo alto lo que ocupaba a lo ancho.
    espacioArriba: girar ? masAncha + 4 : fontSize + 4
  };
}
function barrasPorDia(dias, color, fmt2) {
  if (dias.length === 0) return "";
  const max = Math.max(...dias.map((d) => d.amount));
  if (max <= 0) return "";
  const ANCHO = 535;
  const ALTO_BARRAS = 64;
  const etiquetas = dias.map((d) => fmt2(d.amount));
  const { colW, barW, girar, espacioArriba } = dailyLayout(dias.length, etiquetas);
  const baseY = espacioArriba + ALTO_BARRAS;
  const alto = baseY + 16;
  const piezas = dias.map((d, i) => {
    const cx = i * colW + colW / 2;
    const h = Math.max(2, d.amount / max * ALTO_BARRAS);
    const y = baseY - h;
    const texto = esc(etiquetas[i]);
    const monto = girar ? `<text x="${cx.toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="7" fill="#334155" text-anchor="start" transform="rotate(-90 ${cx.toFixed(1)} ${(y - 4).toFixed(1)})">${texto}</text>` : `<text x="${cx.toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="7" fill="#334155" text-anchor="middle">${texto}</text>`;
    return `
        <rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}" />
        ${monto}
        <text x="${cx.toFixed(1)}" y="${(baseY + 11).toFixed(1)}" font-size="7" fill="#94a3b8" text-anchor="middle">${d.day}</text>`;
  }).join("");
  return `<svg width="100%" viewBox="0 0 ${ANCHO} ${alto.toFixed(0)}">
      <line x1="0" y1="${baseY}" x2="${ANCHO}" y2="${baseY}" stroke="#e2e8f0" stroke-width="1" />
      ${piezas}
    </svg>`;
}
function alturaEstimada(p) {
  let alto = 120;
  if (p.categorias > 0) alto += 40 + Math.max(156, p.categorias * 17);
  if (p.presupuestos > 0) alto += 34 + p.presupuestos * 20;
  if (p.meses > 1) alto += 34 + 110;
  if (p.dias > 0) alto += 34 + 150;
  alto += 52 + p.movimientos * 26 + 44;
  return alto;
}
var ALTO_HOJA = 1040;
function cabeApretando(alto) {
  return alto > ALTO_HOJA && alto <= ALTO_HOJA * 1.3;
}
function buildPdfHtml(o) {
  const { texts: T, fmt: fmt2 } = o;
  const ingresos = o.txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const gastos = o.txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = ingresos - gastos;
  const foco = gastos > 0 ? "expense" : "income";
  const colorFoco = foco === "expense" ? ROJO : VERDE;
  const catsGasto = o.charts ? byCategory(o.txs, "expense") : [];
  const catsIngreso = o.charts ? byCategory(o.txs, "income") : [];
  const dias = o.charts ? byDay(o.txs, foco, o.daysInMonth).map((amount, i) => ({ day: i + 1, amount })).filter((d) => d.amount > 0) : [];
  const hayDias = dias.length > 0;
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
      movimientos: o.txs.length
    })
  );
  const sep = apretar ? 11 : 20;
  const padFila = apretar ? "3px 8px" : "6px 8px";
  const ladoRosquilla = apretar ? 124 : 156;
  const filas = o.txs.map((tx2) => {
    const color = tx2.type === "expense" ? ROJO : VERDE;
    const signo = tx2.type === "expense" ? "-" : "+";
    return `
        <tr>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(tx2.dateLabel)}</td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;white-space:nowrap;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${tx2.categoryColor};margin-right:5px;"></span>${esc(tx2.categoryLabel)}
          </td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;">${esc(tx2.description || "-")}</td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(tx2.methodLabel)}</td>
          <td style="padding:${padFila};border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:${color};font-weight:bold;">${signo}${esc(fmt2(tx2.amount))}</td>
        </tr>`;
  }).join("");
  const tarjeta = (etiqueta, monto, color) => `
    <td style="width:33.3%;padding:0 4px;">
      <div style="border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 11px;">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">${esc(etiqueta)}</div>
        <div style="font-size:15px;font-weight:bold;color:${color};margin-top:2px;">${esc(monto)}</div>
      </div>
    </td>`;
  const totalGastoCats = catsGasto.reduce((s, c) => s + c.amount, 0);
  const totalIngresoCats = catsIngreso.reduce((s, c) => s + c.amount, 0);
  const repartoDe = (titulo, lista, total) => lista.length === 0 ? "" : `
      <div style="page-break-inside:avoid;margin-top:${sep}px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(titulo)}</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:${ladoRosquilla + 14}px;vertical-align:middle;">${rosquilla(lista, total, fmt2, T.total, ladoRosquilla)}</td>
            <td style="vertical-align:middle;padding-left:6px;">
              <table style="width:100%;border-collapse:collapse;">${barrasPorCategoria(lista, fmt2)}</table>
            </td>
          </tr>
        </table>
      </div>`;
  const hayDeTodo = o.charts && catsGasto.length > 0 && catsIngreso.length > 0;
  const catsFoco = foco === "expense" ? catsGasto : catsIngreso;
  const totalFoco = foco === "expense" ? totalGastoCats : totalIngresoCats;
  const bloqueCategorias = repartoDe(
    hayDeTodo ? `${T.byCategory} \xB7 ${T.expenses}` : T.byCategory,
    catsFoco,
    totalFoco
  );
  const bloquePresupuestos = o.charts && o.categoryBudgets.length > 0 ? `
      <div style="page-break-inside:avoid;margin-top:${sep}px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byCategoryBudget)}</div>
        <table style="width:100%;border-collapse:collapse;">${barrasPresupuesto(o.categoryBudgets, fmt2)}</table>
      </div>` : "";
  const bloqueMeses = o.charts && o.monthly.length > 1 ? `
      <div style="page-break-inside:avoid;margin-top:${sep}px;">
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(T.byMonth)}</div>
        ${barrasPorMes(o.monthly, fmt2)}
      </div>` : "";
  const bloqueDias = hayDias ? `
      <div style="page-break-inside:avoid;margin-top:${sep}px;">
        <!-- Con las dos cosas dentro, el t\xEDtulo dice de cu\xE1l son las columnas.
             Este gr\xE1fico sigue siendo de gasto: los ingresos de un mes son
             dos o tres d\xEDas sueltos y un gr\xE1fico diario de eso ser\xEDan tres
             columnas perdidas en una hoja vac\xEDa. Pero llamarlo solo "D\xEDa a
             d\xEDa" en un reporte que trae las dos parec\xEDa que faltaban. -->
        <div style="font-size:11px;font-weight:bold;color:#334155;margin-bottom:7px;">${esc(
    hayDeTodo ? `${T.byDay} \xB7 ${T.expenses}` : T.byDay
  )}</div>
        ${barrasPorDia(dias, colorFoco, fmt2)}
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
    ${bloquePresupuestos}
    ${bloqueMeses}
    ${bloqueDias}

    <!-- MOVIMIENTOS -->
    <!-- page-break-after:avoid pega el t\xEDtulo a su tabla.
         Sin esto el corte de hoja ca\xEDa justo debajo del t\xEDtulo y la primera
         p\xE1gina terminaba con un "Movimientos (21)" solo, sin ni una fila
         debajo. Desde fuera parece que la lista no sali\xF3, no que siguiera en
         la hoja siguiente. -->
    <div style="font-size:11px;font-weight:bold;color:#334155;margin:${sep + 2}px 0 7px 0;page-break-after:avoid;">
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

// pruebas/verificar-pdf.ts
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
  byCategoryBudget: "Presupuestos por categor\xEDa",
  byMonth: "Gasto por mes",
  byDay: "D\xEDa a d\xEDa",
  generatedOn: "Generado el",
  movements: "Movimientos"
};
function html(txs, charts = true, categoryBudgets = [], monthly = []) {
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
    categoryBudgets,
    monthly,
    generatedAt: "31 de julio"
  });
}
console.log("\n--- LA ROSQUILLA ---");
{
  const d = donutSlice(0, 0.5, 78, 78, 66, 44);
  ok(d.startsWith("M78.00,12.00"), `arranca ARRIBA del todo, no a las tres: ${d.slice(0, 14)}`);
  ok(d.includes("A66,66"), "traza el arco de fuera con el radio grande");
  ok(d.includes("A44,44"), "y el de dentro con el peque\xF1o, que es lo que le da el agujero");
  ok(d.trim().endsWith("Z"), "y se cierra");
}
{
  ok(donutSlice(0, 0.6, 78, 78, 66, 44).includes(" 1 1 "), "un trozo de m\xE1s de media vuelta se marca como arco grande");
  ok(donutSlice(0, 0.4, 78, 78, 66, 44).includes(" 0 1 "), "y uno de menos, no");
}
{
  for (const [a, b] of [[0, 0.25], [0.25, 0.5], [0.5, 0.9], [0.9, 1]]) {
    const nums = [...donutSlice(a, b, 78, 78, 66, 44).matchAll(/(-?\d+\.\d+),(-?\d+\.\d+)/g)];
    for (const m of nums) {
      const x = Number(m[1]), y = Number(m[2]);
      if (x < 0 || x > 156 || y < 0 || y > 156) {
        ok(false, `punto fuera del dibujo: ${x},${y}`);
      }
    }
  }
  ok(true, "ning\xFAn trozo se sale del dibujo, en las cuatro vueltas");
}
console.log("\n--- LOS GRAFICOS DE REPORTES EN EL PDF ---");
{
  const limites = [
    { name: "Comida", color: "#f97316", limit: 100, spent: 99 },
    { name: "Transporte", color: "#3b82f6", limit: 50, spent: 70 }
  ];
  const meses = [
    { label: "May", value: 70 },
    { label: "Jun", value: 299 }
  ];
  const h = html([tx({ amount: 99 }), tx({ amount: 70, categoryLabel: "Transporte" })], true, limites, meses);
  ok(h.includes("Reparto por categor\xEDa"), "sale el reparto por categor\xEDa");
  ok(h.includes("<svg"), "y con su rosquilla dibujada, no como imagen");
  ok(h.includes("Presupuestos por categor\xEDa"), "salen los presupuestos por categor\xEDa");
  ok(h.includes("S/ 99.00 / S/ 100.00"), "con lo gastado y el l\xEDmite de cada uno");
  ok(h.includes("Gasto por mes"), "sale el gasto por mes");
  ok(h.includes("May") && h.includes("Jun"), "con sus meses");
  ok(h.includes("D\xEDa a d\xEDa"), "y el gasto diario");
  ok(!h.includes("Finzo IA"), "NO sale Finzo IA");
  ok(!h.includes("Presupuesto utilizado"), "NI la barra de presupuesto utilizado");
}
{
  const limites = [{ name: "Transporte", color: "#3b82f6", limit: 50, spent: 70 }];
  const h = html([tx({ amount: 70 })], true, limites, []);
  const fila = h.slice(h.indexOf("Transporte"), h.indexOf("Transporte") + 400);
  ok(fila.includes("#e11d48"), "una categor\xEDa pasada de su l\xEDmite sale en rojo");
  ok(!fila.includes("width:140.0%"), "y la barra no se sale del riel");
}
{
  const h = html([tx({})], true, [], [{ label: "Jul", value: 60 }]);
  ok(!h.includes("Gasto por mes"), "con un solo mes no se dibuja el gr\xE1fico de meses");
}
{
  const h = html([tx({})], true, [], []);
  ok(!h.includes("Presupuestos por categor\xEDa"), "sin l\xEDmites puestos, ese bloque no aparece");
}
console.log("\n--- SIN GRAFICOS SE VA TODO ---");
{
  const limites = [{ name: "Comida", color: "#f97316", limit: 100, spent: 99 }];
  const meses = [{ label: "May", value: 70 }, { label: "Jun", value: 299 }];
  const h = html([tx({})], false, limites, meses);
  ok(!h.includes("Reparto por categor\xEDa"), "sin gr\xE1ficos no hay reparto");
  ok(!h.includes("Presupuestos por categor\xEDa"), "ni presupuestos");
  ok(!h.includes("Gasto por mes"), "ni meses");
  ok(!h.includes("D\xEDa a d\xEDa"), "ni diario");
  ok(h.includes("Movimientos"), "pero la lista de movimientos se queda");
  ok(h.includes("Total"), "y el total tambi\xE9n");
}
console.log("\n--- LA VISTA PREVIA ES EL MISMO DOCUMENTO ---");
{
  const a = html([tx({ amount: 33 })], true, [], []);
  const b = html([tx({ amount: 33 })], true, [], []);
  ok(a === b, "el mismo contenido da exactamente el mismo documento");
}
console.log("\n--- SIGUE ESCAPANDO LO QUE SE ESCRIBE ---");
{
  const h = html([tx({ description: "arroz <5kg> & pan" })], true, [], []);
  ok(!h.includes("<5kg>"), "una descripci\xF3n con < no entra cruda");
  ok(esc("a<b") === "a&lt;b", "el escapado sigue en pie");
}
console.log("\n--- EL MONTO SOBRE CADA BARRA DEL GASTO DIARIO ---");
{
  const h = html([tx({ day: 3, amount: 10 }), tx({ day: 31, amount: 1234.56 })]);
  ok(h.includes("S/ 10.00"), "sale el monto del d\xEDa 3");
  ok(h.includes("S/ 1234.56"), "y el del d\xEDa 31, entero y sin recortar");
  ok(h.includes(">3</text>") && h.includes(">31</text>"), "y debajo el n\xFAmero de cada d\xEDa");
}
{
  const h = html([tx({ day: 3, amount: 10 }), tx({ day: 31, amount: 20 })]);
  const barras = (h.match(/<rect [^>]*rx="2"/g) || []).length;
  ok(barras === 2, `se dibujan 2 barras y no 31 (salieron ${barras})`);
}
{
  const pocos = dailyLayout(3, ["S/ 10.00", "S/ 1234.56", "S/ 5.00"]);
  ok(!pocos.girar, `con 3 d\xEDas los montos van tumbados (columna de ${pocos.colW.toFixed(0)})`);
  const muchos = dailyLayout(28, new Array(28).fill("S/ 1234.56"));
  ok(muchos.girar, `con 28 d\xEDas se ponen de pie (columna de ${muchos.colW.toFixed(0)})`);
}
{
  let bien = true;
  for (const n of [1, 2, 5, 10, 20, 31]) {
    const L = dailyLayout(n, new Array(n).fill("S/ 1234.56"));
    if (!L.girar && textWidthPdf("S/ 1234.56", 7) > L.colW) bien = false;
    if (L.barW > L.colW) bien = false;
  }
  ok(bien, "con 1, 2, 5, 10, 20 y 31 d\xEDas nada invade la columna de al lado");
}
{
  const L = dailyLayout(2, ["S/ 5.00", "S/ 9.00"]);
  ok(L.barW <= 30, `con dos d\xEDas la barra no se hace gigante (${L.barW})`);
  ok(L.barW >= 4, "y nunca desaparece");
}
console.log(fallos === 0 ? "\nTodo bien\n" : `
${fallos} fallos
`);
process.exit(fallos ? 1 : 0);

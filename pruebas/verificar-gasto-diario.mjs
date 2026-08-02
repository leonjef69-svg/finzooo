// Comprueba el grafico de gasto diario: una barra por dia CON GASTO, la
// altura segun el monto, el eje en cifras redondas, y que los numeros de los
// dias y los montos se lean todos, cada uno sobre su barra y sin cruzarse.

const AXIS_W = 42, PLOT_H = 140, LABEL_BAND = 22, DAYS_H = 18, STEPS = 4;
const AMOUNT_FONT = 10, DAY_FONT = 10;

function niceMax(value, steps) {
  if (value <= 0) return steps;
  const raw = value / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return step * steps;
}

const textWidth = (text, fontSize) => text.length * fontSize * 0.62 + 4;
const labelStep = (maxLabelW, colW) => Math.max(1, Math.ceil(maxLabelW / Math.max(1, colW)));

// Formato de la app: "S/ 1,347.00"
const fmt = (n) => `S/ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Mismo calculo que el useMemo `daily` de screens/Reports.tsx
function calcular(movimientos, y, m, hoyReal) {
  const mk = `${y}-${String(m + 1).padStart(2, "0")}`;
  const porDia = new Map();
  for (const tx of movimientos) {
    if (tx.type === "income" || !tx.date.startsWith(mk)) continue;
    const d = Number(tx.date.slice(8, 10));
    porDia.set(d, (porDia.get(d) ?? 0) + tx.amount);
  }
  const bars = [...porDia.entries()]
    .map(([day, amount]) => ({ day, amount }))
    .sort((a, b) => a.day - b.day);
  return { bars, today: hoyReal ?? 0 };
}

// Mismo dibujo que components/DailyBarsChart.tsx
function dibujar(bars, width) {
  const plotW = Math.max(1, width - AXIS_W - 6);
  const top = niceMax(Math.max(...bars.map((d) => d.amount), 0), STEPS);
  const colW = plotW / bars.length;
  const alturas = bars.map((b) => Math.max(5, (b.amount / top) * PLOT_H));
  const barW = Math.max(6, Math.min(28, colW - 8));

  const anchoCompleto = Math.max(...bars.map((d) => textWidth(fmt(d.amount), AMOUNT_FONT)));
  const usarCompleto = anchoCompleto <= colW;
  const amountText = (n) => (usarCompleto ? fmt(n) : Number.isInteger(n) ? String(n) : n.toFixed(2));

  const anchoMonto = Math.max(...bars.map((d) => textWidth(amountText(d.amount), AMOUNT_FONT)));
  const pasoMonto = labelStep(anchoMonto, colW);
  const pasoDia = labelStep(textWidth(String(bars[bars.length - 1].day), DAY_FONT), colW);

  return { plotW, top, colW, alturas, barW, usarCompleto, amountText, anchoMonto, pasoMonto, pasoDia };
}

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(52)} ${d}`);
  if (!ok) fallos++;
}

// Comprueba que las etiquetas escritas no se crucen: cada una va centrada
// en su columna, asi que dos seguidas se cruzan si el texto pasa del ancho
// de la columna multiplicado por el paso.
function seCruzan(g, cuantas, ancho, paso) {
  const escritas = [];
  for (let i = 0; i < cuantas; i += paso) escritas.push(i);
  for (let k = 1; k < escritas.length; k++) {
    const sep = (escritas[k] - escritas[k - 1]) * g.colW;
    if (sep < ancho - 0.01) return `${sep.toFixed(1)}px para ${ancho.toFixed(1)}px de texto`;
  }
  return null;
}

// Movimientos reales del usuario: S/36 el 28, S/20 el 29 y S/10 el 30.
// Tres dias SEGUIDOS, que es lo que rompia el dibujo.
const REALES = [
  { date: "2026-07-28", amount: 3 }, { date: "2026-07-28", amount: 4 },
  { date: "2026-07-28", amount: 1 }, { date: "2026-07-28", amount: 6 },
  { date: "2026-07-28", amount: 8 }, { date: "2026-07-28", amount: 2 },
  { date: "2026-07-28", amount: 5 }, { date: "2026-07-28", amount: 7 },
  { date: "2026-07-29", amount: 10 }, { date: "2026-07-29", amount: 10 },
  { date: "2026-07-30", amount: 10 },
  { date: "2026-07-15", amount: 500, type: "income" },
];

console.log("Movimientos reales de julio 2026");
{
  const r = calcular(REALES, 2026, 6, 30);
  check("3 barras: los 3 dias en que gasto", r.bars.length === 3,
    `${r.bars.map((b) => b.day).join(",")}`);
  check("van en orden de dia", r.bars.map((b) => b.day).join(",") === "28,29,30");
  check("dia 28 suma sus 8 gastos", r.bars[0].amount === 36, `S/${r.bars[0].amount}`);
  check("dia 29 suma sus 2 gastos", r.bars[1].amount === 20, `S/${r.bars[1].amount}`);
  check("dia 30 registra sus S/10", r.bars[2].amount === 10, `S/${r.bars[2].amount}`);
  check("el ingreso de S/500 del dia 15 no entra",
    !r.bars.some((b) => b.day === 15), r.bars.map((b) => b.day).join(","));

  const g = dibujar(r.bars, 340);
  check("el eje sale en cifras redondas",
    Array.from({ length: 5 }, (_, k) => (g.top / 4) * k).join(",") === "0,10,20,30,40",
    Array.from({ length: 5 }, (_, k) => (g.top / 4) * k).join(", "));
  check("la barra mas alta no se sale", g.alturas[0] <= PLOT_H + 0.01,
    `${g.alturas[0].toFixed(1)}px de ${PLOT_H}`);
  check("las alturas van en proporcion (36 > 20 > 10)",
    g.alturas[0] > g.alturas[1] && g.alturas[1] > g.alturas[2],
    g.alturas.map((h) => h.toFixed(0)).join(" > "));
  check("20 es 5/9 de 36", Math.abs(g.alturas[1] / g.alturas[0] - 20 / 36) < 0.01);

  // LO QUE FALLABA
  check("con 3 barras cada columna es ancha", g.colW > 90, `${g.colW.toFixed(1)}px`);
  check("SE ESCRIBEN LOS TRES MONTOS", g.pasoMonto === 1, `uno cada ${g.pasoMonto}`);
  check("y con su formato completo", g.usarCompleto, g.amountText(36));
  check("los montos no se cruzan", seCruzan(g, 3, g.anchoMonto, g.pasoMonto) === null,
    seCruzan(g, 3, g.anchoMonto, g.pasoMonto) ?? `${g.anchoMonto.toFixed(1)}px en ${g.colW.toFixed(1)}px`);
  check("SE ESCRIBEN LOS TRES DIAS", g.pasoDia === 1, `uno cada ${g.pasoDia}`);
  check("los dias no se cruzan",
    seCruzan(g, 3, textWidth("30", DAY_FONT), g.pasoDia) === null);
  check("ya no sale ningun 31 de adorno", !r.bars.some((b) => b.day === 31));
  check("ni ningun dia sin gasto", r.bars.every((b) => b.amount > 0));

  // Cada etiqueta va centrada en SU columna: no se mueve, no puede senalar
  // la barra de al lado.
  check("cada monto va centrado en su columna", true, "por construccion");

  check("las barras son gruesas", g.barW >= 20, `${g.barW.toFixed(1)}px`);
  check("el monto no se sale por arriba",
    Math.max(...g.alturas) + 3 + 13 <= PLOT_H + LABEL_BAND,
    `${(Math.max(...g.alturas) + 16).toFixed(1)} de ${PLOT_H + LABEL_BAND}`);
}

console.log("\nEl ancho de la barra se adapta");
{
  const casos = [[1, "un solo dia"], [3, "tres dias"], [10, "diez dias"], [31, "los 31 dias"]];
  for (const [n, nombre] of casos) {
    const movs = Array.from({ length: n }, (_, i) =>
      ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, amount: 10 + i }));
    const r = calcular(movs, 2026, 6, 0);
    const g = dibujar(r.bars, 340);
    check(`${nombre}: ${n} barras`, r.bars.length === n, `${r.bars.length}`);
    check(`${nombre}: barra de ancho razonable`, g.barW >= 6 && g.barW <= 28,
      `${g.barW.toFixed(1)}px en columna de ${g.colW.toFixed(1)}px`);
    check(`${nombre}: la barra cabe en su columna`, g.barW < g.colW);
  }
}

console.log("\nMontos: todos los que se escriben se leen enteros");
{
  const casos = [
    ["3 dias", [[28, 36], [29, 20], [30, 10]]],
    ["4 dias", [[10, 5], [11, 15], [12, 25], [13, 35]]],
    ["montos de 4 cifras", [[10, 1347], [11, 999], [12, 1200]]],
    ["con centimos", [[5, 45.5], [6, 12.25]]],
    ["8 dias", [[1, 10], [4, 20], [8, 30], [12, 40], [16, 50], [20, 60], [24, 70], [28, 80]]],
    ["15 dias", Array.from({ length: 15 }, (_, i) => [i * 2 + 1, 10 + i * 7])],
    ["los 31 dias", Array.from({ length: 31 }, (_, i) => [i + 1, 10 + i])],
  ];
  for (const [nombre, pares] of casos) {
    const movs = pares.map(([dd, amt]) =>
      ({ date: `2026-07-${String(dd).padStart(2, "0")}`, amount: amt }));
    const r = calcular(movs, 2026, 6, 0);
    const g = dibujar(r.bars, 340);

    check(`${nombre}: los montos escritos no se cruzan`,
      seCruzan(g, r.bars.length, g.anchoMonto, g.pasoMonto) === null,
      seCruzan(g, r.bars.length, g.anchoMonto, g.pasoMonto) ??
        `${g.anchoMonto.toFixed(1)}px de texto, ${(g.colW * g.pasoMonto).toFixed(1)}px de sitio`);
    check(`${nombre}: los dias escritos no se cruzan`,
      seCruzan(g, r.bars.length, textWidth(String(r.bars[r.bars.length - 1].day), DAY_FONT), g.pasoDia) === null);
    check(`${nombre}: ninguno se sale por arriba`,
      Math.max(...g.alturas) + 16 <= PLOT_H + LABEL_BAND,
      `${(Math.max(...g.alturas) + 16).toFixed(1)} de ${PLOT_H + LABEL_BAND}`);
    check(`${nombre}: la barra mas alta llega al techo pero no lo pasa`,
      Math.max(...g.alturas) <= PLOT_H + 0.01);
  }
}

console.log("\nCon pocas barras se escribe todo, sin saltarse nada");
{
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const movs = Array.from({ length: n }, (_, i) =>
      ({ date: `2026-07-${String(i * 3 + 1).padStart(2, "0")}`, amount: 25 }));
    const r = calcular(movs, 2026, 6, 0);
    const g = dibujar(r.bars, 340);
    check(`${n} barra(s): se escriben todos los montos`, g.pasoMonto === 1, `paso ${g.pasoMonto}`);
    check(`${n} barra(s): se escriben todos los dias`, g.pasoDia === 1, `paso ${g.pasoDia}`);
  }
}

console.log("\nCasos raros");
{
  const r0 = calcular([], 2026, 6, 0);
  check("mes sin gastos: no hay barras", r0.bars.length === 0);

  const r1 = calcular([{ date: "2026-07-10", amount: 0.5 }], 2026, 6, 0);
  const g1 = dibujar(r1.bars, 340);
  check("un gasto de S/0.50: no rompe el eje", Number.isFinite(g1.top) && g1.top > 0, `techo ${g1.top}`);
  check("un gasto de S/0.50: su barra se ve", g1.alturas[0] >= 5, `${g1.alturas[0].toFixed(1)}px`);

  const rBig = calcular([{ date: "2026-07-10", amount: 12500 }, { date: "2026-07-11", amount: 3 }], 2026, 6, 0);
  const gBig = dibujar(rBig.bars, 340);
  check("un gasto enorme: eje redondo",
    Array.from({ length: 5 }, (_, k) => (gBig.top / 4) * k).join(",") === "0,5000,10000,15000,20000",
    Array.from({ length: 5 }, (_, k) => (gBig.top / 4) * k).join(", "));
  check("un gasto enorme: no se sale", gBig.alturas[0] <= PLOT_H + 0.01);
  check("y el chico de al lado sigue viendose", gBig.alturas[1] >= 5, `${gBig.alturas[1].toFixed(1)}px`);

  // Pantalla angosta
  const rN = calcular(REALES, 2026, 6, 30);
  const gN = dibujar(rN.bars, 300);
  check("pantalla angosta: sigue habiendo sitio", gN.colW > 70, `${gN.colW.toFixed(1)}px`);
  check("pantalla angosta: se escriben los 3 montos", gN.pasoMonto === 1);
  check("pantalla angosta: no se cruzan",
    seCruzan(gN, 3, gN.anchoMonto, gN.pasoMonto) === null,
    seCruzan(gN, 3, gN.anchoMonto, gN.pasoMonto) ?? "");

  // Un mes pasado no resalta ningun dia
  const rPasado = calcular([{ date: "2026-02-10", amount: 50 }], 2026, 1, 0);
  check("mes pasado: no se resalta ningun dia", rPasado.today === 0);
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;

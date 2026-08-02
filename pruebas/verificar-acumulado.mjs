// Comprueba el grafico de gasto acumulado: el acumulado por dia, el techo
// redondeado del eje, la estimacion, y que nada se salga del dibujo.

const AXIS_W = 42, PLOT_H = 150, PAD_TOP = 10, WIDTH = 280, STEPS = 4;

function niceMax(value, steps) {
  if (value <= 0) return steps;
  const raw = value / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return step * steps;
}

function calcular(gastos, y, m, hoy) {
  const mk = `${y}-${String(m + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const isCurrentMonth = hoy != null;
  const elapsed = isCurrentMonth ? Math.min(hoy, daysInMonth) : daysInMonth;

  const expenses = gastos.filter((g) => g.date.startsWith(mk));
  const porDia = new Map();
  for (const t of expenses) {
    const d = Number(t.date.slice(8, 10));
    porDia.set(d, (porDia.get(d) ?? 0) + t.amount);
  }
  const bars = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, amount: porDia.get(i + 1) ?? 0 }));

  let corriendo = 0;
  const acumulado = bars.map((b) => {
    corriendo += b.amount;
    return { day: b.day, total: b.day <= elapsed ? corriendo : null };
  });

  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const media = elapsed > 0 ? total / elapsed : 0;
  const proyeccion = isCurrentMonth && elapsed < daysInMonth
    ? bars.map((b) => (b.day >= elapsed ? total + media * (b.day - elapsed) : null))
    : null;

  return { acumulado, proyeccion, total, media, daysInMonth, elapsed };
}

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(48)} ${d}`);
  if (!ok) fallos++;
}

const REALES = [
  { date: "2026-07-28", amount: 3 }, { date: "2026-07-28", amount: 4 },
  { date: "2026-07-28", amount: 1 }, { date: "2026-07-28", amount: 6 },
  { date: "2026-07-28", amount: 8 }, { date: "2026-07-28", amount: 2 },
  { date: "2026-07-28", amount: 5 }, { date: "2026-07-28", amount: 7 },
  { date: "2026-07-29", amount: 10 }, { date: "2026-07-29", amount: 10 },
];

// ---- Movimientos reales del usuario ----
{
  const r = calcular(REALES, 2026, 6, 29);
  check("un punto por dia del mes", r.acumulado.length === 31);
  check("acumulado sube y nunca baja",
    r.acumulado.filter((a) => a.total != null).every((a, i, arr) => i === 0 || a.total >= arr[i - 1].total));
  check("dias 1..27 en cero", r.acumulado.slice(0, 27).every((a) => a.total === 0));
  check("acumulado al dia 28", r.acumulado[27].total === 36, `S/${r.acumulado[27].total}`);
  check("acumulado al dia 29 (hoy)", r.acumulado[28].total === 56, `S/${r.acumulado[28].total}`);
  check("no se dibuja despues de hoy",
    r.acumulado.slice(29).every((a) => a.total === null));
  check("la estimacion arranca en el total de hoy",
    Math.abs(r.proyeccion[28] - 56) < 0.001, `S/${r.proyeccion[28].toFixed(2)}`);
  check("la estimacion crece hacia fin de mes", r.proyeccion[30] > r.proyeccion[28],
    `S/${r.proyeccion[30].toFixed(2)}`);

  // Eje redondeado
  const maxV = Math.max(...r.acumulado.filter((a) => a.total != null).map((a) => a.total),
                        ...r.proyeccion.filter((v) => v != null));
  const top = niceMax(maxV, STEPS);
  const marcas = Array.from({ length: STEPS + 1 }, (_, k) => (top / STEPS) * k);
  check("el eje sale en cifras redondas", marcas.join(",") === "0,20,40,60,80", marcas.join(", "));
  check("el techo del eje supera el maximo real", top >= maxV, `techo ${top} vs max ${maxV.toFixed(2)}`);

  // Nada se sale del dibujo
  const yOf = (v) => PAD_TOP + PLOT_H * (1 - v / top);
  const ys = [...r.acumulado.filter((a) => a.total != null).map((a) => yOf(a.total)),
              ...r.proyeccion.filter((v) => v != null).map(yOf)];
  check("ningun punto se sale del alto",
    ys.every((y) => y >= PAD_TOP - 0.01 && y <= PAD_TOP + PLOT_H + 0.01),
    `y entre ${Math.min(...ys).toFixed(1)} y ${Math.max(...ys).toFixed(1)}`);

  const plotW = WIDTH - AXIS_W - 8;
  const xs = r.acumulado.map((_, i) => AXIS_W + i * (plotW / 30));
  check("ningun punto se sale del ancho",
    xs.every((x) => x >= AXIS_W - 0.01 && x <= AXIS_W + plotW + 0.01));
}

// ---- Ejes redondos con otros montos ----
{
  const casos = [[56, "0,20,40,60,80"], [1347, "0,500,1000,1500,2000"],
                 [299, "0,100,200,300,400"], [7, "0,2,4,6,8"], [0, "0,1,2,3,4"]];
  for (const [v, esperado] of casos) {
    const top = niceMax(v, STEPS);
    const marcas = Array.from({ length: STEPS + 1 }, (_, k) => (top / STEPS) * k).join(",");
    check(`eje para un maximo de ${v}`, marcas === esperado, marcas);
  }
}

// ---- Mes pasado: sin estimacion ----
{
  const r = calcular([{ date: "2026-02-10", amount: 50 }], 2026, 1, null);
  check("febrero: 28 puntos", r.acumulado.length === 28);
  check("mes pasado: sin estimacion", r.proyeccion === null);
  check("mes pasado: la linea llega al final", r.acumulado[27].total === 50);
}

// ---- Gasto repartido: sube escalonado ----
{
  const g = [3, 9, 14, 21, 27].map((d) => ({ date: `2026-07-${String(d).padStart(2, "0")}`, amount: 10 }));
  const r = calcular(g, 2026, 6, 29);
  const enDias = [3, 9, 14, 21, 27].map((d) => r.acumulado[d - 1].total);
  check("sube 10,20,30,40,50", enDias.join(",") === "10,20,30,40,50", enDias.join(","));
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;

// Reproduce el cálculo de "Gasto acumulado" tal como quedó en Reports.tsx,
// para comprobar los números y que nada se salga del dibujo.

function calcular({ y, m, hoy, presupuesto, gastos }) {
  const mk = `${y}-${String(m + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const isCurrentMonth = hoy != null;
  const today = isCurrentMonth ? Math.min(hoy, daysInMonth) : daysInMonth;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const spentUpTo = (day) => {
    const cutoff = `${mk}-${String(day).padStart(2, "0")}`;
    return gastos.filter((g) => g.date <= cutoff).reduce((s, g) => s + g.amount, 0);
  };

  const spentToday = spentUpTo(today);
  const dailyAvg = today > 0 ? spentToday / today : 0;
  const projected = dailyAvg * daysInMonth;

  return {
    daysInMonth, today, spentToday, dailyAvg, projected,
    labels: days.map((d) => (d === 1 || d % 5 === 0 || d === daysInMonth ? String(d) : "")),
    real: days.map((d) => (d <= today ? spentUpTo(d) : null)),
    budgetPace: presupuesto > 0 ? days.map((d) => (presupuesto / daysInMonth) * d) : null,
    projection: isCurrentMonth && today < daysInMonth
      ? days.map((d) => (d >= today ? spentToday + dailyAvg * (d - today) : null))
      : null,
  };
}

let fallos = 0;
function check(nombre, ok, detalle = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${nombre.padEnd(52)} ${detalle}`);
  if (!ok) fallos++;
}

// --- Caso del usuario: julio 2026, hoy 29, un gasto de S/20 el día 29 ---
{
  const r = calcular({
    y: 2026, m: 6, hoy: 29, presupuesto: 900,
    gastos: [{ date: "2026-07-29", amount: 20 }],
  });
  check("julio tiene 31 dias", r.daysInMonth === 31);
  check("hay un punto por dia", r.real.length === 31, `${r.real.length} puntos`);
  check("el gasto real se corta hoy", r.real[28] === 20 && r.real[29] === null,
    `dia29=${r.real[28]} dia30=${r.real[29]}`);
  check("dias 1..28 en cero", r.real.slice(0, 28).every((v) => v === 0));
  check("gastado hasta hoy", r.spentToday === 20, `S/${r.spentToday}`);
  check("promedio diario", Math.abs(r.dailyAvg - 20 / 29) < 0.001, `S/${r.dailyAvg.toFixed(2)}`);
  check("proyeccion fin de mes", Math.abs(r.projected - (20 / 29) * 31) < 0.01,
    `S/${r.projected.toFixed(2)}`);
  check("la proyeccion empieza donde termina lo real",
    r.projection[28] === r.real[28], `${r.projection[28]} vs ${r.real[28]}`);
  check("el ritmo llega justo al presupuesto",
    Math.abs(r.budgetPace[30] - 900) < 0.001, `S/${r.budgetPace[30]}`);
  check("etiquetas solo cada 5 dias y el ultimo",
    r.labels.filter(Boolean).join(",") === "1,5,10,15,20,25,30,31",
    r.labels.filter(Boolean).join(","));
}

// --- Ejemplo del usuario: dia 26, S/842 gastados, presupuesto S/900 ---
{
  const gastos = [{ date: "2026-07-26", amount: 842 }];
  const r = calcular({ y: 2026, m: 6, hoy: 26, presupuesto: 900, gastos });
  check("ejemplo: gastado hasta el 26", r.spentToday === 842, `S/${r.spentToday}`);
  check("ejemplo: promedio diario ~32", Math.round(r.dailyAvg) === 32, `S/${r.dailyAvg.toFixed(2)}`);
  check("ejemplo: proyeccion ~1004", Math.round(r.projected) === 1004, `S/${Math.round(r.projected)}`);
  check("ejemplo: la proyeccion supera el presupuesto", r.projected > 900);
}

// --- Febrero (28 dias) y mes ya pasado ---
{
  const r = calcular({ y: 2026, m: 1, hoy: null, presupuesto: 500,
    gastos: [{ date: "2026-02-10", amount: 100 }] });
  check("febrero tiene 28 puntos", r.real.length === 28);
  check("mes pasado: sin proyeccion", r.projection === null);
  check("mes pasado: la linea real llega al final", r.real[27] === 100);
  check("febrero: ultima etiqueta es 28", r.labels[27] === "28");
}

// --- Sin presupuesto puesto ---
{
  const r = calcular({ y: 2026, m: 6, hoy: 10, presupuesto: 0,
    gastos: [{ date: "2026-07-05", amount: 50 }] });
  check("sin presupuesto no se dibuja el ritmo", r.budgetPace === null);
  check("sin presupuesto la proyeccion sigue existiendo", r.projection !== null);
}

// --- Nada se sale del dibujo ---
{
  const r = calcular({ y: 2026, m: 6, hoy: 15, presupuesto: 900,
    gastos: [{ date: "2026-07-02", amount: 700 }] });
  const todos = [
    ...r.real.filter((v) => v != null),
    ...(r.budgetPace ?? []),
    ...(r.projection ?? []).filter((v) => v != null),
  ];
  const max = Math.max(...todos, 0) || 1;
  const PAD_TOP = 12, plotH = 130 - 12 - 12;
  const ys = todos.map((v) => PAD_TOP + plotH * (1 - v / max));
  check("todos los puntos caben en el alto",
    ys.every((y) => y >= PAD_TOP - 0.01 && y <= PAD_TOP + plotH + 0.01),
    `y entre ${Math.min(...ys).toFixed(1)} y ${Math.max(...ys).toFixed(1)}`);
  check("la proyeccion desbordada tambien entra en la escala",
    r.projected > 900 && max >= r.projected, `proy S/${Math.round(r.projected)} max S/${Math.round(max)}`);
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;

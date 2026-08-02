// Comprueba el grafico de gasto por dia y sus cuentas, con los movimientos
// reales que enseño el usuario y con otros patrones.

const PLOT_H = 130;

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

  const bars = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    amount: porDia.get(i + 1) ?? 0,
  }));
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const diasConGasto = [...porDia.values()].filter((v) => v > 0).length;

  let topDay = 0, topAmount = 0;
  for (const [d, a] of porDia) if (a > topAmount) { topAmount = a; topDay = d; }

  return {
    bars, daysInMonth, isCurrentMonth,
    today: isCurrentMonth ? Math.min(hoy, daysInMonth) : 0,
    todayAmount: isCurrentMonth ? (porDia.get(hoy) ?? 0) : 0,
    total,
    average: elapsed > 0 ? total / elapsed : 0,
    diasConGasto, topDay, topAmount,
  };
}

// Altura de cada barra, igual que en el componente
const altura = (amount, max) =>
  amount > 0 ? Math.max(6, (amount / (max || 1)) * (PLOT_H - 24)) : 2;

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(46)} ${d}`);
  if (!ok) fallos++;
}

// ---- Movimientos REALES del usuario (julio 2026, hoy 29) ----
const REALES = [
  { date: "2026-07-28", amount: 3 }, { date: "2026-07-28", amount: 4 },
  { date: "2026-07-28", amount: 1 }, { date: "2026-07-28", amount: 6 },
  { date: "2026-07-28", amount: 8 }, { date: "2026-07-28", amount: 2 },
  { date: "2026-07-28", amount: 5 }, { date: "2026-07-28", amount: 7 },
  { date: "2026-07-29", amount: 10 }, { date: "2026-07-29", amount: 10 },
];

{
  const r = calcular(REALES, 2026, 6, 29);
  check("hay una barra por dia del mes", r.bars.length === 31, `${r.bars.length} barras`);
  check("dia 28 suma sus 8 movimientos", r.bars[27].amount === 36, `S/${r.bars[27].amount}`);
  check("dia 29 suma sus 2 movimientos", r.bars[28].amount === 20, `S/${r.bars[28].amount}`);
  check("los demas dias en cero",
    r.bars.filter((b) => b.day !== 28 && b.day !== 29).every((b) => b.amount === 0));
  check("total del mes", r.total === 56, `S/${r.total}`);
  check("gasto de hoy (29)", r.todayAmount === 20, `S/${r.todayAmount}`);
  check("promedio diario sobre dias transcurridos",
    Math.abs(r.average - 56 / 29) < 0.001, `S/${r.average.toFixed(2)}`);
  check("dia de mas gasto", r.topDay === 28 && r.topAmount === 36, `dia ${r.topDay} S/${r.topAmount}`);
  check("dias con gasto", r.diasConGasto === 2, `${r.diasConGasto} de ${r.daysInMonth}`);

  // Alturas: la mayor llena el area y ninguna se sale
  const max = Math.max(...r.bars.map((b) => b.amount));
  const hs = r.bars.map((b) => altura(b.amount, max));
  check("la barra mayor llega al techo del area",
    Math.abs(hs[27] - (PLOT_H - 24)) < 0.01, `${hs[27].toFixed(0)}px de ${PLOT_H - 24}`);
  check("ninguna barra se sale del area", hs.every((h) => h <= PLOT_H - 24 + 0.01));
  check("la barra del 29 es mas baja que la del 28", hs[28] < hs[27],
    `${hs[28].toFixed(0)}px vs ${hs[27].toFixed(0)}px`);
  check("los dias sin gasto se ven como rayita",
    hs[0] === 2 && hs[10] === 2);
}

// ---- Febrero: 28 barras automaticamente ----
{
  const r = calcular([{ date: "2026-02-10", amount: 50 }], 2026, 1, null);
  check("febrero: 28 barras", r.bars.length === 28);
  check("mes pasado: sin gasto de hoy", r.today === 0 && r.todayAmount === 0);
  check("mes pasado: promedio sobre el mes completo",
    Math.abs(r.average - 50 / 28) < 0.001, `S/${r.average.toFixed(2)}`);
}

// ---- Gasto todos los dias ----
{
  const todos = [];
  for (let d = 1; d <= 29; d++) todos.push({ date: `2026-07-${String(d).padStart(2, "0")}`, amount: 5 });
  const r = calcular(todos, 2026, 6, 29);
  check("gasto diario: 29 dias con gasto", r.diasConGasto === 29);
  check("todas las barras iguales",
    new Set(r.bars.filter((b) => b.amount > 0).map((b) => b.amount)).size === 1);
  check("promedio = lo de cada dia", Math.abs(r.average - 5) < 0.001, `S/${r.average.toFixed(2)}`);
}

// ---- Mes sin gastos ----
{
  const r = calcular([], 2026, 6, 15);
  check("mes vacio: total cero", r.total === 0);
  check("mes vacio: sin dia top", r.topDay === 0);
  check("mes vacio: promedio cero", r.average === 0);
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;

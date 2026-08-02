// Comprueba las dos respuestas nuevas del microfono: "en que mes gaste mas"
// y "compara junio con mayo", con los meses reales del usuario.

// Mismo calculo que totalsByMonth() de screens/VoiceEntry.tsx
function totalsByMonth(transactions) {
  const map = new Map();
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7);
    const acc = map.get(key) ?? { expense: 0, income: 0 };
    if (tx.type === "income") acc.income += tx.amount;
    else acc.expense += tx.amount;
    map.set(key, acc);
  }
  return map;
}

// Mismo bloque `topMonth`
function topMonth(transactions, focus, direction) {
  const totals = totalsByMonth(transactions);
  const lista = [...totals.entries()]
    .map(([key, t]) => ({ key, value: focus === "income" ? t.income : t.expense }))
    .filter((m) => m.value > 0)
    .sort((a, b) => (direction === "least" ? a.value - b.value : b.value - a.value));
  if (lista.length === 0) return { empty: true, winner: null, others: [], max: 0 };
  return {
    empty: false,
    winner: lista[0],
    others: lista.slice(1, 6),
    max: Math.max(...lista.map((m) => m.value)),
  };
}

// Mismo bloque `compare`
function compare(transactions, months, focus) {
  const totals = totalsByMonth(transactions);
  const vacio = { expense: 0, income: 0 };
  const a = { key: months[0], ...(totals.get(months[0]) ?? vacio) };
  const b = { key: months[1], ...(totals.get(months[1]) ?? vacio) };
  const porIngresos = focus === "income";
  const va = porIngresos ? a.income : a.expense;
  const vb = porIngresos ? b.income : b.expense;
  const diff = va - vb;
  const mayor = Math.max(va, vb);
  const casiIgual = mayor === 0 || Math.abs(diff) / mayor < 0.05;
  return {
    a, b,
    empty: a.expense + a.income + b.expense + b.income === 0,
    casiIgual, diff: Math.abs(diff),
    mesConMas: diff >= 0 ? a.key : b.key,
    subeLaFrase: diff >= 0,
    porIngresos,
  };
}

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(52)} ${d}`);
  if (!ok) fallos++;
}

// Los meses reales del usuario, tal como se ven en su pantalla de Reportes:
// mayo S/1,347 · junio S/299 · julio S/56
const REALES = [
  { date: "2026-05-03", amount: 900, type: "expense" },
  { date: "2026-05-17", amount: 447, type: "expense" },
  { date: "2026-05-01", amount: 2000, type: "income" },
  { date: "2026-06-08", amount: 299, type: "expense" },
  { date: "2026-06-01", amount: 1500, type: "income" },
  { date: "2026-07-28", amount: 36, type: "expense" },
  { date: "2026-07-29", amount: 20, type: "expense" },
  { date: "2026-07-15", amount: 500, type: "income" },
];

console.log("Los totales por mes salen de los movimientos, no de ningun sitio raro");
{
  const t = totalsByMonth(REALES);
  check("mayo: S/1,347 gastados", t.get("2026-05").expense === 1347, `S/${t.get("2026-05").expense}`);
  check("junio: S/299 gastados", t.get("2026-06").expense === 299, `S/${t.get("2026-06").expense}`);
  check("julio: S/56 gastados", t.get("2026-07").expense === 56, `S/${t.get("2026-07").expense}`);
  check("mayo: S/2,000 de ingresos", t.get("2026-05").income === 2000);
  check("solo hay 3 meses", t.size === 3, [...t.keys()].join(","));
}

console.log('\n"En que mes gaste mas"');
{
  const r = topMonth(REALES, "expense", "most");
  check("gana mayo", r.winner.key === "2026-05", r.winner.key);
  check("con S/1,347", r.winner.value === 1347, `S/${r.winner.value}`);
  check("los demas van detras, de mayor a menor",
    r.others.map((m) => m.key).join(",") === "2026-06,2026-07",
    r.others.map((m) => `${m.key}:${m.value}`).join(" "));
  check("las barritas se miden contra el mayor", r.max === 1347, `${r.max}`);
  check("ninguna barrita se pasa del 100%", r.others.every((m) => m.value / r.max <= 1));
}

console.log('\n"En que mes gaste menos"');
{
  const r = topMonth(REALES, "expense", "least");
  check("gana julio", r.winner.key === "2026-07", r.winner.key);
  check("con S/56", r.winner.value === 56, `S/${r.winner.value}`);
  check("los demas van detras, de menor a mayor",
    r.others.map((m) => m.key).join(",") === "2026-06,2026-05",
    r.others.map((m) => `${m.key}:${m.value}`).join(" "));
  // Este era el detalle facil de equivocar: al pedir "el que menos", la
  // ganadora es la mas chica, asi que las barritas no pueden medirse contra
  // ella o todas se saldrian.
  check("las barritas se siguen midiendo contra el mayor", r.max === 1347, `${r.max}`);
  check("ninguna barrita se pasa del 100%", r.others.every((m) => m.value / r.max <= 1));
}

console.log('\n"En que mes tuve mas ingresos"');
{
  const r = topMonth(REALES, "income", "most");
  check("gana mayo", r.winner.key === "2026-05", r.winner.key);
  check("con S/2,000", r.winner.value === 2000, `S/${r.winner.value}`);
  check("no se cuelan los gastos", r.others.every((m) => [1500, 500].includes(m.value)),
    r.others.map((m) => m.value).join(","));
}

console.log("\nUn mes sin lo que se pregunta no entra en la carrera");
{
  const soloGastos = [
    { date: "2026-05-03", amount: 100, type: "expense" },
    { date: "2026-06-03", amount: 50, type: "income" },
  ];
  const r = topMonth(soloGastos, "income", "least");
  check("preguntando por ingresos, mayo no cuenta", r.winner.key === "2026-06", r.winner.key);
  check("y no sale como 'el que menos ingresos tuvo' con S/0",
    !r.others.some((m) => m.key === "2026-05"));

  check("sin ningun movimiento no se inventa nada", topMonth([], "expense", "most").empty === true);
}

console.log('\n"Mes de junio comparacion mes de mayo"');
{
  const r = compare(REALES, ["2026-06", "2026-05"], "all");
  check("junio va primero, como se dijo", r.a.key === "2026-06", r.a.key);
  check("junio: S/299 de gastos", r.a.expense === 299, `S/${r.a.expense}`);
  check("mayo: S/1,347 de gastos", r.b.expense === 1347, `S/${r.b.expense}`);
  check("junio: S/1,500 de ingresos", r.a.income === 1500);
  check("mayo: S/2,000 de ingresos", r.b.income === 2000);
  check("la diferencia es S/1,048", r.diff === 1048, `S/${r.diff}`);
  check("la frase dice que en junio se gasto MENOS", r.subeLaFrase === false);
  check("y no dice 'casi lo mismo'", r.casiIgual === false);
  check("lo que queda en junio: 1500-299 = S/1,201", r.a.income - r.a.expense === 1201);
  check("lo que queda en mayo: 2000-1347 = S/653", r.b.income - r.b.expense === 653);
}

console.log('\n"Compara mayo con junio" (al reves)');
{
  const r = compare(REALES, ["2026-05", "2026-06"], "all");
  check("mayo va primero", r.a.key === "2026-05");
  check("la misma diferencia", r.diff === 1048, `S/${r.diff}`);
  check("pero ahora la frase dice que se gasto MAS", r.subeLaFrase === true);
}

console.log("\nComparar ingresos");
{
  const r = compare(REALES, ["2026-06", "2026-05"], "income");
  check("mira los ingresos, no los gastos", r.porIngresos === true);
  check("la diferencia es S/500", r.diff === 500, `S/${r.diff}`);
  check("en junio se recibio menos", r.subeLaFrase === false);
}

console.log("\nCasos raros");
{
  const r = compare(REALES, ["2026-01", "2026-02"], "all");
  check("dos meses sin nada: se avisa", r.empty === true);
  check("y no se inventan cifras", r.a.expense === 0 && r.b.income === 0);

  const unSolo = compare(REALES, ["2026-06", "2026-01"], "all");
  check("un mes con datos y otro sin nada NO es 'vacio'", unSolo.empty === false);
  check("la diferencia es todo el mes que tiene", unSolo.diff === 299, `S/${unSolo.diff}`);

  // Casi iguales: menos del 5% de diferencia
  const parecidos = [
    { date: "2026-05-03", amount: 1000, type: "expense" },
    { date: "2026-06-03", amount: 1020, type: "expense" },
  ];
  const rp = compare(parecidos, ["2026-06", "2026-05"], "all");
  check("2% de diferencia se dice 'casi lo mismo'", rp.casiIgual === true,
    `S/${rp.diff} de S/1020`);
  const distintos = compare(
    [{ date: "2026-05-03", amount: 1000, type: "expense" },
     { date: "2026-06-03", amount: 1200, type: "expense" }],
    ["2026-06", "2026-05"], "all");
  check("20% de diferencia si se dice", distintos.casiIgual === false, `S/${distintos.diff}`);
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;

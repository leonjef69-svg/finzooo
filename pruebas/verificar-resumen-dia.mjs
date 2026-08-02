// Comprueba el resumen de un dia con los movimientos REALES del usuario.
// La pregunta que fallaba era "gastos de 28 de julio": contestaba S/ 28
// (el numero de la fecha) cuando lo gastado ese dia era S/ 36.

// Mismo calculo que el bloque `summary` de screens/VoiceEntry.tsx
function resumir(transactions, summaryMk, summaryDay, summaryFocus, summaryCategory) {
  const prefix = summaryDay > 0 ? `${summaryMk}-${String(summaryDay).padStart(2, "0")}` : summaryMk;
  const monthTx = transactions.filter((tx) => tx.date.startsWith(prefix));

  const wantsIncome = summaryFocus === "income";
  const all = monthTx.filter((tx) => (wantsIncome ? tx.type === "income" : tx.type === "expense"));
  const other = monthTx.filter((tx) => (wantsIncome ? tx.type === "expense" : tx.type === "income"));
  const main = summaryCategory ? all.filter((tx) => tx.category === summaryCategory) : all;

  return {
    isDay: summaryDay > 0,
    total: main.reduce((s, tx) => s + tx.amount, 0),
    otherTotal: other.reduce((s, tx) => s + tx.amount, 0),
    count: main.length,
    items: [...main].sort((a, b) => b.amount - a.amount).slice(0, summaryDay > 0 ? 10 : 6),
  };
}

// Lo que se ve en las capturas del usuario, dia por dia
const REALES = [
  { id: "a", date: "2026-07-29", amount: 10, type: "expense", category: "comida", description: "hamburguesa" },
  { id: "b", date: "2026-07-29", amount: 10, type: "expense", category: "otros", description: "" },
  { id: "c", date: "2026-07-28", amount: 3, type: "expense", category: "otros", description: "medias" },
  { id: "d", date: "2026-07-28", amount: 4, type: "expense", category: "otros", description: "platos" },
  { id: "e", date: "2026-07-28", amount: 7, type: "expense", category: "otros", description: "tenedores" },
  { id: "f", date: "2026-07-28", amount: 1, type: "expense", category: "otros", description: "" },
  { id: "g", date: "2026-07-28", amount: 6, type: "expense", category: "otros", description: "" },
  { id: "h", date: "2026-07-28", amount: 8, type: "expense", category: "otros", description: "" },
  { id: "i", date: "2026-07-28", amount: 2, type: "expense", category: "otros", description: "" },
  { id: "j", date: "2026-07-28", amount: 5, type: "expense", category: "otros", description: "" },
  { id: "k", date: "2026-07-15", amount: 500, type: "income", category: "salario", description: "sueldo" },
  { id: "l", date: "2026-06-20", amount: 99, type: "expense", category: "otros", description: "junio" },
];

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(50)} ${d}`);
  if (!ok) fallos++;
}

console.log('"gastos de 28 de julio"');
{
  const r = resumir(REALES, "2026-07", 28, "expense", "");
  check("contesta S/ 36, no los S/ 28 de la fecha", r.total === 36, `S/${r.total}`);
  check("cuenta los 8 gastos del dia", r.count === 8, `${r.count}`);
  check("se marca como pregunta de un dia", r.isDay === true);
  check("no se cuela el dia 29", !r.items.some((tx) => tx.date === "2026-07-29"));
  check("no se cuela junio", !r.items.some((tx) => tx.date.startsWith("2026-06")));
  check("los 8 caben en la lista", r.items.length === 8, `${r.items.length} de ${r.count}`);
  check("van del mas caro al mas barato",
    r.items.every((tx, i, a) => i === 0 || a[i - 1].amount >= tx.amount),
    r.items.map((tx) => tx.amount).join(" "));
  check("el ingreso del 15 no entra en el total", r.total === 36);
  check("y tampoco aparece como 'entraron'", r.otherTotal === 0, `S/${r.otherTotal}`);
}

console.log('\n"gastos de 29 de julio"');
{
  const r = resumir(REALES, "2026-07", 29, "expense", "");
  check("contesta S/ 20", r.total === 20, `S/${r.total}`);
  check("cuenta 2 gastos", r.count === 2, `${r.count}`);
}

console.log("\nEl mes entero sigue funcionando igual");
{
  const r = resumir(REALES, "2026-07", 0, "expense", "");
  check("julio suma los 10 gastos", r.total === 56 && r.count === 10, `S/${r.total} en ${r.count}`);
  check("no se marca como dia", r.isDay === false);
  check("el ingreso de S/500 sale como 'entraron'", r.otherTotal === 500, `S/${r.otherTotal}`);
  check("solo se listan 6 de un mes", r.items.length === 6, `${r.items.length}`);
  check("junio no entra en julio", !r.items.some((tx) => tx.date.startsWith("2026-06")));
}

console.log('\n"ingresos de 15 de julio"');
{
  const r = resumir(REALES, "2026-07", 15, "income", "");
  check("contesta S/ 500", r.total === 500, `S/${r.total}`);
  check("cuenta 1", r.count === 1);
  check("ese dia no hubo gastos", r.otherTotal === 0, `S/${r.otherTotal}`);
}

console.log('\n"gastos de comida del 29 de julio"');
{
  const r = resumir(REALES, "2026-07", 29, "expense", "comida");
  check("solo la hamburguesa", r.total === 10 && r.count === 1, `S/${r.total} en ${r.count}`);
}

console.log("\nUn dia sin nada no inventa nada");
{
  const r = resumir(REALES, "2026-07", 10, "expense", "");
  check("total en cero", r.total === 0);
  check("sin movimientos", r.count === 0);
  check("y la lista vacia", r.items.length === 0);
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;

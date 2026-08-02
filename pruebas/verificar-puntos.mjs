// Comprueba que los circulos del grafico caen SOLO en los dias con gasto
// (mas hoy), usando los movimientos reales que enseño el usuario.

const GASTOS = [
  { date: "2026-07-28", amount: 3 },   // medias
  { date: "2026-07-28", amount: 4 },   // platos
  { date: "2026-07-28", amount: 1 },   // salchipapa
  { date: "2026-07-28", amount: 6 },   // zapatillas
  { date: "2026-07-28", amount: 8 },   // cucharas
  { date: "2026-07-28", amount: 2 },   // hamburguesa
  { date: "2026-07-28", amount: 5 },   // calzoncillos
  { date: "2026-07-28", amount: 7 },   // tenedores (aprox)
  { date: "2026-07-29", amount: 10 },  // hamburguesa
  { date: "2026-07-29", amount: 10 },  // otros
];

const mk = "2026-07";
const daysInMonth = 31;
const today = 29;

const spentUpTo = (day) => {
  const cutoff = `${mk}-${String(day).padStart(2, "0")}`;
  return GASTOS.filter((g) => g.date <= cutoff).reduce((s, g) => s + g.amount, 0);
};

const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
const real = days.map((d) => (d <= today ? spentUpTo(d) : null));

// Misma regla que el componente
const isStep = (i) => {
  const v = real[i];
  if (v == null) return false;
  if (i === 0) return v > 0;
  const prev = real[i - 1];
  return prev == null ? v > 0 : v !== prev;
};
let lastDrawn = -1;
real.forEach((v, i) => { if (v != null) lastDrawn = i; });

const conCirculo = days.filter((_, i) => isStep(i) || i === lastDrawn);

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(46)} ${d}`);
  if (!ok) fallos++;
}

check("circulos solo en dias con gasto (+hoy)",
  conCirculo.join(",") === "28,29", `dias: ${conCirculo.join(",")}`);
check("dia 1 SIN circulo (antes lo tenia de adorno)", !isStep(0));
check("dias 5,10,15,20,25 sin circulo",
  ![5, 10, 15, 20, 25].some((d) => isStep(d - 1)));
check("total de hoy correcto", real[28] === 56, `S/${real[28]}`);
check("acumulado del dia 28", real[27] === 36, `S/${real[27]}`);
check("dias 1..27 en cero", real.slice(0, 27).every((v) => v === 0));
check("hoy es el ultimo punto dibujado", lastDrawn === 28);
check("no se dibuja despues de hoy", real[29] === null && real[30] === null);

// Con gasto repartido, deben salir mas circulos: el grafico no se queda
// "plano con dos puntos" por diseño, era por los datos.
const repartido = [1, 3, 7, 12, 18, 22, 27].map((d) => ({ date: `${mk}-${String(d).padStart(2, "0")}`, amount: 8 }));
const realR = days.map((d) => {
  if (d > today) return null;
  const cutoff = `${mk}-${String(d).padStart(2, "0")}`;
  return repartido.filter((g) => g.date <= cutoff).reduce((s, g) => s + g.amount, 0);
});
const stepsR = days.filter((_, i) => {
  const v = realR[i];
  if (v == null) return false;
  if (i === 0) return v > 0;
  const p = realR[i - 1];
  return p == null ? v > 0 : v !== p;
});
check("con gasto repartido salen 7 circulos", stepsR.length === 7, `dias: ${stepsR.join(",")}`);

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;

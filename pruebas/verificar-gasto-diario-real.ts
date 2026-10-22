import { readFileSync } from "node:fs";
import { dailySpendBars } from "@/utils/reportDaily";
import { dailyCalendarTotals } from "@/utils/reportCalendar";
import { labelStep, niceMax, textWidthScreen } from "@/components/DailyBarsChart";

let fallos = 0;
function ok(cond: boolean, mensaje: string) {
  if (!cond) {
    console.error(`FALLA ${mensaje}`);
    fallos++;
  }
}

const movimientos = [
  { date: "2026-07-28", type: "expense" as const, internalTransfer: undefined, amount: 3 },
  { date: "2026-07-28", type: "expense" as const, internalTransfer: undefined, amount: 33 },
  { date: "2026-07-29", type: "expense" as const, internalTransfer: undefined, amount: 20 },
  { date: "2026-07-15", type: "income" as const, internalTransfer: undefined, amount: 500 },
  { date: "2026-07-30", type: "expense" as const, internalTransfer: "box" as const, amount: 100 },
  { date: "2026-08-01", type: "expense" as const, internalTransfer: undefined, amount: 7 },
];

const julio = dailySpendBars(movimientos, { y: 2026, m: 6 }, new Date(2026, 6, 29));
ok(JSON.stringify(julio.bars) === JSON.stringify([{ day: 28, amount: 36 }, { day: 29, amount: 20 }]),
  "Reportes suma los gastos del mismo día, ordena y excluye ingreso, transferencia y otro mes");
ok(julio.today === 29, "el mes actual resalta hoy");

const pasado = dailySpendBars(movimientos, { y: 2026, m: 6 }, new Date(2026, 7, 1));
ok(pasado.today === 0, "un mes pasado no resalta el día actual");
ok(dailySpendBars([], { y: 2026, m: 1 }, new Date(2026, 1, 8)).bars.length === 0,
  "sin gastos no aparecen barras inventadas");

const calendarioJulio = dailyCalendarTotals(movimientos, { y: 2026, m: 6 });
ok(calendarioJulio.length === 31, "el calendario presenta todos los días del mes aunque no tengan movimientos");
ok(calendarioJulio[27].expense === 36 && calendarioJulio[27].income === 0,
  "el calendario suma en el día los gastos reales y excluye transferencias internas");
ok(calendarioJulio[14].income === 500 && calendarioJulio[14].expense === 0,
  "el calendario conserva los ingresos en su día para el detalle al tocar");
ok(dailyCalendarTotals([], { y: 2024, m: 1 }).length === 29,
  "el calendario respeta los años bisiestos");

ok(niceMax(36, 4) === 40, "el eje usa un techo redondo");
ok(labelStep(textWidthScreen("S/ 36.00", 10), 24) >= 2,
  "las etiquetas largas no se escriben sobre barras vecinas");

const reports = readFileSync("screens/Reports.tsx", "utf8");
const calendar = readFileSync("components/DailyActivityCalendar.tsx", "utf8");
ok(reports.includes("dailyCalendarTotals(transactions, { y: month.y, m: month.m })"),
  "Reportes usa los totales diarios probados, no una copia distinta");
ok(reports.includes("<DailyActivityCalendar") && !reports.includes("<DailyBarsChart"),
  "el calendario real reemplaza las barras diarias sin alterar el gráfico mensual");
ok(calendar.match(/numberOfLines=\{2\}/g)?.length === 2 && !calendar.includes("minimumFontScale={0.68}"),
  "ingresos y gastos conservan el tamaño legible y admiten dos líneas en cifras largas");

console.log(fallos === 0 ? "Calendario diario: agrupación, fechas y cifras largas comprobadas." : `${fallos} fallos`);
if (fallos) process.exitCode = 1;

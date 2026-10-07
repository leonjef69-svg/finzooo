import { readFileSync } from "node:fs";
import { dailySpendBars } from "@/utils/reportDaily";
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

ok(niceMax(36, 4) === 40, "el eje usa un techo redondo");
ok(labelStep(textWidthScreen("S/ 36.00", 10), 24) >= 2,
  "las etiquetas largas no se escriben sobre barras vecinas");

const reports = readFileSync("screens/Reports.tsx", "utf8");
ok(reports.includes("dailySpendBars(transactions, month)"),
  "la pantalla usa la función probada, no una copia distinta");

console.log(fallos === 0 ? "Gráfico diario: datos y medidas reales comprobados." : `${fallos} fallos`);
if (fallos) process.exitCode = 1;

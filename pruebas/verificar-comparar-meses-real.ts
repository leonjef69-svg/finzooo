import { readFileSync } from "node:fs";
import { voiceCompareMonths, voiceMonthlyTotals, voiceTopMonth } from "@/utils/voiceMonth";

let fallos = 0;
function ok(cond: boolean, mensaje: string) {
  if (!cond) {
    console.error(`FALLA ${mensaje}`);
    fallos++;
  }
}

const movimientos = [
  { date: "2026-05-03", amount: 900, type: "expense" as const, internalTransfer: undefined },
  { date: "2026-05-17", amount: 447, type: "expense" as const, internalTransfer: undefined },
  { date: "2026-05-01", amount: 2000, type: "income" as const, internalTransfer: undefined },
  { date: "2026-06-08", amount: 299, type: "expense" as const, internalTransfer: undefined },
  { date: "2026-06-01", amount: 1500, type: "income" as const, internalTransfer: undefined },
  { date: "2026-07-28", amount: 36, type: "expense" as const, internalTransfer: undefined },
  { date: "2026-07-29", amount: 20, type: "expense" as const, internalTransfer: undefined },
  { date: "2026-07-15", amount: 500, type: "income" as const, internalTransfer: undefined },
  { date: "2026-07-30", amount: 10_000, type: "expense" as const, internalTransfer: "box" as const },
];

const totals = voiceMonthlyTotals(movimientos);
ok(totals.get("2026-05")?.expense === 1347, "mayo suma S/ 1.347 de gastos");
ok(totals.get("2026-07")?.expense === 56, "la transferencia de Caja no infla julio");
ok(totals.get("2026-05")?.income === 2000, "los ingresos quedan separados");

const mas = voiceTopMonth(totals, "expense", "most");
ok(mas.winner?.key === "2026-05" && mas.winner.value === 1347, "gana el mes con mayor gasto");
const menos = voiceTopMonth(totals, "expense", "least");
ok(menos.winner?.key === "2026-07" && menos.max === 1347,
  "el menor gana pero las barras se comparan con el mayor");
ok(voiceTopMonth(totals, "income", "most").winner?.key === "2026-05",
  "el ranking de ingresos no usa los gastos");

const compare = voiceCompareMonths(totals, ["2026-05", "2026-06"], "all");
ok(compare.a.expense === 1347 && compare.b.expense === 299,
  "compara los dos meses solicitados");
ok(compare.mesConMas === "2026-05" && compare.diff === 1048,
  "la frase de gastos señala el mes y diferencia correctos");
ok(voiceCompareMonths(totals, ["2026-05", "2026-06"], "income").diff === 500,
  "comparar ingresos toma la columna de ingresos");

const soloIngresos = voiceMonthlyTotals([
  { date: "2026-05-03", amount: 100, type: "expense" as const },
  { date: "2026-06-03", amount: 50, type: "income" as const },
]);
ok(voiceTopMonth(soloIngresos, "income", "least").winner?.key === "2026-06",
  "un mes sin ingresos no gana el ranking de menor ingreso");
ok(voiceTopMonth(voiceMonthlyTotals([]), "expense", "most").empty,
  "sin movimientos no se inventa un ganador");

const alReves = voiceCompareMonths(totals, ["2026-06", "2026-05"], "all");
ok(alReves.a.key === "2026-06" && !alReves.subeLaFrase && alReves.diff === 1048,
  "la comparación respeta el orden pedido y dice si bajó");
const vacio = voiceCompareMonths(totals, ["2026-01", "2026-02"], "all");
ok(vacio.empty && vacio.a.expense === 0 && vacio.b.income === 0,
  "dos meses sin datos siguen vacíos");
ok(!voiceCompareMonths(totals, ["2026-06", "2026-01"], "all").empty,
  "un solo mes con datos no se marca como vacío");
const parecidos = voiceMonthlyTotals([
  { date: "2026-05-03", amount: 1000, type: "expense" as const },
  { date: "2026-06-03", amount: 1020, type: "expense" as const },
]);
ok(voiceCompareMonths(parecidos, ["2026-06", "2026-05"], "all").casiIgual,
  "una diferencia de 2 % se expresa como casi igual");
const distintos = voiceMonthlyTotals([
  { date: "2026-05-03", amount: 1000, type: "expense" as const },
  { date: "2026-06-03", amount: 1200, type: "expense" as const },
]);
ok(!voiceCompareMonths(distintos, ["2026-06", "2026-05"], "all").casiIgual,
  "una diferencia de 20 % no se oculta");

const screen = readFileSync("screens/VoiceEntry.tsx", "utf8");
ok(screen.includes("voiceMonthlyTotals(transactions)") && screen.includes("voiceTopMonth(") && screen.includes("voiceCompareMonths("),
  "la pantalla de Voz usa estas funciones reales");

console.log(fallos === 0 ? "Voz: ranking y comparación mensual reales comprobados." : `${fallos} fallos`);
if (fallos) process.exitCode = 1;

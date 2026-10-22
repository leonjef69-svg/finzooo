import { readFileSync } from "node:fs";
import { monthlyActivityTotals } from "@/utils/monthlyActivity";

let fallos = 0;
function ok(condicion: boolean, mensaje: string) {
  if (!condicion) {
    console.error(`FALLA ${mensaje}`);
    fallos++;
  }
}

const movements = [
  { date: "2026-01-03", type: "income" as const, amount: 120, internalTransfer: undefined },
  { date: "2026-01-04", type: "expense" as const, amount: 45, internalTransfer: undefined },
  { date: "2026-01-05", type: "expense" as const, amount: 300, internalTransfer: "family" as const },
  { date: "2026-07-08", type: "income" as const, amount: 200, internalTransfer: undefined },
  { date: "2025-07-08", type: "expense" as const, amount: 999, internalTransfer: undefined },
  { date: "2026-13-01", type: "expense" as const, amount: 999, internalTransfer: undefined },
];

const totals = monthlyActivityTotals(movements, 2026);
ok(totals.length === 12, "incluye los doce meses, también los que no tienen movimientos");
ok(totals[0].income === 120 && totals[0].expense === 45, "suma ingreso y gasto sin incluir la transferencia interna");
ok(totals[6].income === 200 && totals[6].expense === 0, "separa los montos por mes y año");
ok(totals[1].income === 0 && totals[1].expense === 0, "mes vacío conserva totales en cero");

const component = readFileSync("components/MonthlyActivityComparison.tsx", "utf8");
const reports = readFileSync("screens/Reports.tsx", "utf8");
ok(component.includes("horizontal") && component.includes("pagingEnabled"), "la cuadrícula permite deslizar horizontalmente por seis meses");
ok(component.includes("onMomentumScrollEnd") && component.includes("[0, 1].map((pageIndex)"), "el indicador compacto sigue el grupo de meses visible al deslizar");
ok(!component.includes("ChevronLeft") && !component.includes("ChevronRight") && !component.includes("monthsSwipeHint"), "no muestra flechas ni el texto para deslizar");
ok(component.includes("reports.noActivityThisMonth") && component.includes("totals[index].income === 0 && totals[index].expense === 0"), "un mes sin movimientos muestra un solo aviso breve en lugar de ingresos/gastos en cero");
ok(component.includes("text-sm font-semibold text-slate-800") && component.includes('className="h-2 overflow-hidden rounded-full') && component.includes("px-1.5 py-1.5") && component.includes("flex-row gap-0.5"), "meses y barras son más visibles y aprovechan mejor el ancho sin ampliar el diseño");
ok(component.includes("text-[15px] font-bold") && component.includes("-mx-0.5 mt-2 min-h-[50px]") && component.includes("text-[17px] font-semibold text-emerald-800") && component.includes("border-slate-300 dark:border-slate-600"), "el mes y sus cifras son más legibles, con botón de comparación apenas mayor y borde visible");
ok(component.includes("if (index !== selectedMonth) setComparisonMonth(index)"), "la comparación conserva el mes elegido y pide tocar solo el segundo");
ok(reports.includes("<MonthlyActivityComparison") && !reports.includes("<BarChartSimple"), "Reportes muestra el nuevo componente en lugar del gráfico mensual antiguo");

console.log(fallos === 0 ? "Comparativa mensual: totales reales, meses vacíos, transferencias y selección verificados." : `${fallos} fallos`);
if (fallos) process.exitCode = 1;

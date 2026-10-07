import { readFileSync } from "node:fs";
import { voiceSummary } from "@/utils/voiceSummary";

let fallos = 0;
function ok(cond: boolean, mensaje: string) {
  if (!cond) {
    console.error(`FALLA ${mensaje}`);
    fallos++;
  }
}

const movimientos = [
  { date: "2026-07-28", amount: 3, type: "expense" as const, category: "otros", internalTransfer: undefined },
  { date: "2026-07-28", amount: 33, type: "expense" as const, category: "comida", internalTransfer: undefined },
  { date: "2026-07-29", amount: 20, type: "expense" as const, category: "comida", internalTransfer: undefined },
  { date: "2026-07-15", amount: 500, type: "income" as const, category: "salario", internalTransfer: undefined },
  { date: "2026-07-28", amount: 999, type: "expense" as const, category: "otros", internalTransfer: "family" as const },
  { date: "2026-06-28", amount: 99, type: "expense" as const, category: "otros", internalTransfer: undefined },
];
const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const t = (key: string) => key;

const dia = voiceSummary(movimientos, "2026-07", 28, "expense", "", months, t);
ok(dia.total === 36 && dia.count === 2, "28 de julio suma S/ 36, no el número del día");
ok(dia.isDay && dia.items.every((tx) => tx.date === "2026-07-28"), "solo enseña el día pedido");
ok(dia.items[0]?.amount === 33, "ordena movimientos de mayor a menor");
ok(dia.otherTotal === 0, "el ingreso de otro día no entra en el resumen");

const mes = voiceSummary(movimientos, "2026-07", 0, "expense", "", months, t);
ok(mes.total === 56 && mes.otherTotal === 500, "el mes separa gastos e ingresos");
ok(voiceSummary(movimientos, "2026-07", 0, "all", "", months, t).total === 56,
  "sin pedir tipo explícito, Voz mantiene el gasto como protagonista");
ok(mes.top[0]?.[0] === "comida" && mes.top[0][1] === 53, "las categorías se ordenan por gasto");
ok(!mes.items.some((tx) => tx.amount === 999), "una transferencia no infla el resumen");

const categoria = voiceSummary(movimientos, "2026-07", 28, "expense", "comida", months, t);
ok(categoria.total === 33 && categoria.count === 1, "filtra la categoría pedida");
const ingreso = voiceSummary(movimientos, "2026-07", 15, "income", "", months, t);
ok(ingreso.total === 500 && ingreso.otherTotal === 0, "la pregunta de ingresos enseña ingresos");
const vacio = voiceSummary(movimientos, "2026-07", 10, "expense", "", months, t);
ok(vacio.total === 0 && vacio.items.length === 0, "un día vacío no inventa movimientos");

const screen = readFileSync("screens/VoiceEntry.tsx", "utf8");
ok(screen.includes("voiceSummary(transactions,"), "la pantalla usa la función probada");

console.log(fallos === 0 ? "Voz: resumen por día y mes real comprobado." : `${fallos} fallos`);
if (fallos) process.exitCode = 1;

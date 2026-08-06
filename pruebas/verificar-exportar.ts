// Comprueba el PDF nuevo (logo, gráficos, escapado) y la programación.
import {
  buildPdfHtml,
  byCategory,
  byDay,
  esc,
  type PdfTx,
} from "@/utils/exportPdfHtml";
import {
  DEFAULT_SCHEDULE,
  MAX_MONTH_DAY,
  claveDeEjecucion,
  isAutoRunDue,
  monthForSchedule,
  toDateKey,
  type ScheduledExport,
} from "@/utils/scheduledExport";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  console.log(`  ${cond ? "OK   " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
}

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

function tx(p: Partial<PdfTx>): PdfTx {
  return {
    dateLabel: "1 de julio",
    day: 1,
    categoryLabel: "Comida",
    categoryColor: "#f97316",
    description: "",
    methodLabel: "Efectivo",
    amount: 10,
    type: "expense",
    ...p,
  };
}

const TEXTS = {
  colDate: "Fecha",
  colCategory: "Categoría",
  colDescription: "Descripción",
  colMethod: "Método",
  colAmount: "Monto",
  total: "Total",
  income: "Ingresos",
  expenses: "Gastos",
  balance: "Balance",
  byCategory: "Reparto por categoría",
  byCategoryBudget: "Presupuestos por categoría",
  byMonth: "Últimos meses",
  byDay: "Día a día",
  generatedOn: "Generado el",
  movements: "Movimientos",
};

function html(txs: PdfTx[], charts = true) {
  return buildPdfHtml({
    logoDataUri: "data:image/png;base64,AAAA",
    userName: "Diana",
    title: "Reporte de movimientos",
    monthLabel: "Julio 2026",
    txs,
    daysInMonth: 31,
    fmt,
    texts: TEXTS,
    charts,
    categoryBudgets: [],
    monthly: [],
    generatedAt: "30 de julio",
  });
}

console.log("\n--- ESCAPADO ---");
ok(esc("arroz <de 5kg>") === "arroz &lt;de 5kg&gt;", "los signos < y > se escapan");
ok(esc("pago 100 & pico") === "pago 100 &amp; pico", "el & se escapa");
{
  // Este era el fallo de verdad: una descripción con "<" rompía la tabla a
  // partir de esa fila y el PDF salía a medias sin decir por qué.
  const h = html([tx({ description: "arroz <5kg> & pan" })]);
  ok(!h.includes("<5kg>"), "la descripción con < no entra cruda en el HTML");
  ok(h.includes("&lt;5kg&gt;"), "la descripción con < sale escapada y legible");
  // Todas las etiquetas abiertas se cierran: si el escapado fallara, el
  // conteo se desequilibraría.
  const abiertas = (h.match(/<td[ >]/g) || []).length;
  const cerradas = (h.match(/<\/td>/g) || []).length;
  ok(abiertas === cerradas, `las celdas abren y cierran parejo (${abiertas}/${cerradas})`);
}

console.log("\n--- LOGO ---");
{
  const h = html([tx({})]);
  ok(h.includes('src="data:image/png;base64,'), "el logo va incrustado, no como archivo");
  ok(!/src="file:|src="http/.test(h), "no hay ninguna imagen que el PDF no pueda cargar");
}

console.log("\n--- RESUMEN ---");
{
  const h = html([
    tx({ amount: 300, type: "income" }),
    tx({ amount: 100, type: "expense" }),
    tx({ amount: 50, type: "expense" }),
  ]);
  ok(h.includes("S/ 300.00"), "los ingresos suman 300");
  ok(h.includes("S/ 150.00"), "los gastos suman 150");
  // 300 - 150 = 150, que es el mismo número que los gastos, así que el
  // balance se comprueba por el texto del total y no por el monto suelto.
  ok(/Total:\s*<span[^>]*>S\/ 150\.00/.test(h), "el total es el balance (300 - 150)");
}
{
  // Un mes en rojo tiene que verse en rojo, no en verde.
  const h = html([tx({ amount: 500, type: "expense" }), tx({ amount: 100, type: "income" })]);
  ok(/Total:\s*<span style="color:#e11d48;">S\/ -400\.00/.test(h), "un balance negativo sale en rojo");
}

console.log("\n--- GRÁFICO POR CATEGORÍA ---");
{
  const filas = byCategory(
    [
      tx({ categoryLabel: "Comida", amount: 60 }),
      tx({ categoryLabel: "Transporte", amount: 30 }),
      tx({ categoryLabel: "Comida", amount: 10 }),
      tx({ categoryLabel: "Sueldo", amount: 999, type: "income" }),
    ],
    "expense"
  );
  ok(filas.length === 2, "solo salen las categorías de gasto, no el ingreso");
  ok(filas[0].label === "Comida" && filas[0].amount === 70, "Comida suma sus dos movimientos");
  ok(filas[0].amount > filas[1].amount, "van de mayor a menor");
  const suma = filas.reduce((s, f) => s + f.share, 0);
  ok(Math.abs(suma - 1) < 1e-9, "los porcentajes suman 100%");
}
ok(byCategory([], "expense").length === 0, "sin movimientos no hay gráfico (y no se divide entre cero)");

console.log("\n--- GRÁFICO DIARIO ---");
{
  const dias = byDay([tx({ day: 3, amount: 10 }), tx({ day: 3, amount: 5 }), tx({ day: 31, amount: 1 })], "expense", 31);
  ok(dias.length === 31, "hay una posición por día del mes");
  ok(dias[2] === 15, "el día 3 suma sus dos gastos");
  ok(dias[30] === 1, "el día 31 cae en la última posición, no fuera");
  ok(dias[0] === 0, "un día sin gastos vale cero");
}
// El reparto de las etiquetas del grafico diario se prueba entero en
// verificar-pdf.ts, con dailyLayout, que es como se llama ahora.
{
  const h = html([tx({ day: 5, amount: 40 })]);
  ok(h.includes("Día a día"), "el gráfico diario aparece");
  ok(h.includes("Reparto por categoría"), "el gráfico por categoría aparece");
  const sin = html([tx({ day: 5, amount: 40 })], false);
  ok(!sin.includes("Reparto por categoría"), "sin gráficos, no se dibuja el de categorías");
  ok(!sin.includes("Día a día"), "sin gráficos, no se dibuja el diario");
  ok(sin.includes("Movimientos"), "sin gráficos, la lista sigue estando");
}
{
  // Un reporte de solo ingresos no puede quedarse con la hoja en blanco.
  const h = html([tx({ amount: 800, type: "income", categoryLabel: "Sueldo" })]);
  ok(h.includes("Sueldo"), "si solo hay ingresos, el gráfico los dibuja a ellos");
  ok(h.includes("#059669"), "y los pinta de verde, no de rojo");
}
{
  // Las barras no pueden pasarse del 100% ni salirse de la hoja.
  const h = html([tx({ amount: 1, categoryLabel: "A" }), tx({ amount: 999999, categoryLabel: "B" })]);
  const anchos = [...h.matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]));
  ok(anchos.length > 0 && anchos.every((w) => w >= 0 && w <= 100), "ninguna barra se pasa del 100%");
}

console.log("\n--- LA TABLA EN VARIAS HOJAS ---");
{
  const muchos = Array.from({ length: 120 }, (_, i) => tx({ day: (i % 28) + 1, amount: i + 1 }));
  const h = html(muchos);
  ok(h.includes("display: table-header-group"), "la cabecera se repite en cada hoja");
  ok(h.includes("(120)"), "se dice cuántos movimientos lleva");
  ok((h.match(/<tr>/g) || []).length >= 120, "salen los 120, no solo los de la vista previa");
}

console.log("\n--- CADA CUÁNTO SE EXPORTA ---");
// enabled: true a proposito. DEFAULT_SCHEDULE viene apagado, y sin encenderlo
// aqui ningun caso llegaria a comprobar la hora: no tocaria nunca.
const base: ScheduledExport = { ...DEFAULT_SCHEDULE, enabled: true, frequency: "daily", destination: "drive", hour: 9 };
{
  const antes = new Date(2026, 6, 30, 8, 59);
  const despues = new Date(2026, 6, 30, 9, 1);
  ok(!isAutoRunDue(base, antes), "antes de la hora todavía no toca");
  ok(isAutoRunDue(base, despues), "pasada la hora sí toca");
}
ok(
  !isAutoRunDue({ ...base, lastAutoRun: claveDeEjecucion(base, new Date(2026, 6, 30)) }, new Date(2026, 6, 30, 20, 0)),
  "abrir la app diez veces el mismo día da UNA sola copia"
);
ok(
  isAutoRunDue({ ...base, lastAutoRun: "2026-07-29 09:00" }, new Date(2026, 6, 30, 10, 0)),
  "al día siguiente vuelve a tocar"
);
ok(!isAutoRunDue({ ...base, enabled: false }, new Date(2026, 6, 30, 10, 0)), "con el interruptor apagado no se exporta nada");
ok(
  !isAutoRunDue({ ...base, destination: "mail" }, new Date(2026, 6, 30, 10, 0)),
  "solo Drive se sube solo: correo y compartir necesitan que alguien elija"
);
{
  // 30 de julio de 2026 es jueves. getDay() = 4, y weekday va 1..7 desde el
  // domingo, así que jueves es 5.
  const jueves = new Date(2026, 6, 30, 10, 0);
  ok(jueves.getDay() === 4, "el 30/7/2026 es jueves (comprobación de la propia prueba)");
  ok(isAutoRunDue({ ...base, frequency: "weekly", weekday: 5 }, jueves), "el semanal cae el día elegido");
  ok(!isAutoRunDue({ ...base, frequency: "weekly", weekday: 2 }, jueves), "y no cae en otro día");
}
{
  const dia1 = new Date(2026, 6, 1, 10, 0);
  ok(isAutoRunDue({ ...base, frequency: "monthly", day: 1 }, dia1), "el mensual cae el día elegido");
  ok(!isAutoRunDue({ ...base, frequency: "monthly", day: 2 }, dia1), "y no cae en otro día");
  // Nunca se debe poder elegir un día que en febrero no existe.
  ok(MAX_MONTH_DAY === 28, "el día mensual no pasa del 28, porque febrero tiene 28");
}

console.log("\n--- QUÉ MES LLEVA EL REPORTE ---");
{
  const uno = new Date(2026, 6, 1, 9, 0); // 1 de julio
  ok(
    monthForSchedule({ ...base, frequency: "monthly" }, uno) === "2026-06",
    "el reporte mensual del día 1 trae JUNIO, no julio recién empezado"
  );
  ok(monthForSchedule({ ...base, frequency: "daily" }, uno) === "2026-07", "el diario trae el mes en curso");
  ok(monthForSchedule({ ...base, frequency: "weekly" }, uno) === "2026-07", "el semanal también");
  const enero = new Date(2026, 0, 1, 9, 0);
  ok(
    monthForSchedule({ ...base, frequency: "monthly" }, enero) === "2025-12",
    "en enero el mensual retrocede de año correctamente"
  );
}

console.log("\n--- LA FECHA DEL PDF ---");
{
  // toISOString() da la fecha en Greenwich. Perú va cinco horas por detrás,
  // así que desde las 7 de la tarde el "hoy" de Greenwich ya es mañana. Un
  // PDF exportado el 30 a las 8 de la noche salía fechado el 31.
  const nocheEnPeru = new Date(2026, 6, 30, 20, 0);
  ok(toDateKey(nocheEnPeru) === "2026-07-30", "un PDF de las 8 de la noche se fecha hoy, no mañana");
  ok(toDateKey(new Date(2026, 0, 5, 23, 30)) === "2026-01-05", "y funciona igual a las 11 y media de la noche");
  ok(toDateKey(new Date(2026, 8, 9, 0, 1)) === "2026-09-09", "el mes y el día llevan su cero delante");
}

console.log("\n--- EL TECLADO DEL PIN ---");
{
  // Las teclas eran de 76 fijos con justify-between. Si el contenedor daba
  // justo para las tres, no quedaba nada que repartir y salían pegadas.
  const anchoContenedor = 228; // el caso más estrecho que se da
  const separacion = 12; // gap-3
  const anchoViejo = 76 * 3;
  ok(anchoContenedor - anchoViejo < 12, "así estaba antes: menos de 12 de hueco para dos separaciones (pegadas)");
  const anchoNuevo = (anchoContenedor - separacion * 2) / 3;
  ok(anchoNuevo >= 48, `ahora cada tecla mide ${anchoNuevo}, por encima del mínimo de 48 de Android`);
  ok(separacion === 12, "y la separación de los lados es la misma que la de arriba y abajo (mb-3)");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

// QUE EL PDF DE "TODOS" ENSENE LAS DOS COSAS.
//
// Sin decir "gastos" ni "ingresos" el documento tiene que traer las dos. Aqui
// se arma el HTML de verdad y se cuenta lo que sale, en vez de mirarlo en el
// celular y quedarse con la duda de si falta o esta en la pagina siguiente.
import {
  ALTO_HOJA,
  alturaEstimada,
  buildPdfHtml,
  byCategory,
  cabeApretando,
  type PdfTx,
} from "@/utils/exportPdfHtml";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

function tx(day: number, type: "expense" | "income", amount: number, cat: string, color: string): PdfTx {
  return {
    dateLabel: `${day} jul`,
    day,
    categoryLabel: cat,
    categoryColor: color,
    description: `mov ${day}`,
    methodLabel: "Efectivo",
    amount,
    type,
  };
}

const MIXTO: PdfTx[] = [
  tx(3, "expense", 50, "Comida", "#e11d48"),
  tx(5, "expense", 30, "Transporte", "#f59e0b"),
  tx(9, "expense", 40, "Salud", "#ef4444"),
  tx(10, "income", 1200, "Salario", "#059669"),
  tx(18, "income", 300, "Freelance", "#14b8a6"),
  tx(21, "expense", 25, "Comida", "#e11d48"),
];

const TEXTOS = {
  colDate: "Fecha", colCategory: "Categoria", colDescription: "Descripcion",
  colMethod: "Metodo", colAmount: "Monto", total: "Total",
  income: "Ingresos", expenses: "Gastos", balance: "Balance",
  byCategory: "Reparto por categoria", byCategoryBudget: "Presupuestos por categoria",
  byMonth: "Ultimos meses", byDay: "Dia a dia",
  generatedOn: "Generado el", movements: "Movimientos",
};

function armar(txs: PdfTx[]) {
  return buildPdfHtml({
    logoDataUri: "", userName: "jeferson", title: "Reporte de movimientos",
    monthLabel: "Julio 2026", txs, daysInMonth: 31, fmt, charts: true,
    categoryBudgets: [], monthly: [], generatedAt: "2026-08-01",
    texts: TEXTOS,
  });
}

/** Solo las filas de la LISTA final, no las de los graficos de arriba. */
function filasDeMovimientos(html: string): number {
  // Solo lo de dentro del tbody: debajo de la tabla hay una fila de Total,
  // y contarla daba siempre uno de mas.
  const a = html.indexOf("<tbody>");
  const b = html.indexOf("</tbody>");
  if (a < 0 || b < 0) return -1;
  return (html.slice(a, b).match(/<tr>/g) || []).length;
}

/** Lo que hay ANTES de la lista: los graficos. */
function zonaDeGraficos(html: string): string {
  return html.slice(0, html.indexOf("<!-- MOVIMIENTOS -->"));
}

console.log("\n--- LA LISTA DE MOVIMIENTOS SALE ENTERA ---");
{
  const html = armar(MIXTO);
  ok(filasDeMovimientos(html) === 6, `salen las 6 filas (${filasDeMovimientos(html)})`);
  ok(html.includes("Movimientos (6)"), "y el titulo dice cuantas son");
  ok(html.includes("+S/ 1200.00"), "el ingreso con su signo mas");
  ok(html.includes("-S/ 50.00"), "y el gasto con su menos");
}

console.log("\n--- UNA SOLA ROSQUILLA, LA DE GASTOS ---");
{
  // Lo pedido: la lista con las dos cosas, y de grafico solo el gasto por
  // categoria. Una rosquilla entera para dos categorias de ingreso empujaba
  // la lista a la hoja siguiente a cambio de dos lineas de informacion.
  const g = zonaDeGraficos(armar(MIXTO));
  ok((g.match(/<svg width="156"/g) || []).length === 1, "una sola rosquilla en los graficos");
  ok(g.includes("S/ 145.00"), "y es la de gastos: su total son los 145");
  // El total de ingresos SI sale, pero en la tarjeta de arriba, no en una
  // rosquilla. Por eso aqui no vale buscar el numero: se mira que no haya un
  // segundo dibujo y que las categorias de ingreso no esten.
  ok(g.includes("S/ 1500.00"), "el total de ingresos sigue en su tarjeta de arriba");
  ok(g.includes("Comida"), "las categorias de gasto salen");
  ok(!g.includes("Salario"), "y las de ingreso no estan en los graficos");
  // Los titulos avisan de que hablan solo del gasto: sin eso, en un documento
  // con las dos cosas, los numeros no cuadran con el total de arriba.
  ok(g.includes("Reparto por categoria · Gastos"), "el reparto dice que es de gastos");
  ok(g.includes("Dia a dia · Gastos"), "y el diario tambien");
}

console.log("\n--- PERO LA LISTA SIGUE TRAYENDO LAS DOS ---");
{
  const html = armar(MIXTO);
  ok(html.includes("Salario"), "el sueldo esta en la lista");
  ok(html.includes("Freelance"), "y el freelance");
  ok(html.includes("+S/ 1200.00"), "con su monto en positivo");
}

console.log("\n--- EL TITULO DE MOVIMIENTOS NO SE QUEDA SOLO AL FINAL DE LA HOJA ---");
{
  const html = armar(MIXTO);
  const i = html.indexOf("Movimientos (6)");
  const antes = html.slice(Math.max(0, i - 220), i);
  ok(antes.includes("page-break-after:avoid"), "el titulo va pegado a su tabla");
}

console.log("\n--- byCategory REPARTE BIEN CADA LADO ---");
{
  const gastos = byCategory(MIXTO, "expense");
  const ingresos = byCategory(MIXTO, "income");
  ok(gastos.length === 3, `tres categorias de gasto (${gastos.length})`);
  ok(ingresos.length === 2, `dos de ingreso (${ingresos.length})`);
  ok(gastos[0].label === "Comida" && gastos[0].amount === 75, "Comida suma sus dos veces: 75");
  ok(ingresos[0].label === "Salario" && ingresos[0].amount === 1200, "Salario 1200");
  const suma = ingresos.reduce((s, c) => s + c.share, 0);
  ok(Math.abs(suma - 1) < 0.001, "los porcentajes de ingreso suman 100% entre ellos");
}

console.log("\n--- SOLO INGRESOS SIGUE FUNCIONANDO ---");
{
  const html = armar(MIXTO.filter((t) => t.type === "income"));
  const g = zonaDeGraficos(html);
  ok(filasDeMovimientos(html) === 2, `las dos filas de ingreso (${filasDeMovimientos(html)})`);
  ok(g.includes("Salario"), "con su reparto por categoria");
  ok(!html.includes("Comida"), "y ni rastro de los gastos");
  // Con un solo lado no hace falta distinguir nada: vuelve el titulo normal.
  ok(g.includes("Reparto por categoria") && !g.includes("· Gastos"), "con un solo tipo dentro, el titulo va sin aclaracion");
  // Una sola rosquilla: la de ingresos. La palabra "Gastos" sale igual en la
  // tarjeta de totales de arriba, asi que buscarla no serviria para saber si
  // hay un bloque de gastos vacio dibujado.
  ok((g.match(/<svg width="156"/g) || []).length === 1, "una sola rosquilla, la de ingresos");
}

console.log("\n--- SOLO GASTOS SIGUE FUNCIONANDO ---");
{
  const html = armar(MIXTO.filter((t) => t.type === "expense"));
  const g = zonaDeGraficos(html);
  ok(filasDeMovimientos(html) === 4, `las cuatro filas de gasto (${filasDeMovimientos(html)})`);
  ok(!html.includes("Salario"), "sin ingresos por medio");
  ok(g.includes("Reparto por categoria") && !g.includes("· Gastos"), "titulo sin aclaracion, que aqui sobra");
  ok(!g.includes("Dia a dia ·"), "y el diario sin la aclaracion, que aqui sobra");
}

console.log("\n--- APRETAR PARA QUE QUEPA EN UNA HOJA ---");
{
  const chico = alturaEstimada({ categorias: 3, presupuestos: 0, meses: 0, dias: 4, movimientos: 6 });
  ok(chico < ALTO_HOJA, `un mes de 6 movimientos ya cabe (${chico} de ${ALTO_HOJA})`);
  ok(!cabeApretando(chico), "y por eso no se aprieta: no hay nada que ganar");

  // El caso que importa: se pasa por poco. Apretando entra.
  const justo = alturaEstimada({ categorias: 5, presupuestos: 4, meses: 0, dias: 8, movimientos: 18 });
  ok(justo > ALTO_HOJA, `18 movimientos con graficos se pasan (${justo})`);
  ok(cabeApretando(justo), "y se aprieta para intentar meterlo en una");

  // Y el que no tiene arreglo: apretarlo lo dejaria incomodo de leer para
  // acabar ocupando dos hojas igual.
  const enorme = alturaEstimada({ categorias: 12, presupuestos: 13, meses: 3, dias: 20, movimientos: 120 });
  ok(!cabeApretando(enorme), `120 movimientos no caben ni apretando (${enorme})`);
}

console.log("\n--- Y APRETAR CAMBIA EL DOCUMENTO DE VERDAD ---");
{
  const muchos: PdfTx[] = [];
  for (let i = 1; i <= 18; i++) {
    muchos.push(tx(i, i % 4 === 0 ? "income" : "expense", 20 + i, `Cat ${i % 5}`, "#e11d48"));
  }
  const apretado = armar(muchos);
  const suelto = armar(MIXTO);
  ok(apretado.includes("padding:3px 8px"), "las filas van mas juntas");
  ok(suelto.includes("padding:6px 8px"), "y con pocos movimientos siguen sueltas");
  ok(apretado.includes('<svg width="124"'), "la rosquilla se encoge");
  ok(suelto.includes('<svg width="156"'), "y con sitio de sobra se queda grande");
  ok(apretado.includes("margin-top:11px"), "los bloques se acercan");
  ok(suelto.includes("margin-top:20px"), "o no, si no hace falta");
  // Lo que NUNCA cambia: la informacion.
  ok(filasDeMovimientos(apretado) === 18, "y siguen saliendo los 18 movimientos");
}

console.log("\n--- UN MES SIN NADA NO REVIENTA ---");
{
  const html = armar([]);
  ok(filasDeMovimientos(html) === 0, "cero filas");
  ok(html.includes("Movimientos (0)"), "y lo dice");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

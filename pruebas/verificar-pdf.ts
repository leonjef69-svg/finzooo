// Comprueba el documento que se exporta: los graficos nuevos y la rosquilla.
import {
  ANCHO_MAX_BARRA,
  buildPdfHtml,
  dailyLayout,
  donutSlice,
  esc,
  textWidthPdf,
  type PdfCategoryBudget,
  type PdfMonth,
  type PdfTx,
} from "@/utils/exportPdfHtml";

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
  colDate: "Fecha", colCategory: "Categoría", colDescription: "Descripción",
  colMethod: "Método", colAmount: "Monto", total: "Total", income: "Ingresos",
  expenses: "Gastos", balance: "Balance", byCategory: "Reparto por categoría",
  byCategoryBudget: "Presupuestos por categoría", byMonth: "Gasto por mes",
  byDay: "Día a día", generatedOn: "Generado el", movements: "Movimientos",
};

function html(
  txs: PdfTx[],
  charts = true,
  categoryBudgets: PdfCategoryBudget[] = [],
  monthly: PdfMonth[] = []
) {
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
    categoryBudgets,
    monthly,
    generatedAt: "31 de julio",
  });
}

console.log("\n--- LA ROSQUILLA ---");
{
  // Media vuelta desde arriba: empieza en las 12 y acaba en las 6.
  const d = donutSlice(0, 0.5, 78, 78, 66, 44);
  ok(d.startsWith("M78.00,12.00"), `arranca ARRIBA del todo, no a las tres: ${d.slice(0, 14)}`);
  ok(d.includes("A66,66"), "traza el arco de fuera con el radio grande");
  ok(d.includes("A44,44"), "y el de dentro con el pequeño, que es lo que le da el agujero");
  ok(d.trim().endsWith("Z"), "y se cierra");
}
{
  // El indicador de "arco grande" es el error clásico: sin él, cualquier
  // trozo de más de media vuelta se dibuja por el lado corto y sale al revés.
  ok(donutSlice(0, 0.6, 78, 78, 66, 44).includes(" 1 1 "), "un trozo de más de media vuelta se marca como arco grande");
  ok(donutSlice(0, 0.4, 78, 78, 66, 44).includes(" 0 1 "), "y uno de menos, no");
}
{
  // Ningun punto puede salirse del recuadro de 156x156.
  for (const [a, b] of [[0, 0.25], [0.25, 0.5], [0.5, 0.9], [0.9, 1]]) {
    const nums = [...donutSlice(a, b, 78, 78, 66, 44).matchAll(/(-?\d+\.\d+),(-?\d+\.\d+)/g)];
    for (const m of nums) {
      const x = Number(m[1]), y = Number(m[2]);
      if (x < 0 || x > 156 || y < 0 || y > 156) { ok(false, `punto fuera del dibujo: ${x},${y}`); }
    }
  }
  ok(true, "ningún trozo se sale del dibujo, en las cuatro vueltas");
}

console.log("\n--- LOS GRAFICOS DE REPORTES EN EL PDF ---");
{
  const limites: PdfCategoryBudget[] = [
    { name: "Comida", color: "#f97316", limit: 100, spent: 99 },
    { name: "Transporte", color: "#3b82f6", limit: 50, spent: 70 },
  ];
  const meses: PdfMonth[] = [
    { label: "May", value: 70 },
    { label: "Jun", value: 299 },
  ];
  const h = html([tx({ amount: 99 }), tx({ amount: 70, categoryLabel: "Transporte" })], true, limites, meses);

  ok(h.includes("Reparto por categoría"), "sale el reparto por categoría");
  ok(h.includes("<svg"), "y con su rosquilla dibujada, no como imagen");
  ok(h.includes("Presupuestos por categoría"), "salen los presupuestos por categoría");
  ok(h.includes("S/ 99.00 / S/ 100.00"), "con lo gastado y el límite de cada uno");
  ok(h.includes("Gasto por mes"), "sale el gasto por mes");
  ok(h.includes("May") && h.includes("Jun"), "con sus meses");
  ok(h.includes("Día a día"), "y el gasto diario");
  // Lo que NO tiene que salir, que fue la peticion expresa.
  ok(!h.includes("Finzo IA"), "NO sale Finzo IA");
  ok(!h.includes("Presupuesto utilizado"), "NI la barra de presupuesto utilizado");
}
{
  // Pasarse del limite se pinta en rojo, que es el dato que se busca ahi.
  const limites: PdfCategoryBudget[] = [{ name: "Transporte", color: "#3b82f6", limit: 50, spent: 70 }];
  const h = html([tx({ amount: 70 })], true, limites, []);
  const fila = h.slice(h.indexOf("Transporte"), h.indexOf("Transporte") + 400);
  ok(fila.includes("#e11d48"), "una categoría pasada de su límite sale en rojo");
  ok(!fila.includes("width:140.0%"), "y la barra no se sale del riel");
}
{
  // Con un solo mes no hay comparacion que hacer: no se dibuja.
  const h = html([tx({})], true, [], [{ label: "Jul", value: 60 }]);
  ok(!h.includes("Gasto por mes"), "con un solo mes no se dibuja el gráfico de meses");
}
{
  // Sin limites puestos, ese bloque no aparece en vez de salir vacio.
  const h = html([tx({})], true, [], []);
  ok(!h.includes("Presupuestos por categoría"), "sin límites puestos, ese bloque no aparece");
}

console.log("\n--- SIN GRAFICOS SE VA TODO ---");
{
  const limites: PdfCategoryBudget[] = [{ name: "Comida", color: "#f97316", limit: 100, spent: 99 }];
  const meses: PdfMonth[] = [{ label: "May", value: 70 }, { label: "Jun", value: 299 }];
  const h = html([tx({})], false, limites, meses);
  ok(!h.includes("Reparto por categoría"), "sin gráficos no hay reparto");
  ok(!h.includes("Presupuestos por categoría"), "ni presupuestos");
  ok(!h.includes("Gasto por mes"), "ni meses");
  ok(!h.includes("Día a día"), "ni diario");
  ok(h.includes("Movimientos"), "pero la lista de movimientos se queda");
  ok(h.includes("Total"), "y el total también");
}

console.log("\n--- LA VISTA PREVIA ES EL MISMO DOCUMENTO ---");
{
  // La pantalla llama a construirHtml() para las dos cosas. Aqui se comprueba
  // lo que eso garantiza: mismas entradas, mismo texto, byte a byte.
  const a = html([tx({ amount: 33 })], true, [], []);
  const b = html([tx({ amount: 33 })], true, [], []);
  ok(a === b, "el mismo contenido da exactamente el mismo documento");
}

console.log("\n--- SIGUE ESCAPANDO LO QUE SE ESCRIBE ---");
{
  const h = html([tx({ description: "arroz <5kg> & pan" })], true, [], []);
  ok(!h.includes("<5kg>"), "una descripción con < no entra cruda");
  ok(esc("a<b") === "a&lt;b", "el escapado sigue en pie");
}

console.log("\n--- EL MONTO SOBRE CADA BARRA DEL GASTO DIARIO ---");
{
  // Era la petición: el monto no salía. Y no salía porque se dibujaban los 31
  // días del mes, y en 17 puntos de columna no cabe un "S/ 1234.56".
  const h = html([tx({ day: 3, amount: 10 }), tx({ day: 31, amount: 1234.56 })]);
  ok(h.includes("S/ 10.00"), "sale el monto del día 3");
  ok(h.includes("S/ 1234.56"), "y el del día 31, entero y sin recortar");
  ok(h.includes(">3</text>") && h.includes(">31</text>"), "y debajo el número de cada día");
}
{
  // Los días sin gasto ya no ocupan columna: es lo que hace que quepa el
  // monto. Con dos días de gasto se dibujan dos columnas, no treinta y una.
  const h = html([tx({ day: 3, amount: 10 }), tx({ day: 31, amount: 20 })]);
  const barras = (h.match(/<rect [^>]*rx="2"/g) || []).length;
  ok(barras === 2, `se dibujan 2 barras y no 31 (salieron ${barras})`);
}
{
  // Con pocos días los montos van tumbados; con muchos, de pie. Girarlos es
  // preferible a no enseñarlos: el monto es el dato que se busca aquí.
  const pocos = dailyLayout(3, ["S/ 10.00", "S/ 1234.56", "S/ 5.00"]);
  ok(!pocos.girar, `con 3 días los montos van tumbados (columna de ${pocos.colW.toFixed(0)})`);
  const muchos = dailyLayout(28, new Array(28).fill("S/ 1234.56"));
  ok(muchos.girar, `con 28 días se ponen de pie (columna de ${muchos.colW.toFixed(0)})`);
}
{
  // Ningún monto puede invadir la columna de al lado. Es el mismo error que
  // ya ocurrió una vez en la app, así que se calcula.
  let bien = true;
  for (const n of [1, 2, 5, 10, 20, 31]) {
    const L = dailyLayout(n, new Array(n).fill("S/ 1234.56"));
    if (!L.girar && textWidthPdf("S/ 1234.56", 7) > L.colW) bien = false;
    if (L.barW > L.colW) bien = false;
  }
  ok(bien, "con 1, 2, 5, 10, 20 y 31 días nada invade la columna de al lado");
}
{
  const L = dailyLayout(2, ["S/ 5.00", "S/ 9.00"]);
  ok(L.barW <= ANCHO_MAX_BARRA, `con dos días la barra no se hace gigante (${L.barW})`);
  ok(L.barW >= 4, "y nunca desaparece");
}

console.log("\n--- LAS COLUMNAS POR MES TAMPOCO SE HACEN GIGANTES ---");
{
  // EL FALLO, reportado con captura el 07/08/2026: *"las barras tienen un tamaño
  // desproporcional, deberían tener un tamaño normal"*. Con dos meses, cada
  // columna se quedaba con MEDIA HOJA de ancho — dos bloques en vez de dos
  // columnas.
  //
  // Y lo que hay que proteger no es el número: es que los DOS gráficos de columnas
  // usen el MISMO tope. El de día a día ya lo tenía, con su comentario y todo, y
  // el mensual no. La misma lección aprendida en un gráfico y sin aplicar en el de
  // al lado es el fallo que este proyecto repite.
  const dosMeses = html([tx({})], true, [], [
    { label: "Jul", value: 10 },
    { label: "Ago", value: 50 },
  ]);

  // Cada columna tiene que llevar su tope de ancho, y centrada: sin el centrado,
  // el tope la deja pegada a la izquierda de su casilla y se ve torcida.
  const conTope = (dosMeses.match(new RegExp(`max-width:${ANCHO_MAX_BARRA}px;margin:0 auto`, "g")) ?? []).length;
  ok(conTope === 2, `las dos columnas del mes llevan tope y van centradas (${conTope})`);

  // Y ninguna barra del gráfico por mes puede quedarse sin tope. Se busca el
  // patrón contrario: un alto puesto sin ancho máximo delante.
  const sinTope = /<div style="background:#059669;height:\d+px/.test(dosMeses);
  ok(!sinTope, "y no queda ninguna sin él");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

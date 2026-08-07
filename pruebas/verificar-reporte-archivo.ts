// ARMAR EL ARCHIVO DEL REPORTE
//
// Esta lógica estaba DENTRO de la pantalla de exportar, y por eso no se podía
// comprobar ni reutilizar. Se sacó a utils/reporteArchivo.ts el 05/08/2026 para
// que el reporte pueda generarse a la hora fijada con la app cerrada, donde no
// hay pantalla ninguna.
//
// Lo que se comprueba aquí es lo que se rompe en silencio: un signo al revés
// convierte un gasto en ingreso, un monto como texto deja el Excel sin poder
// sumar, y una coma sin escapar parte una fila en dos y enseña movimientos que
// no existen.
import { csvDeFilas, csvEscape, filasDelReporte } from "@/utils/reporteArchivo";
import { htmlDelReporte } from "@/utils/reportePdfDatos";
import { setPropias } from "@/utils/categoriasPropias";
import type { Transaction } from "@/types";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

// El traductor de las pruebas devuelve la clave: así se ve de dónde sale cada
// texto sin depender de un idioma.
const t = (clave: string) => clave;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const gasto: Transaction = {
  id: 1,
  type: "expense",
  amount: 12.5,
  category: "comida",
  description: "Almuerzo",
  date: "2026-08-05",
  method: "cash",
  notes: "",
};
const ingreso: Transaction = {
  id: 2,
  type: "income",
  amount: 100,
  category: "salario",
  description: "",
  date: "2026-08-01",
  method: "cash",
  notes: "",
};

console.log("\n--- LAS FILAS DEL REPORTE ---");
{
  setPropias([]);
  const filas = filasDelReporte({
    movimientos: [gasto, ingreso],
    total: 87.5,
    nombresDeMes: MESES,
    t,
  });

  ok(filas.length === 5, `cabecera, dos movimientos, una vacía y el total (${filas.length})`);
  ok(filas[0][0] === "exportPdf.colDate", "la primera fila es la cabecera");
  ok(filas[0].length === 5, "con cinco columnas");
  ok(filas[3].length === 0, "hay una fila vacía antes del total, para que se lea separado");
  ok(filas[4][0] === "exportPdf.total", "y la última es el total");
  ok(filas[4][4] === 87.5, "con el total que se le pasó");
}

console.log("\n--- LOS MONTOS: SIGNO Y TIPO ---");
{
  const filas = filasDelReporte({ movimientos: [gasto, ingreso], total: 87.5, nombresDeMes: MESES, t });
  // El signo es lo que distingue un gasto de un ingreso en la hoja. Al revés,
  // el reporte dice lo contrario de lo que pasó.
  ok(filas[1][4] === -12.5, `un gasto va en negativo (${filas[1][4]})`);
  ok(filas[2][4] === 100, `un ingreso va en positivo (${filas[2][4]})`);
  // Y como NÚMERO, no como texto: es lo que permite sumar y ordenar en Excel
  // sin tocar nada. Con texto, Excel enseña un triangulito y no suma.
  ok(typeof filas[1][4] === "number", "y como número, no como texto");
  ok(typeof filas[4][4] === "number", "el total también");
}

console.log("\n--- UNA DESCRIPCIÓN VACÍA NO ROMPE LA FILA ---");
{
  const filas = filasDelReporte({ movimientos: [ingreso], total: 100, nombresDeMes: MESES, t });
  ok(filas[1][2] === "", "sin descripción queda la celda vacía, no 'undefined'");
  ok(filas[1].length === 5, "y la fila sigue teniendo sus cinco columnas");
}

console.log("\n--- EL CSV: DECIMALES Y ESCAPADO ---");
{
  // Dos decimales siempre. En un CSV se espera "12.50"; "12.5" es lo que sale
  // sin pensarlo, y descuadra la columna al abrirlo.
  const texto = csvDeFilas([["a", 12.5], ["b", 100], ["c", -3]]);
  ok(texto.includes("a,12.50"), `12.5 se escribe 12.50 (${texto.split("\n")[0]})`);
  ok(texto.includes("b,100.00"), "y 100 se escribe 100.00");
  ok(texto.includes("c,-3.00"), "y el negativo mantiene el signo");
}
{
  // Aquí está el fallo que parte un reporte: una coma dentro de la descripción.
  ok(csvEscape("Pan, leche") === '"Pan, leche"', "una coma se protege con comillas");
  ok(csvEscape('Dijo "hola"') === '"Dijo ""hola"""', "y las comillas se doblan");
  ok(csvEscape("linea1\nlinea2") === '"linea1\nlinea2"', "un salto de línea también");
  ok(csvEscape("Almuerzo") === "Almuerzo", "y lo normal se deja tal cual, sin comillas de adorno");

  const texto = csvDeFilas([["Pan, leche", 5]]);
  ok(texto === '"Pan, leche",5.00', `la fila entera queda entera (${texto})`);
  ok(texto.split("\n").length === 1, "y sigue siendo UNA fila, no dos");
}
{
  // La fila vacía del medio tiene que salir como una línea vacía, no como
  // comas sueltas: si trae comas, Excel la lee como un movimiento sin datos.
  const texto = csvDeFilas([["a"], [], ["b"]]);
  ok(texto === "a\n\nb", `la fila vacía es una línea vacía (${JSON.stringify(texto)})`);
}

console.log("\n--- EN EL PDF, SOLO LOS LIMITES CON GASTO ---");
{
  // EL FALLO, con captura del PDF el 07/08/2026: trece filas seguidas diciendo
  // "€ 0.00 / € 50.00" y ni una con nada dentro. "Si no hay movimiento, quitalo;
  // solo debe aparecer cuando haya algun movimiento". Es media hoja que no
  // contesta nada y que empuja los graficos y los movimientos hacia abajo.
  //
  // Y ES LA MISMA REGLA QUE YA SEGUIA LA PANTALLA DE REPORTES: alli solo se
  // dibujan los limites con gasto. El PDF y la pantalla ensenaban cosas distintas
  // del mismo mes. Otra vez una decision tomada en un sitio y sin aplicar en el de
  // al lado.
  const comun = {
    todos: [gasto],
    mes: "2026-08",
    tipo: "all" as const,
    charts: true,
    userName: "Diana",
    nombresDeMes: MESES,
    fmt: (n: number) => `S/ ${n.toFixed(2)}`,
    titulo: "Reporte",
    etiquetaDelMes: "Agosto 2026",
    t,
  };

  // Con limites en trece categorias y gasto SOLO en comida, tiene que salir una
  // fila: la de comida.
  const trece: Record<string, number> = {};
  for (const id of ["comida", "transporte", "compras", "salud", "hogar", "otros"]) trece[id] = 50;
  const conUno = htmlDelReporte({ ...comun, movimientos: [gasto], presupuestos: trece });
  ok(conUno.includes("category.comida"), "sale la categoria en la que se gasto");
  ok(!conUno.includes("category.transporte"), "y no las que quedaron en cero");
  ok(!conUno.includes("category.hogar"), "ninguna de ellas");

  // Y si NINGUNA tuvo gasto, el bloque entero no aparece: un titulo solo, sin
  // filas debajo, es peor que no ponerlo.
  const soloOtras: Record<string, number> = { transporte: 50, hogar: 50 };
  const sinNinguna = htmlDelReporte({ ...comun, movimientos: [gasto], presupuestos: soloOtras });
  ok(
    !sinNinguna.includes("exportPdf.byCategoryBudget"),
    "sin ningun limite gastado, el bloque no se dibuja"
  );
  // El resto del reporte sigue estando: quitar ese bloque no puede llevarse por
  // delante los movimientos.
  ok(sinNinguna.includes("Almuerzo"), "y el resto del reporte sigue ahi");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

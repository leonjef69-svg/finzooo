// LAS FILAS SIN FECHA SE TIRABAN TODAS (12/08/2026)
//
// Salio de su hoja de control de gastos. La abrio con Fino y no entro ni un movimiento: ninguna
// fila tenia fecha escrita. Y su pregunta fue la correcta:
//
//     "¿QUE LOGICA APLICARIA SI NO TIENE FECHA? ¿ADEMAS SI NO DIJERA FECHA SOLO DIA?"
//
// Un estado de cuenta de banco SIEMPRE trae la fecha en cada linea, y el motor estaba escrito
// mirando solo eso. Una hoja llenada a mano no funciona asi: la fecha se escribe UNA vez y
// debajo van los gastos de ese dia, o esta en la cabecera del archivo ("MES: Enero") y en la
// columna va solo el numero del dia. Las dos son formas normales de escribir; la app las
// trataba a todas como "fila mala" y las tiraba en silencio.
//
// Tres caminos, en este orden: la fecha escrita, el dia suelto con el mes del archivo, y la
// heredada de la fila de arriba.
//
// LO QUE MAS IMPORTA DE AQUI SON LOS LIMITES, no los aciertos. Adivinar una fecha de mas mete
// movimientos en un mes que no es, o cuela el pie de la tabla como si fuera un gasto — y eso
// descuadra los totales sin que se vea. Que una fila no entre se nota; que entre mal, no.
import fs from "fs";
import { fechaDeDiaSuelto, mesDeclaradoEn, parseStatement } from "@/utils/importEngine";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const HOY = new Date().getFullYear();

console.log("\n--- EL MES QUE DECLARA EL ARCHIVO ---");
{
  ok(mesDeclaradoEn(["MES:,Enero,,Presupuesto (S/):,1000"])?.mes === 1, "lo lee de 'MES: Enero'");
  const conAnio = mesDeclaradoEn(["CONTROL MENSUAL 2026", "MES:,Marzo"]);
  ok(conAnio?.mes === 3 && conAnio?.anio === 2026, "y el año, si el archivo lo dice");
  ok(mesDeclaradoEn(["MES:,Julio"])?.anio === HOY, "sin año escrito, es el de hoy");
  ok(mesDeclaradoEn(["Movimientos", "Cuenta 123"]) === null, "y si no dice ningun mes, no se inventa");

  // NO VALE UN MES DENTRO DE OTRA PALABRA. "Marzo" esta dentro de nada, pero "enero" si aparece
  // dentro de textos, y un falso positivo aqui pondria TODO el archivo en un mes equivocado.
  ok(mesDeclaradoEn(["generosidad", "veneros"]) === null, "un mes dentro de otra palabra no cuenta");
}

console.log("\n--- EL DIA SUELTO ---");
{
  const enero = { anio: 2026, mes: 1 };
  ok(fechaDeDiaSuelto("5", enero) === "2026-01-05", "'5' con enero 2026 es el 5 de enero");
  ok(fechaDeDiaSuelto(" 28 ", enero) === "2026-01-28", "con espacios alrededor tambien");

  // SIN MES DECLARADO NO SE INVENTA NADA. Un numero suelto puede ser cualquier cosa: una cuota,
  // un codigo, un numero de operacion. Ponerle un mes a dedo meteria movimientos en un mes
  // equivocado sin que nadie lo note.
  ok(fechaDeDiaSuelto("5", null) === null, "sin mes declarado, un numero suelto no es una fecha");

  ok(fechaDeDiaSuelto("31", { anio: 2026, mes: 2 }) === null, "el 31 de febrero no existe");
  ok(fechaDeDiaSuelto("0", enero) === null, "ni el dia cero");
  ok(fechaDeDiaSuelto("125", enero) === null, "ni un numero de tres cifras");
  ok(fechaDeDiaSuelto("5 de enero", enero) === null, "y solo si la celda trae SOLO el numero");
}

console.log("\n--- LA FECHA HEREDADA DE LA FILA DE ARRIBA ---");
{
  // Asi se llena una hoja de verdad: la fecha una vez, y debajo los gastos de ese dia.
  const archivo = [
    "Fecha,Monto,Descripcion",
    "05/01/2026,100,Mercado",
    ",50,Pan",
    ",30,Taxi",
    "06/01/2026,80,Almuerzo",
    ",20,Gaseosa",
  ].join("\n");
  const r = parseStatement(archivo);
  ok(r.ok && r.rows.length === 5, "entran las cinco, no solo las dos con fecha escrita");
  if (r.ok) {
    ok(r.rows[1].date === "2026-01-05" && r.rows[2].date === "2026-01-05", "las de debajo toman el 5");
    ok(r.rows[4].date === "2026-01-06", "y al cambiar la fecha, las siguientes toman la nueva");
  }
}

console.log("\n--- Y LO QUE NO PUEDE COLARSE ---");
{
  // EL PIE DE LA TABLA NO ES UN GASTO. Si se heredara la fecha a cualquier fila, la suma del mes
  // entraria como un movimiento mas y los totales quedarian al doble. Por eso solo hereda la
  // celda VACIA: una celda con algo que no se entiende casi nunca es un movimiento.
  const conTotal = [
    "Fecha,Monto,Descripcion",
    "05/01/2026,100,Mercado",
    "TOTAL,100,Suma del mes",
  ].join("\n");
  const r = parseStatement(conTotal);
  ok(r.ok && r.rows.length === 1, "una fila que dice TOTAL no hereda la fecha de arriba");

  // Y SIN NINGUNA FECHA EN TODO EL ARCHIVO, no entra nada. No hay de donde sacarla, y meterlas
  // todas en el dia de hoy seria inventarse el historial de alguien.
  const sinNada = [
    "Fecha,Monto,Descripcion",
    ",100,Mercado",
    ",50,Pan",
  ].join("\n");
  const r2 = parseStatement(sinNada);
  ok(r2.ok && r2.rows.length === 0, "sin ninguna fecha en el archivo, no se inventa ninguna");

  // PERO SE DICE CUANTAS FUERON, y aparte de las demas. Son movimientos de verdad que se estan
  // perdiendo y hay algo que hacer: escribir la fecha en la hoja. Una fila sin monto, en cambio,
  // es un hueco y no hay nada que hacer. Contarlas juntas no deja actuar sobre ninguna.
  ok(r2.ok && r2.sinFecha === 2, "y se cuentan aparte las que solo les faltaba la fecha");
}

console.log("\n--- LA HOJA CON EL MES ARRIBA Y EL DIA EN LA COLUMNA ---");
{
  // La forma de su hoja, pero llenada: el mes en la cabecera del archivo y la columna "Dia".
  const archivo = [
    "CONTROL DE GASTOS MENSUAL 2026",
    "MES:,Enero",
    "",
    "Dia,Monto,Tipo de gasto",
    "5,100,Alimentacion",
    "7,50,Transporte",
  ].join("\n");
  const r = parseStatement(archivo);
  ok(r.ok && r.rows.length === 2, "entran los dos movimientos");
  if (r.ok && r.rows.length === 2) {
    ok(r.rows[0].date === "2026-01-05", "el 5 es el 5 de enero de 2026");
    ok(r.rows[1].date === "2026-01-07", "y el 7, el 7 de enero");
  }
}

console.log("\n--- LAS QUE NO TIENEN FECHA SE GUARDAN PARA PREGUNTAR (13/08/2026) ---");
{
  // Pedido suyo. Con su hoja de control no entraba NADA: los montos y las categorias estaban
  // escritos, y el mes solo lo sabe quien la lleno. Tirarlas era perder movimientos de verdad;
  // ponerles la fecha de hoy seria meter gastos viejos en el mes actual y descuadrarle el
  // presupuesto sin que se note. Lo unico honesto es preguntar, y para preguntar hay que
  // conservarlas.
  const archivo = [
    "Fecha,Monto,Tipo de gasto,Descripcion",
    ",100,Alimentacion,Mercado",
    ",50,Transporte,Taxi",
  ].join("\n");
  const r = parseStatement(archivo);
  ok(r.ok && r.rows.length === 0, "no entran solas");
  ok(r.ok && r.rowsSinFecha.length === 2, "pero se guardan las dos para preguntar");
  if (r.ok && r.rowsSinFecha.length === 2) {
    // ENTERAS MENOS LA FECHA. Si se perdiera el monto o la categoria al guardarlas, elegir el
    // mes despues no serviria de nada: entrarian vacias.
    ok(r.rowsSinFecha[0].amount === 100, "con su monto");
    ok(r.rowsSinFecha[0].categoryRaw === "Alimentacion", "y con su categoria");
    ok(r.rowsSinFecha[0].date === "", "y sin fecha, que es lo unico que falta");
  }

  // Y NO SE GUARDAN LAS QUE NO SON MOVIMIENTOS. Una fila sin monto es un hueco de la hoja o el
  // pie de la tabla: preguntar por ella seria pedirle a alguien que ordene basura.
  const conHuecos = ["Fecha,Monto,Descripcion", ",,", ",100,Mercado"].join("\n");
  const r2 = parseStatement(conHuecos);
  ok(r2.ok && r2.rowsSinFecha.length === 1, "las filas vacias no se guardan para preguntar");
}

console.log("\n--- Y LA PANTALLA PREGUNTA EN VEZ DE CERRARSE ---");
{
  // ESTO ERA UN CIERRE EN SECO. Bastaba con que ninguna fila trajera fecha para dar el archivo
  // por vacio, soltar "el archivo esta vacio" y cerrar la pantalla — con su hoja, donde los
  // montos y las categorias SI estaban escritos. El mensaje ademas era falso: el archivo tenia
  // datos de sobra.
  const pantalla = fs
    .readFileSync("screens/ImportSheet.tsx", "utf8")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

  ok(
    /parsed\.rows\.length === 0 && parsed\.rowsSinFecha\.length === 0/.test(pantalla),
    "solo se cierra si no hay NADA, ni siquiera filas sin fecha"
  );
  ok(/setRowsSinFecha\(parsed\.rowsSinFecha\)/.test(pantalla), "las filas sin fecha llegan a la pantalla");
  ok(/setEligiendoMes\(true\)/.test(pantalla), "y el aviso abre el cartel para elegir el mes");
  ok(/String\(mes\)\.padStart\(2, "0"\)\}-01/.test(pantalla), "que las mete con el dia 1 del mes elegido");

  // UN MOVIMIENTO TUYO NO PUEDE EMPAREJARSE DOS VECES. Las filas con fecha y las que reciben el
  // mes a mano se construyen en dos tandas: si cada una empezara con la lista de emparejados en
  // blanco, el mismo movimiento saldria marcado como repetido en las dos.
  ok(/yaEmparejados/.test(pantalla), "los emparejamientos se comparten entre las dos tandas");

  // EL DIA 1 SE AVISA ANTES. Es una decision de la app sobre los datos de alguien: se dice en el
  // cartel, no se descubre despues mirando la lista.
  const i18n = fs.readFileSync("constants/i18n.ts", "utf8");
  ok(/día 1 del mes que elijas/.test(i18n), "y se avisa del dia 1 antes de elegir");
  for (const clave of [
    "importSheet.pickMonthTitle",
    "importSheet.pickMonthMessage",
    "importSheet.pickMonthAction",
  ]) {
    const veces = (i18n.match(new RegExp('"' + clave.replace(".", "\\.") + '":', "g")) ?? []).length;
    ok(veces === 3, `${clave} esta en los tres idiomas (${veces})`);
  }
}

console.log(fallos === 0 ? "\nTodo bien: una hoja llenada a mano ya entra" : `\n${fallos} fallas`);
process.exit(fallos === 0 ? 0 : 1);

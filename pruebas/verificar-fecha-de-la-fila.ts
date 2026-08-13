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

console.log(fallos === 0 ? "\nTodo bien: una hoja llenada a mano ya entra" : `\n${fallos} fallas`);
process.exit(fallos === 0 ? 0 : 1);

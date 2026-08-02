// Comprueba que un Excel de banco se lee bien.
//
// Usa el codigo REAL de utils/excelExtract.ts, no una copia: una copia se
// separa del original en cuanto alguien toca uno de los dos, y entonces la
// prueba pasa sobre codigo que ya no existe.
//
// Los archivos .xlsx se fabrican de verdad con SheetJS, no se simulan.
import * as XLSX from "xlsx";
import { extractExcelText, looksLikeExcel, pickSheet } from "@/utils/excelExtract";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  console.log(`  ${cond ? "OK   " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
}

function hacerExcel(hojas: { nombre: string; filas: unknown[][] }[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h.filas), h.nombre);
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/**
 * Fabrica un Excel de una celda con un numero de serie y su formato, que es
 * como guarda las fechas un Excel de banco de verdad.
 */
function excelConSerial(serial: number, formato: string): Uint8Array {
  const wb = XLSX.utils.book_new();
  const hoja: XLSX.WorkSheet = {
    "!ref": "A1:B2",
    A1: { t: "s", v: "Fecha" },
    B1: { t: "s", v: "Monto" },
    A2: { t: "n", v: serial, z: formato },
    B2: { t: "s", v: "-30.00" },
  };
  XLSX.utils.book_append_sheet(wb, hoja, "H");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

console.log("\n--- QUE CUENTA COMO EXCEL ---");
ok(looksLikeExcel("estado.xlsx"), "un .xlsx");
ok(looksLikeExcel("estado.xls"), "un .xls antiguo");
ok(looksLikeExcel("ESTADO DE CUENTA.XLSX"), "en mayusculas tambien");
ok(
  looksLikeExcel("sin-extension", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  "sin extension pero con el tipo que manda Android"
);
ok(!looksLikeExcel("estado.pdf"), "un PDF no");
ok(!looksLikeExcel("estado.csv"), "un CSV tampoco: ese ya se leia como texto");
ok(!looksLikeExcel("archivo.txt"), "ni un texto suelto");

console.log("\n--- UN ESTADO DE CUENTA EN EXCEL ---");
{
  const buf = hacerExcel([
    {
      nombre: "Movimientos",
      filas: [
        ["Fecha", "Descripcion", "Monto"],
        ["2026-07-03", "SALCHIPAPA EL TIMBO", "-10.00"],
        ["2026-07-15", "PLAZA VEA SURCO", "-45.50"],
        ["2026-07-20", "ABONO SUELDO", "1200.00"],
      ],
    },
  ]);
  const { text, sheetName } = extractExcelText(buf);
  ok(sheetName === "Movimientos", "se lee la hoja de movimientos");
  ok(text.includes("Fecha"), "sale la cabecera, de donde el importador saca las columnas");
  ok(text.includes("SALCHIPAPA EL TIMBO"), "sale la descripcion completa, sin cortar");
  ok(text.includes("-45.5"), "sale el monto con su signo");
  ok(text.includes("1200"), "y el ingreso tambien");
  ok(text.split("\n").filter((l) => l.trim()).length === 4, "salen las 4 filas");
  ok(text.includes(","), "el resultado va separado por comas, como un CSV");
}

console.log("\n--- VARIAS HOJAS: SE ELIGE LA DE LOS MOVIMIENTOS ---");
{
  // Los bancos meten una portada con el logo y los datos del titular. Si se
  // cogiera siempre la primera hoja, se importarian cero movimientos.
  const detalle: unknown[][] = [["Fecha", "Descripcion", "Monto"]];
  for (let i = 1; i <= 20; i++) {
    detalle.push([`2026-07-${String(i).padStart(2, "0")}`, `COMPRA ${i}`, `-${i}.00`]);
  }
  const buf = hacerExcel([
    { nombre: "Portada", filas: [["BANCO EJEMPLO"], ["Titular: LION"], ["Cuenta: 191-xxxx"]] },
    { nombre: "Detalle", filas: detalle },
  ]);
  const { text, sheetName } = extractExcelText(buf);
  ok(sheetName === "Detalle", `se elige la hoja con mas filas (${sheetName}), no la primera`);
  ok(!text.includes("Titular"), "no se cuela la portada");
  ok(text.includes("COMPRA 20"), "y llegan los 20 movimientos hasta el ultimo");
}

console.log("\n--- LAS FECHAS NO SE CORREN UN DIA ---");
{
  // ESTE ERA EL FALLO. Excel guarda la fecha como numero de serie; la forma
  // comoda de leerla la convierte en horario de Greenwich, y Peru va cinco
  // horas por detras: el 12 de julio salia como 11 de julio. TODAS las
  // fechas de un estado de cuenta se corrian un dia hacia atras, y un gasto
  // del dia 1 se iria al mes anterior.
  // La fecha se escribe como NUMERO DE SERIE con su formato, que es
  // exactamente lo que hay dentro de un Excel de banco. Escribirla como
  // fecha de JavaScript metería la zona horaria tambien al fabricar el
  // archivo y la prueba mediria dos cosas a la vez.
  const buf = excelConSerial(46215, "yyyy-mm-dd"); // 46215 = 12 de julio de 2026
  const { text } = extractExcelText(buf);
  const fila = text.split("\n")[1] ?? "";
  ok(fila.includes("2026-07-12"), `sale el 12: ${JSON.stringify(fila)}`);
  ok(!fila.includes("2026-07-11"), "y no se corrio al dia anterior");
  ok(!/\b4[0-9]{4}\b/.test(fila), "no aparece el numero de serie crudo");
}
{
  // Se escribe en AAAA-MM-DD y no en 12/07/2026 a proposito: asi no hay duda
  // de si el 7 es el mes o el dia. Y da igual con que formato viniera dentro
  // del Excel: aqui sale siempre igual.
  const { text } = extractExcelText(excelConSerial(46027, "m/d/yy")); // 5 de enero de 2026
  ok(text.includes("2026-01-05"), `el 5 de enero sale como 2026-01-05: ${JSON.stringify(text.split("\n")[1])}`);
  const { text: t2 } = extractExcelText(excelConSerial(46027, "dd/mm/yyyy"));
  ok(t2.includes("2026-01-05"), "y con formato dia/mes tambien sale igual");
}
{
  // Una celda numerica que NO es fecha no puede convertirse en una.
  const { text } = extractExcelText(excelConSerial(1500, "0.00"));
  ok(text.includes("1500"), `un monto de 1500 sigue siendo 1500: ${JSON.stringify(text.split("\n")[1])}`);
  ok(!text.includes("1904") && !text.includes("1900"), "no se convirtio en una fecha");
}

console.log("\n--- LO QUE NO SE PUEDE LEER SE DICE ---");
{
  let lanzo = false;
  try {
    // Una hoja con texto pero sin una sola cifra no es un estado de cuenta.
    extractExcelText(hacerExcel([{ nombre: "H", filas: [["hola"], ["que tal"]] }]));
  } catch {
    lanzo = true;
  }
  ok(lanzo, "una hoja sin ningun numero se rechaza en vez de pasar como valida");
}
{
  const vacio = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(vacio, XLSX.utils.aoa_to_sheet([[]]), "Vacia");
  let lanzo = false;
  try {
    extractExcelText(new Uint8Array(XLSX.write(vacio, { type: "array", bookType: "xlsx" }) as ArrayBuffer));
  } catch {
    lanzo = true;
  }
  ok(lanzo, "un libro sin datos tampoco pasa");
}

console.log("\n--- ELEGIR HOJA ---");
{
  const wb = XLSX.read(hacerExcel([{ nombre: "Unica", filas: [["a", 1]] }]), { type: "array" });
  ok(pickSheet(wb) === "Unica", "con una sola hoja se elige esa");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

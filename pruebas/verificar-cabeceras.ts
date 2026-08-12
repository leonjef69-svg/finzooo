// LAS CABECERAS QUE TRAEN LOS ARCHIVOS DE VERDAD (12/08/2026)
//
// Salio de una pregunta suya: *"¿que pasa si en el Excel en vez de Fecha dice Fecha de
// operaciones?"*. Se probo, y de paso salieron DOS fallos que llevaban ahi desde el principio.
//
//   1. "Fec. Operacion" ESTABA EN LA LISTA Y NO SERVIA PARA NADA. Las cabeceras pasan por un
//      limpiador que cambia los puntos por espacios —"Fec. Operacion" queda "fec operacion"—
//      pero los nombres de la lista se comparaban tal cual, CON su punto. Nunca podian
//      coincidir. Lo mismo le pasaba a "cod. operacion" en las referencias.
//
//      Es el peor tipo de fallo: alguien lo escribio creyendo que quedaba cubierto, y quien
//      leyera la lista despues lo daria por hecho tambien.
//
//   2. "Dia" no estaba, y algunos bancos la usan.
//
// Y AL ARREGLARLO APARECIO EL RIESGO CONTRARIO. La busqueda "por partes" —la que hace que
// "Fecha de operaciones" se reconozca porque CONTIENE "fecha"— con nombres cortos se vuelve
// peligrosa: "dia" aparece dentro de "gasto diario". Sin cuidado, esa columna pasaria por la de
// la fecha y el archivo entero entraria con fechas inventadas, sin dar ningun error.
//
// Por eso los nombres cortos solo valen exactos. Las dos ultimas comprobaciones de aqui abajo
// son las que vigilan eso, y son mas importantes que las cuatro primeras: equivocarse de
// columna es peor que no leer el archivo.
import { buildColumnMap, isUsableMap } from "@/utils/importEngine";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- LO QUE TIENE QUE LEERSE ---");
{
  const casos: [string[], string][] = [
    [["Fecha", "Descripcion", "Monto"], "el nombre normal"],
    [["Fecha de operaciones", "Descripcion", "Monto"], "el nombre largo (su pregunta)"],
    [["Fec. Operacion", "Glosa", "Cargo", "Abono"], "con punto en medio"],
    [["Dia", "Descripcion", "Monto"], "la que faltaba"],
    [["FECHA", "CONCEPTO", "IMPORTE"], "todo en mayusculas"],
    [["Fecha valuta", "Concepto", "Debito", "Credito"], "con cargo y abono en columnas aparte"],
  ];
  for (const [cabeceras, nota] of casos) {
    ok(isUsableMap(buildColumnMap(cabeceras)), `${nota}: ${JSON.stringify(cabeceras[0])}`);
  }
}

console.log("\n--- Y LO QUE NO PUEDE COLARSE ---");
{
  // Equivocarse de columna es PEOR que no leer el archivo. Si no lee, se ve y se busca otra
  // forma; si lee la columna equivocada, entran cien movimientos con la fecha de otra cosa y
  // nadie se entera hasta que los numeros no cuadran.
  const casos: [string[], string][] = [
    [["Gasto diario", "Nota"], "no confunde 'diario' con 'dia'"],
    [["Unidad", "Identidad"], "ni 'unidad' o 'identidad' con 'id'"],
    [["Producto", "Cantidad"], "un archivo que no es de movimientos"],
    [["Nombre", "Telefono"], "una lista de contactos"],
  ];
  for (const [cabeceras, nota] of casos) {
    ok(!isUsableMap(buildColumnMap(cabeceras)), `${nota}: ${JSON.stringify(cabeceras)}`);
  }
}

console.log("\n--- SIN FECHA O SIN MONTO, NO SE LEE ---");
{
  // Son las dos unicas columnas obligatorias. Sin fecha no se sabe a que mes va; sin monto no
  // hay movimiento. Lo demas —descripcion, categoria, metodo— puede faltar sin problema.
  ok(!isUsableMap(buildColumnMap(["Fecha", "Descripcion"])), "con fecha pero sin monto, no");
  ok(!isUsableMap(buildColumnMap(["Descripcion", "Monto"])), "con monto pero sin fecha, tampoco");
  ok(isUsableMap(buildColumnMap(["Fecha", "Monto"])), "pero con esas dos basta");
}

console.log(fallos === 0 ? "\nTodo bien: se leen las de verdad y no se cuela ninguna" : `\n${fallos} fallas`);
process.exit(fallos === 0 ? 0 : 1);

// EL ESCANER DE BOLETAS, PROBADO POR FIN CON UN PAPEL DE VERDAD (08/08/2026)
//
// El escaner llevaba en pausa desde el 30/07/2026 y NUNCA se habia probado con un papel real.
// Tampoco tenia ni una prueba. Las dos cosas iban juntas: sin nadie mirando, tres fallos serios
// llevaban ahi desde el primer dia.
//
// El usuario escaneo un documento suyo y la app propuso esto:
//
//   Monto:    2021          <- el AÑO
//   Comercio: "RAZON SoCIAL:"  <- la ETIQUETA, no el nombre
//   Fecha:    2021-03-05    <- la fecha de INGRESO, no la de pago
//
// Tres de tres mal. Y ninguno es un fallo de la camara: los tres estan en como se interpreta
// el texto, asi que se pueden comprobar aqui con numeros.
//
// > LO QUE SE PRUEBA NO ES SU DOCUMENTO. Ese lleva su nombre, su DNI y su sueldo, y este
// > repositorio se sube a internet. Se reproduce la FORMA que lo rompio —un año suelto, una
// > etiqueta sin valor, varias fechas con nombres distintos— con datos inventados. Es la misma
// > regla que se siguio con su estado de cuenta el 07/08/2026.
import { parseReceipt } from "@/utils/receiptParser";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const AHORA = new Date(2026, 7, 8);

console.log("\n--- UN AÑO NO ES UN MONTO ---");
{
  // EL PEOR DE LOS TRES. Cuando no hay una linea que diga "TOTAL", el lector se queda con la
  // cifra mas grande del papel — y el año es mas grande que casi cualquier compra de diario.
  // Como TODA boleta lleva el año escrito, esto no era un caso raro: era el caso normal.
  const conAño = parseReceipt(
    ["BODEGA LA ESQUINA", "PERIODO DE MAYO 2021", "PAN 3.50", "LECHE 4.20"].join("\n"),
    AHORA
  );
  ok(conAño.total !== 2021, `el año no se propone como monto (propuso ${conAño.total})`);
  ok(conAño.total === 4.2, `se queda con la cifra mayor de verdad (${conAño.total})`);

  // Y NO SE PASA DE LISTO: 2021 soles con centimos SI es un monto. Un televisor cuesta eso.
  const dosMilConCentimos = parseReceipt(["TIENDA", "TOTAL: 2021.00"].join("\n"), AHORA);
  ok(dosMilConCentimos.total === 2021, `2021.00 con centimos si es un monto (${dosMilConCentimos.total})`);

  // Ni con los años que todavia no han pasado, ni con los viejos.
  for (const año of ["1999", "2030"]) {
    const r = parseReceipt(["TIENDA", `EMITIDO EN ${año}`, "AGUA 2.50"].join("\n"), AHORA);
    ok(r.total === 2.5, `${año} tampoco (${r.total})`);
  }
}

console.log("\n--- UNA ETIQUETA NO ES EL NOMBRE DE NADIE ---");
{
  // La app guardo el comercio "RAZON SoCIAL:". Una linea que acaba en dos puntos anuncia lo
  // que viene despues, no lo dice. Y un movimiento con ese nombre no se puede ni buscar.
  const partida = parseReceipt(["RAZON SOCIAL:", "PANADERIA DON JOSE", "TOTAL 12.00"].join("\n"), AHORA);
  ok(!partida.merchant.includes(":"), `no se guarda una etiqueta como comercio ("${partida.merchant}")`);
  ok(partida.merchant === "PANADERIA DON JOSE", `se coge el nombre de verdad ("${partida.merchant}")`);

  // Y CUANDO LA ETIQUETA SI TRAE SU VALOR, el nombre esta DESPUES de los dos puntos. Ahi no
  // hay que adivinar nada: se lee.
  const enLinea = parseReceipt(["BOLETA DE VENTA", "RAZON SOCIAL: DISTRIBUIDORA SUR S.A.C", "TOTAL 30.00"].join("\n"), AHORA);
  ok(enLinea.merchant === "DISTRIBUIDORA SUR", `se lee lo que sigue a la etiqueta ("${enLinea.merchant}")`);
}

console.log("\n--- NO TODAS LAS FECHAS DE UN PAPEL VALEN LO MISMO ---");
{
  // Habia cuatro fechas y la app cogio la primera que decia "fecha": la de INGRESO, de dos
  // meses antes. El movimiento habria quedado guardado en el mes equivocado — y en una app de
  // presupuesto mensual eso descuadra el mes entero sin que se vea de donde viene.
  const variasFechas = parseReceipt(
    [
      "EMPRESA EJEMPLO",
      "FECHA DE INGRESO: 5/3/2021",
      "FECHA DE PAGO: 08/05/2021",
      "TOTAL: 575.91",
    ].join("\n"),
    AHORA
  );
  ok(variasFechas.date === "2021-05-08", `gana la fecha de pago (${variasFechas.date})`);
  ok(variasFechas.date !== "2021-03-05", "y no la de ingreso, que es otra cosa");

  // La de emision manda igual, que es la que lleva una boleta de compra normal.
  const conEmision = parseReceipt(
    ["TIENDA", "FECHA VENCIMIENTO: 01/01/2027", "FECHA EMISION: 20/07/2026", "TOTAL 15.00"].join("\n"),
    AHORA
  );
  ok(conEmision.date === "2026-07-20", `gana la de emision (${conEmision.date})`);

  // Y SIN NINGUNA ETIQUETA se sigue cogiendo la fecha suelta: quitar la ultima pasada dejaria
  // sin fecha a las boletas que solo la imprimen arriba, que son muchas.
  const suelta = parseReceipt(["MINIMARKET", "12/07/2026 14:30", "TOTAL 8.00"].join("\n"), AHORA);
  ok(suelta.date === "2026-07-12", `una fecha suelta sigue valiendo (${suelta.date})`);
}

console.log("\n--- Y UNA BOLETA NORMAL SIGUE LEYENDOSE ENTERA ---");
{
  // La red de seguridad de los tres arreglos: que al tapar los agujeros no se haya roto el
  // camino bueno, que es el que va a recorrer el 99% de las boletas.
  const normal = parseReceipt(
    [
      "MINIMARKET LA ESQUINA S.A.C.",
      "RUC: 20481602476",
      "BOLETA DE VENTA ELECTRONICA",
      "B001-00012345",
      "FECHA EMISION: 07/08/2026  HORA: 19:30",
      "GASEOSA 1L        5.50",
      "PAN                3.00",
      "SUBTOTAL          7.20",
      "IGV               1.30",
      "TOTAL A PAGAR     8.50",
    ].join("\n"),
    AHORA
  );
  ok(normal.total === 8.5, `el total es 8.50 y no el subtotal (${normal.total})`);
  ok(normal.merchant === "MINIMARKET LA ESQUINA", `el comercio ("${normal.merchant}")`);
  ok(normal.date === "2026-08-07", `la fecha (${normal.date})`);
  ok(normal.time === "19:30", `la hora (${normal.time})`);
  ok(normal.ruc === "20481602476", `el RUC (${normal.ruc})`);
  ok(normal.docNumber === "B001-00012345", `el numero de boleta (${normal.docNumber})`);
  ok(normal.currency === "PEN", "y en soles");
  // Con las tres cosas encontradas, la pantalla no tiene que pedir que se revise nada.
  ok(normal.confidence === "high", `y se lee con confianza alta (${normal.confidence})`);
}

console.log(fallos === 0 ? "\nTodo bien: el escaner no se inventa numeros\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

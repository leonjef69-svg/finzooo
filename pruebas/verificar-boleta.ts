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
import { encajar, imagenDentroDelHueco, recorteEnPixeles, MINIMO } from "@/utils/recorte";

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

console.log("\n--- UNA BOLETA PERUANA DE VERDAD (la de la botica) ---");
{
  // La trajo el 08/08/2026 como ejemplo de lo que SI quiere escanear: una boleta de compra
  // peruana, con RUC, IGV y soles. Es el caso para el que existe el escaner, asi que se guarda
  // entera — con el nombre de quien compro y su documento cambiados, que no hacen falta para
  // nada y no tienen por que estar en un repositorio publico.
  const botica = parseReceipt(
    [
      "InRetail Pharma S.A - INKA FARMA",
      "R.U.C.: 20331066703",
      "CAL, C. Pierola NRO. 108 - Arequipa",
      "BOLETA DE VENTA ELECTRONICA",
      "B008 N 00664859",
      "AREQUIPA - AREQUIPA",
      "FECHA DE EMISION : 15/06/2023",
      "CORRELATIVO      : 0983145907",
      "CAJA/TURNO       : 5 / 2",
      "TIPO DE MONEDA   : NUEVO SOL",
      "SENOR            : NOMBRE APELLIDO",
      "DOC. IDENTIDAD   : 00000000",
      "Descripcion                Total",
      "Cant. X Precio Unitario",
      "PANADOL FORTE TAB          6.00",
      "     2.00 X 3.00",
      "ABRILAR JARABE X 100 ML   20.00",
      "     1.00 X 20.00",
      "        Redo     S/    0.04",
      "        Total    S/   26.00",
      "Op. Exonerada   S/    0.00",
      "Op. Inafecta    S/    0.00",
      "Op. Gravada          22.00",
      "I.G.V.          S/    3.96",
      "Importe Total   S/   26.00",
      "Redondeo        S/    0.04",
      "Donacion        S/    0.00",
      "Importe a pagar S/   26.00",
      "SON:    VEINTISEIS CON 00/100 SOLES",
    ].join("\n"),
    AHORA
  );

  // EL TOTAL ES 26.00, y esta boleta lo pone dificil: hay CINCO lineas que dicen "total" o
  // parecido —Total, Importe Total, Importe a pagar, Op. Gravada, I.G.V.— y dos numeros que
  // se le acercan (22.00 de la base y 3.96 del impuesto). Coger el gravado seria cobrarse de
  // menos en cada compra sin que nadie lo note.
  ok(botica.total === 26, `el total es 26.00 (${botica.total})`);
  ok(botica.date === "2023-06-15", `la fecha de emision (${botica.date})`);
  ok(botica.ruc === "20331066703", `el RUC, aunque venga como "R.U.C.:" (${botica.ruc})`);
  ok(botica.currency === "PEN", "en soles");
  // EL NOMBRE QUE SE GUARDA TIENE QUE SER EL QUE LA PERSONA RECONOCE. "InRetail Pharma S.A" es
  // el nombre legal y no lo ha oido nadie; en la boleta, y en la cabeza de quien compro, esto
  // es Inkafarma. Un gasto que dice "InRetail Pharma" no se encuentra buscando "inka".
  ok(botica.merchant === "INKA FARMA", `el comercio se reconoce ("${botica.merchant}")`);

  // Y NO SE CORTA CUANDO NO TOCA. Sin exigir la forma juridica delante del guion, una tienda
  // llamada "PANADERIA DON JOSE - SUCURSAL 2" se quedaria en "SUCURSAL 2", que es peor que no
  // haber tocado nada.
  const conGuion = parseReceipt(["PANADERIA DON JOSE - CENTRO", "TOTAL 10.00"].join("\n"), AHORA);
  ok(conGuion.merchant === "PANADERIA DON JOSE - CENTRO", `un guion sin forma juridica no corta ("${conGuion.merchant}")`);
  // Y el numero de boleta viene con "N" en medio en vez de un guion, que es como lo imprimen
  // muchas: sin esto se queda vacio.
  ok(botica.docNumber === "B008-00664859", `el numero de boleta (${botica.docNumber})`);
}

console.log("\n--- UN CODIGO DE PRODUCTO NO ES UN MONTO (la boleta del 09/08/2026) ---");
{
  // La escaneo con la camara y la app propuso GUARDAR S/ 2,423.00 por una compra de S/ 16.50.
  // Los 2423 eran el CODIGO del producto, repetido en las tres lineas.
  //
  // Dos causas, y las dos hacian falta:
  //
  //   1. "Total" venia con las letras separadas —"T o t a l"—, que es como lo imprimen muchas
  //      boletas para que destaque. Asi la palabra "total" NO EXISTE para quien la busca, no
  //      puntua ninguna linea, y el escaner cae en su red de seguridad.
  //   2. Esa red se quedaba con la cifra mas grande, y un codigo de producto es mas grande que
  //      casi cualquier compra.
  const conCodigos = parseReceipt(
    [
      "Inkafarma",
      "InRetail Pharma S.A. - INKA FARMA",
      "BOLETA ELECTRONICA: B911-0230512",
      "Codigo  Descripcion       Importe",
      "2423    Lorem                 1.1",
      "2423    Ipsum                 2.2",
      "2423    Dolor sit amet        3.3",
      "T o t a l                    16.5",
      "www.inkafarma.com.pe",
      "GRACIAS POR SU COMPRA",
    ].join("\n"),
    AHORA
  );

  ok(conCodigos.total !== 2423, `el codigo de producto no se cobra (propuso ${conCodigos.total})`);
  ok(conCodigos.total === 16.5, `el total es 16.50 (${conCodigos.total})`);
  // Y AL ENCONTRAR LA LINEA DE TOTAL, la lectura deja de ser una adivinanza: la pantalla ya no
  // tiene que pedir que se revise el monto.
  ok(conCodigos.confidence !== "low", `y ya no avisa de lectura floja (${conCodigos.confidence})`);
  ok(conCodigos.merchant === "Inkafarma", `el comercio ("${conCodigos.merchant}")`);
  ok(conCodigos.docNumber === "B911-0230512", `el numero de boleta (${conCodigos.docNumber})`);

  // LAS LETRAS SUELTAS SE JUNTAN, y no cualquier par de letras: hacen falta TRES seguidas. Con
  // dos bastaria para pegar cosas que estan separadas de verdad y romper lineas normales.
  const conEspacios = parseReceipt(["TIENDA", "T O T A L    S/  45.00", "PAN 3.00"].join("\n"), AHORA);
  ok(conEspacios.total === 45, `"T O T A L" se entiende (${conEspacios.total})`);
  const dosLetras = parseReceipt(["TIENDA", "S/ 5 A 6 SOLES", "TOTAL 9.00"].join("\n"), AHORA);
  ok(dosLetras.total === 9, `y dos letras sueltas no se pegan (${dosLetras.total})`);

  // SIN NINGUNA CIFRA CON CENTIMOS se usan todas: hay boletas sin decimales, y quedarse sin
  // monto seria peor que arriesgar uno.
  const sinCentimos = parseReceipt(["TIENDA", "ARROZ 5", "ACEITE 12"].join("\n"), AHORA);
  ok(sinCentimos.total === 12, `sin centimos en ningun sitio, se usa el mayor (${sinCentimos.total})`);
}

console.log("\n--- UNA FACTURA CON TABLA (la del grifo, 09/08/2026) ---");
{
  // Escaneo la factura de un grifo y la app propuso 25.42, que es el SUBTOTAL. El total era
  // 30.00. Perder los 4.58 del IGV en cada compra no se nota mirando, se nota a fin de mes.
  //
  // La causa es la forma del papel: en una factura con tabla, "IMPORTE TOTAL", "S/" y "30.00"
  // son TRES CELDAS, y el lector las devuelve en lineas distintas. Asi la linea que dice
  // "total" se queda sin numero, se descarta, no queda ninguna que puntue, y el escaner cae en
  // su red de seguridad.
  const factura = parseReceipt(
    [
      "GRIFO SERVITOR S.A.",
      "R.U.C. N 20334129595",
      "FACTURA ELECTRONICA",
      "F102  N 00000383",
      "Fecha de emision: LIMA , 08 de Septiembre de 2020",
      "Codigo Cantidad UM Descripcion Valor Unitario Descuentos Sub Total",
      "05 3.040 GLL Diesel B5 S50 UV centrif. 8.36441 25.42",
      "Sub Total",
      "S/ 25.42",
      "Operacion Gravada:",
      "S/ 25.42",
      "I.G.V. 18%",
      "S/ 4.58",
      "IMPORTE TOTAL",
      "S/ 30.00",
    ].join("\n"),
    AHORA
  );

  ok(factura.total === 30, `el total es 30.00 y no el subtotal (${factura.total})`);
  ok(factura.total !== 25.42, "no se pierde el IGV en cada compra");
  // Y AL ENCONTRARLO DE VERDAD deja de ser una adivinanza: se quita el aviso de lectura floja.
  ok(factura.confidence !== "low", `y ya no avisa de lectura floja (${factura.confidence})`);
  ok(factura.merchant === "GRIFO SERVITOR", `el comercio ("${factura.merchant}")`);
  ok(factura.docNumber === "F102-00000383", `el numero de la factura (${factura.docNumber})`);

  // SOLO SE MIRA LA LINEA SIGUIENTE SI ES EL NUMERO A SECAS. Aceptar cualquiera con un numero
  // dentro convertiria un "TOTAL" perdido en el precio del primer producto de debajo.
  const conProductoDebajo = parseReceipt(
    ["TIENDA", "TOTAL", "GASEOSA 1L 5.50", "PAN 3.00"].join("\n"),
    AHORA
  );
  // Lo que se mide es que el atajo NO se lo crea. Acaba proponiendo 5.50 igual —la red de
  // seguridad se queda con la cifra mayor— pero lo hace ADIVINANDO, y por eso sigue avisando
  // de que la lectura salio floja. La diferencia entre adivinar y dar por bueno es justo lo que
  // esta prueba tiene que separar.
  ok(
    conProductoDebajo.confidence === "low",
    `un producto debajo de "TOTAL" no se da por bueno (${conProductoDebajo.confidence})`
  );
}

console.log("\n--- LAS BOLETAS DE LOS OTROS PAISES QUE LA APP OFRECE ---");
{
  // "El escanear tiene que funcionar en los paises que tengo en mi ajuste actualmente junto a
  // sus monedas" (09/08/2026). Salio mirando una boleta chilena: Finzo deja elegir pesos
  // chilenos, colombianos y argentinos, y ALLI LOS PRECIOS NO LLEVAN CENTIMOS.
  //
  // El escaner se apoyaba en los decimales para distinguir un precio de un codigo de producto
  // —eso es lo que evito que una compra de S/ 16.50 se guardara como S/ 2,423— y con esa regla
  // puesta en Chile DESCARTABA TODOS LOS MONTOS y no proponia nada.

  const chilena = [
    "Falabella Retail S.A.",
    "BOLETA ELECTRONICA N 671174752",
    "Fecha : 08-10-2020  Hora: 21:27",
    "CODIGO PROD  DESCRIPCION        MONTO",
    "190199222434  APPLE-APPLE I     659990",
    "SUBTOTAL                        659990",
    "TOTAL                           659990",
  ].join("\n");

  // CON PESOS CHILENOS se lee. 659.990 es el precio de un telefono, no un codigo.
  const enPesos = parseReceipt(chilena, AHORA, "CLP");
  ok(enPesos.total === 659990, `en pesos chilenos el total sale (${enPesos.total})`);

  // Y CON SOLES ESA MISMA BOLETA NO DA MONTO, que es justo lo que tiene que pasar: en soles un
  // numero de seis cifras sin centimos es un codigo, y creerselo seria peor que no proponer
  // nada. La regla no se ha aflojado para todos: se ha atado a la moneda.
  const mismaEnSoles = parseReceipt(chilena, AHORA, "PEN");
  ok(mismaEnSoles.total !== 659990, `en soles ese numero sigue siendo sospechoso (${mismaEnSoles.total})`);

  // COLOMBIA igual: un almuerzo son 18.000 pesos.
  const colombiana = parseReceipt(
    ["RESTAURANTE EL SABOR", "ALMUERZO         18000", "TOTAL            18000"].join("\n"),
    AHORA,
    "COP"
  );
  ok(colombiana.total === 18000, `en pesos colombianos tambien (${colombiana.total})`);

  // Y EL AÑO SIGUE SIENDO SOSPECHOSO, PERO NO EN LA LINEA DEL TOTAL. Una compra de 2021 pesos
  // chilenos existe —son dos dolares— y descartarla por parecerse a un año dejaria sin monto
  // una boleta que lo decia claramente.
  const dosMilVeintiuno = parseReceipt(
    ["CAFETERIA", "EMITIDO EN 2021", "TOTAL 2021"].join("\n"),
    AHORA,
    "CLP"
  );
  ok(dosMilVeintiuno.total === 2021, `en la linea del total se le cree al numero (${dosMilVeintiuno.total})`);
  // Pero fuera de esa linea se sigue desconfiando: ahi el año gana el "mas grande" casi siempre.
  const soloElAño = parseReceipt(["CAFETERIA", "EMITIDO EN 2021", "CAFE 900"].join("\n"), AHORA, "CLP");
  ok(soloElAño.total === 900, `y fuera de ella el año se descarta (${soloElAño.total})`);

  // UN CODIGO DE BARRAS SIGUE FUERA EN LAS DOS MONEDAS: ocho cifras ya no es dinero.
  const conCodigoBarras = parseReceipt(
    ["TIENDA", "7501234567890  ARROZ  2500", "TOTAL 2500"].join("\n"),
    AHORA,
    "CLP"
  );
  ok(conCodigoBarras.total === 2500, `un codigo de barras no se cobra (${conCodigoBarras.total})`);

  // Y LA MONEDA POR DEFECTO SIGUE SIENDO SOLES: la app es peruana y las pruebas de arriba, que
  // no pasan moneda, tienen que seguir midiendo lo mismo.
  const porDefecto = parseReceipt(["TIENDA", "TOTAL 12.50"].join("\n"), AHORA);
  ok(porDefecto.total === 12.5, "sin decir moneda se sigue leyendo como soles");
}

console.log("\n--- SERIES DE BOLETA CON MAS DE UNA LETRA (Ripley) ---");
{
  // Se pedia una letra y tres numeros —B001, F102—, y con las boletas de Ripley el numero se
  // perdia: usan BP01 en tienda y BTV1 por internet.
  const tienda = parseReceipt(
    ["RIPLEY", "TIENDAS POR DEPARTAMENTO RIPLEY S.A.C", "RUC 20337564373", "BOLETA VENTA ELECTRONICA  BP01-4226409", "TOTAL 59.90"].join("\n"),
    AHORA
  );
  ok(tienda.docNumber === "BP01-4226409", `la serie de tienda (${tienda.docNumber})`);
  ok(tienda.ruc === "20337564373", `y el RUC (${tienda.ruc})`);

  const virtual = parseReceipt(
    ["TIENDAS POR DEPARTAMENTO RIPLEY S.A.C.", "BOLETA DE VENTA ELECTRONICA", "BTV1 - 5770501", "FECHA DE EMISION: 09/09/2022", "TOTAL 120.00"].join("\n"),
    AHORA
  );
  ok(virtual.docNumber === "BTV1-5770501", `la serie de la tienda virtual (${virtual.docNumber})`);
  ok(virtual.date === "2022-09-09", `y su fecha (${virtual.date})`);

  // Y LAS DE SIEMPRE SIGUEN VALIENDO: aflojar la forma no puede romper lo que ya funcionaba.
  const deSiempre = parseReceipt(["TIENDA", "B001-00012345", "TOTAL 10.00"].join("\n"), AHORA);
  ok(deSiempre.docNumber === "B001-00012345", `la de toda la vida (${deSiempre.docNumber})`);
}

console.log("\n--- EL RECORTE CAE DONDE SE VE ---");
{
  // El recortador de Android se cambio por uno propio el 09/08/2026, con este motivo suyo:
  // "ese cuadro sigue siendo de color blanco, no se ve nada cuando se recorta la imagen". Ese
  // recuadro lo pintaba el sistema, y su celular lo dibuja en blanco sobre una foto que tambien
  // es blanca — el papel.
  //
  // Lo que se comprueba aqui no es el color: es que el recorte caiga DONDE SE VE. Es el error
  // clasico de cualquier recortador —la imagen se enseña a 350 puntos y tiene 3000 pixeles— y
  // no se puede mirar a ojo. Si sale corrido, se lleva el total.

  // Una boleta alta (1000x3000) en una pantalla ancha (400x800): entra a lo alto y sobran
  // bandas a los lados. Esas bandas son justo lo que hace que todo salga desplazado si no se
  // descuentan.
  const dibujo = imagenDentroDelHueco(1000, 3000, 400, 800);
  ok(Math.abs(dibujo.escala - 800 / 3000) < 1e-9, `la imagen se encoge hasta caber (escala ${dibujo.escala.toFixed(4)})`);
  ok(Math.round(dibujo.ancho) === 267 && Math.round(dibujo.alto) === 800, `se dibuja ${Math.round(dibujo.ancho)}x${Math.round(dibujo.alto)}`);
  ok(Math.round(dibujo.x) === 67 && dibujo.y === 0, `centrada, con banda a los lados (x=${Math.round(dibujo.x)})`);

  // TODO EL DIBUJO SELECCIONADO = TODA LA IMAGEN. Si esto falla, cualquier recorte sale mal.
  const todo = recorteEnPixeles({ x: dibujo.x, y: dibujo.y, ancho: dibujo.ancho, alto: dibujo.alto }, dibujo, 1000, 3000);
  ok(todo.originX === 0 && todo.originY === 0, `coger todo empieza en la esquina (${todo.originX},${todo.originY})`);
  ok(todo.width === 1000 && todo.height === 3000, `y coge la imagen entera (${todo.width}x${todo.height})`);

  // LA MITAD DE ABAJO, que en una boleta es donde esta el total.
  const abajo = recorteEnPixeles(
    { x: dibujo.x, y: dibujo.alto / 2, ancho: dibujo.ancho, alto: dibujo.alto / 2 },
    dibujo,
    1000,
    3000
  );
  ok(abajo.originY === 1500, `la mitad de abajo empieza en el pixel 1500 (${abajo.originY})`);
  ok(abajo.height === 1500, `y mide 1500 de alto (${abajo.height})`);
  // Y NO SE OLVIDA LA BANDA: sin descontarla, el recorte saldria corrido a la izquierda.
  ok(abajo.originX === 0, `sin desplazarse por la banda lateral (${abajo.originX})`);

  // PEDIR UN RECORTE QUE SE SALE HACE FALLAR LA OPERACION ENTERA, y entonces no se recorta
  // nada y la boleta se lee con la mesa dentro. Se topa a los bordes.
  const pasado = recorteEnPixeles({ x: -500, y: -500, ancho: 5000, alto: 9000 }, dibujo, 1000, 3000);
  ok(pasado.originX >= 0 && pasado.originY >= 0, "un recorte que se sale se topa en la esquina");
  ok(pasado.originX + pasado.width <= 1000 && pasado.originY + pasado.height <= 3000, "y no se pasa de la imagen");

  // EL RECUADRO NO PUEDE SALIRSE NI HACERSE INVISIBLE. Es el MISMO tope que usa el recorte: con
  // dos topes distintos se podria arrastrar mas alla de la imagen y al guardar saldria otra
  // cosa, que es el fallo que ya costo una vez en el recortador de las categorias.
  const fuera = encajar({ x: -100, y: -100, ancho: 50, alto: 50 }, dibujo);
  ok(fuera.x >= dibujo.x && fuera.y >= dibujo.y, "el recuadro no se sale por arriba");
  ok(fuera.ancho >= MINIMO && fuera.alto >= MINIMO, `ni se encoge hasta no poder agarrarlo (${fuera.ancho}x${fuera.alto})`);
  const enorme = encajar({ x: 0, y: 0, ancho: 99999, alto: 99999 }, dibujo);
  ok(enorme.ancho <= dibujo.ancho && enorme.alto <= dibujo.alto, "ni se hace mas grande que la foto");

  // Y SIN MEDIDAS NO SE REVIENTA: una imagen de tamaño cero devuelve algo usable en vez de
  // dividir por cero y dejar la pantalla muerta con la foto ya tomada.
  const vacio = imagenDentroDelHueco(0, 0, 400, 800);
  ok(vacio.escala === 1 && vacio.ancho === 0, "una imagen sin medidas no rompe las cuentas");
}

console.log(fallos === 0 ? "\nTodo bien: el escaner no se inventa numeros\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);

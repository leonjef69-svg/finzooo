// EL TOTAL ESCRITO CON LETRAS: "SON: VEINTISEIS CON 00/100 SOLES" → 26.00
//
// POR QUÉ ESTO ES LA SOLUCIÓN Y NO OTRO PARCHE
//
// El escáner se apoyaba en encontrar la línea que dice "TOTAL" y su número al lado. Eso se
// rompe de mil maneras, y cada una costó un arreglo distinto en dos días:
//
//   · "T o t a l", con las letras separadas para que destaque.
//   · "IMPORTE TOTAL", "S/" y "30.00" en tres celdas de una tabla, que el lector parte.
//   · La fila del total directamente no leída, porque cae sobre una línea del recuadro.
//
// Cuando eso falla, el escáner adivina — y de ahí salieron el año (2021) y el código de
// producto (2423) cobrados como si fueran la compra.
//
// **Esta línea no se rompe igual.** Va en su propio renglón, en texto corrido, lejos de las
// tablas y de las columnas. Y dice el total de forma inequívoca: no hay que decidir si es el
// subtotal, el gravado o el IGV. Está en la boleta de la botica y en la factura del grifo, y
// es obligatoria en los comprobantes electrónicos peruanos.
//
// LO QUE NO HACE
//
// No entiende millones ni decimales escritos con palabras ("con cincuenta céntimos"). Los
// céntimos van siempre como fracción —"CON 00/100"— que es como los imprime SUNAT.

/** Las palabras que valen un número por sí solas. Sin tildes: el texto llega ya sin ellas. */
const PALABRAS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21,
  veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

/**
 * "ciento veinte" → 120. Devuelve null si no reconoce nada.
 *
 * Se suma lo que va llegando y "mil" multiplica lo acumulado: así "dos mil quinientos" son
 * 2.500 y "mil" a secas son 1.000. La "y" de "treinta y cinco" se ignora, que es lo que es:
 * un pegamento entre dos números.
 *
 * SI APARECE UNA PALABRA QUE NO ES UN NÚMERO, SE PARA. Es lo que impide que "SON DOS CAFES"
 * acabe valiendo dos: en cuanto deja de haber números, lo que sigue ya no es la cantidad.
 */
export function numeroEnLetras(texto: string): number | null {
  const palabras = texto.toLowerCase().split(/[\s,]+/).filter(Boolean);
  let total = 0;
  let parcial = 0;
  let vistoAlguno = false;

  for (const palabra of palabras) {
    if (palabra === "y") continue;
    if (palabra === "mil" || palabra === "miles") {
      // "mil" a secas vale mil; "dos mil" multiplica lo que se llevaba.
      parcial = (parcial === 0 ? 1 : parcial) * 1000;
      total += parcial;
      parcial = 0;
      vistoAlguno = true;
      continue;
    }
    const valor = PALABRAS[palabra];
    if (valor === undefined) break;
    parcial += valor;
    vistoAlguno = true;
  }

  if (!vistoAlguno) return null;
  return total + parcial;
}

/**
 * Saca el total de la línea que lo dice con letras.
 *
 * Busca la fracción de céntimos —"00/100", "50/100"— porque es la marca inconfundible de esta
 * línea: ningún otro renglón de una boleta lleva algo partido entre cien. Lo de delante son
 * las unidades; lo de dentro, los céntimos.
 *
 * Se le quita antes "SON" y "CON", que son las palabras de pegar y no números.
 */
export function totalEnLetras(lineas: string[]): number | null {
  for (const linea of lineas) {
    const m = /(.*?)(?:\bcon\b|\by\b)?\s*(\d{1,2})\s*\/\s*100/i.exec(linea);
    if (!m) continue;

    const centimos = Number(m[2]);
    if (!Number.isFinite(centimos) || centimos > 99) continue;

    const antes = m[1]
      .toLowerCase()
      // "son:" es el rótulo, no un número. Y lo que va antes de él tampoco cuenta: en algunas
      // boletas esta línea viene pegada a la anterior.
      .replace(/^.*\bson\b\s*:?\s*/, "")
      .replace(/\bcon\b/g, " ")
      .trim();

    const unidades = numeroEnLetras(antes);
    if (unidades === null) continue;

    // A céntimos exactos: 26 + 0/100 tiene que dar 26 y no 26.000000000000004.
    return Math.round((unidades + centimos / 100) * 100) / 100;
  }
  return null;
}

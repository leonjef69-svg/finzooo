import * as XLSX from "xlsx";

/**
 * Convierte un Excel en el mismo texto separado por comas que ya sabe leer
 * el importador.
 *
 * POR QUÉ ASÍ Y NO UN LECTOR APARTE
 *
 * El importador ya entiende los estados de cuenta: encuentra la fila de
 * cabeceras, adivina qué columna es la fecha y cuál el monto, reconoce el
 * banco, clasifica los comercios y detecta duplicados. Todo eso funciona
 * sobre TEXTO.
 *
 * Escribir un segundo camino solo para Excel habría duplicado esa lógica, y
 * dos caminos que hacen lo mismo se separan en cuanto alguien toca uno: un
 * banco nuevo funcionaría en CSV y no en Excel, o al revés. Así que el Excel
 * se convierte a texto y entra por la misma puerta que el resto.
 *
 * De paso, un Excel de banco y un CSV del mismo banco se leen exactamente
 * igual, con las mismas reglas.
 */

/** Lo que devuelve leer un Excel: el texto, y en qué hoja se encontró. */
export type ExcelRead = {
  text: string;
  sheetName: string;
};

/**
 * ¿Este archivo parece un Excel?
 *
 * Se mira el nombre y también el tipo que declara Android, porque no siempre
 * llega. Un estado de cuenta compartido desde el banco puede venir sin tipo
 * y solo con el nombre.
 */
export function looksLikeExcel(name: string, mimeType?: string): boolean {
  const n = name.toLowerCase();
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".xlsm")) return true;
  if (!mimeType) return false;
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.ms-excel.sheet.macroEnabled.12"
  );
}

/**
 * Elige la hoja que lleva los movimientos.
 *
 * Los estados de cuenta en Excel suelen traer varias hojas: una portada con
 * el logo y los datos del titular, y otra con el detalle. Quedarse siempre
 * con la primera dejaría fuera justo lo que se busca.
 *
 * Se elige la que MÁS FILAS tiene, que es la del detalle. Una portada tiene
 * cuatro líneas; un mes de movimientos, decenas.
 */
export function pickSheet(workbook: XLSX.WorkBook): string | null {
  let mejor: string | null = null;
  let masFilas = -1;

  for (const nombre of workbook.SheetNames) {
    const hoja = workbook.Sheets[nombre];
    if (!hoja || !hoja["!ref"]) continue;
    const rango = XLSX.utils.decode_range(hoja["!ref"]);
    const filas = rango.e.r - rango.s.r + 1;
    if (filas > masFilas) {
      masFilas = filas;
      mejor = nombre;
    }
  }
  return mejor;
}

/**
 * Lee el Excel y devuelve su contenido como texto separado por comas.
 *
 * Lanza si el archivo no se puede abrir o no tiene ninguna hoja con datos.
 * Quien llama debe explicarlo, no callarlo: un Excel que no se lee y no dice
 * nada deja a la persona sin saber si el archivo estaba mal o la app falló.
 */
/**
 * Pasa una fecha de Excel a "AAAA-MM-DD" sin que la zona horaria la toque.
 *
 * ESTO ERA UN FALLO DE VERDAD Y LO CAZÓ LA PRUEBA
 *
 * Excel guarda las fechas como un número de serie (46215 = 12 de julio de
 * 2026). La forma cómoda de leerlas es pedirle a la librería que las
 * convierta en fechas de JavaScript, y eso hace la conversión en horario de
 * Greenwich. Perú va cinco horas por detrás, así que el 12 de julio a las
 * 00:00 se convertía en el 11 de julio por la noche: TODAS las fechas de un
 * estado de cuenta se corrían un día hacia atrás.
 *
 * Un gasto del día 1 pasaría al mes anterior. En una app de dinero eso no es
 * un detalle.
 *
 * parse_date_code devuelve año, mes y día como números sueltos, sin fecha de
 * JavaScript y sin zona horaria de por medio. No hay nada que se pueda
 * correr.
 *
 * Y se escribe en AAAA-MM-DD y no en "12/07/2026" a propósito: así no hay
 * duda de si el 7 es el mes o el día, que es el otro error clásico al leer
 * estados de cuenta.
 */
function serialADdmmaa(serial: number): string | null {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || !d.y || !d.m || !d.d) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

export function extractExcelText(data: Uint8Array): ExcelRead {
  const workbook = XLSX.read(data, {
    type: "array",
    // cellDates FALSE a propósito: se quieren los números de serie tal cual
    // para convertirlos a mano, sin que ninguna zona horaria los corra. Ver
    // serialADdmmaa.
    cellDates: false,
    // cellNF TRUE es imprescindible: es lo que rellena el formato de cada
    // celda (.z). Sin él, todas las celdas llegan sin formato, no hay forma
    // de distinguir una fecha de un monto —las dos son números— y la
    // conversión de más abajo no se aplicaba a ninguna. Costó una prueba en
    // rojo darse cuenta.
    cellNF: true,
    // No hacen falta ni estilos ni fórmulas: solo el valor de cada celda.
    // Pedir menos hace que un estado de cuenta grande se lea más rápido y
    // ocupe menos memoria en un celular.
    cellStyles: false,
    cellFormula: false,
  });

  const nombre = pickSheet(workbook);
  if (!nombre) throw new Error("El archivo no tiene ninguna hoja con datos.");
  const hoja = workbook.Sheets[nombre];

  // Las celdas que Excel marca como fecha se reescriben antes de convertir
  // la hoja a texto. Se toca la copia que ya está en memoria; el archivo del
  // celular no se modifica.
  for (const ref of Object.keys(hoja)) {
    if (ref.startsWith("!")) continue;
    const celda = hoja[ref] as XLSX.CellObject;
    if (celda.t !== "n" || typeof celda.v !== "number") continue;
    if (!celda.z || !XLSX.SSF.is_date(String(celda.z))) continue;
    const fecha = serialADdmmaa(celda.v);
    if (!fecha) continue;
    celda.t = "s";
    celda.v = fecha;
    celda.w = fecha;
  }

  const texto = XLSX.utils.sheet_to_csv(hoja, {
    // Las celdas vacías salen vacías, no como "undefined".
    blankrows: false,
    // Se usa el valor formateado tal como se ve en Excel, para que un monto
    // no pierda sus decimales.
    rawNumbers: false,
  });

  // Una hoja que existe pero no tiene ni una línea con cifras no es un
  // estado de cuenta. Es preferible decirlo aquí que dejar que el importador
  // responda "no encontramos las columnas de fecha y monto", que suena a
  // que el archivo está mal cuando lo que pasa es que no se pudo leer.
  if (!/\d/.test(texto)) {
    throw new Error("La hoja no tiene ningún dato reconocible.");
  }

  return { text: texto, sheetName: nombre };
}

// MOTOR DE IMPORTACIÓN DE ESTADOS DE CUENTA
//
// Lee un archivo exportado por un banco y lo convierte en movimientos de
// Fino. Está aparte de la pantalla a propósito: así se puede probar sin
// abrir la app y sin tocar nada visual.
//
// Está pensado para ser GENÉRICO. Cada banco arma su archivo a su manera
// (distintos nombres de columna, filas de basura antes de la tabla,
// montos en una o dos columnas...), así que en vez de escribir un lector
// por banco, el motor observa el archivo y se adapta.

import { EXPENSE_CATS, INCOME_CATS } from "@/constants/categories";
import { PAYMENT_METHODS } from "@/constants/i18n";

// ---------------------------------------------------------------------
// 1. LECTURA DEL ARCHIVO
// ---------------------------------------------------------------------

// Los bancos no se ponen de acuerdo: unos separan con comas, otros con
// punto y coma (común cuando el país usa la coma para los decimales) y
// otros con tabulaciones. Miramos la primera línea larga y elegimos el
// separador que más veces aparece.
export function detectDelimiter(lines: string[]): string {
  const candidates = [",", ";", "\t", "|"];
  const sample = lines.slice(0, 15).join("\n");
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = sample.split(candidate).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

// Parte una línea respetando las comillas: un campo entre comillas puede
// contener el separador dentro sin que se rompa en dos.
export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

// ---------------------------------------------------------------------
// 2. RECONOCIMIENTO DE COLUMNAS
// ---------------------------------------------------------------------

// Nombres que los bancos suelen usar para cada dato. Todo en minúsculas y
// sin tildes (el texto se normaliza antes de comparar).
const COLUMN_ALIASES = {
  date: [
    "fecha", "date", "data", "fecha de operacion", "fecha operacion",
    "fecha de proceso", "fecha proceso", "fec. operacion", "f. operacion",
    "fecha valuta", "fecha mov", "fecha movimiento",
    // Sueltos y cortos: solo valen si la cabecera dice exactamente eso. Ver el largo minimo
    // de arriba — "dia" dentro de "gasto diario" se llevaria la columna equivocada.
    "dia", "day", "fec",
  ],
  description: [
    "descripcion", "description", "descricao", "detalle", "concepto",
    "glosa", "operacion", "movimiento", "referencia descripcion",
    "descripcion operacion", "detalle movimiento",
  ],
  amount: ["monto", "amount", "valor", "importe", "total", "monto operacion"],
  charge: ["cargo", "debito", "debe", "salida", "egreso", "retiro", "debit"],
  credit: ["abono", "credito", "haber", "entrada", "ingreso", "deposito", "credit"],
  category: ["categoria", "category", "rubro", "tipo de gasto"],
  method: ["metodo", "method", "medio", "medio de pago", "canal", "forma de pago"],
  type: ["tipo", "type", "tipo movimiento", "tipo de movimiento"],
  reference: [
    "referencia", "reference", "operacion", "nro operacion", "num operacion",
    "codigo", "cod. operacion", "n operacion", "id",
  ],
  merchant: ["comercio", "merchant", "establecimiento", "beneficiario", "empresa"],
  balance: ["saldo", "balance", "saldo contable", "saldo disponible"],
} as const;

export type ColumnMap = {
  date: number;
  description: number;
  amount: number;
  charge: number;
  credit: number;
  category: number;
  method: number;
  type: number;
  reference: number;
  merchant: number;
};

// Quita tildes, espacios de sobra y mayúsculas para poder comparar
// "Descripción" con "descripcion" sin problemas.
export function normalizeHeader(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cuántas letras tiene que tener un nombre para buscarlo POR PARTES.
 *
 * La búsqueda por partes es la que hace que "Fecha de operaciones" se reconozca como fecha: la
 * cabecera CONTIENE "fecha". Pero con nombres cortos se vuelve peligrosa — "dia" aparece dentro
 * de "gasto diario", e "id" dentro de "identidad" y de "unidad". Ahí una columna cualquiera
 * pasaría por la de la fecha y el archivo entero entraría con fechas inventadas.
 *
 * Los cortos solo valen si la cabecera dice EXACTAMENTE eso.
 */
const LARGO_MINIMO_PARA_BUSCAR_POR_PARTES = 5;

function findColumnIndex(headers: string[], aliases: readonly string[]): number {
  // LOS NOMBRES BUSCADOS SE LIMPIAN IGUAL QUE LAS CABECERAS, y esto era un fallo (12/08/2026).
  //
  // Las cabeceras pasan por normalizeHeader, que cambia los puntos por espacios: "Fec.
  // Operación" queda "fec operacion". Pero los nombres de esta lista se comparaban tal cual,
  // con su punto, así que "fec. operacion" NUNCA podía coincidir con nada — estaba escrito en
  // la lista y no servía para nada. Lo mismo con "cod. operacion".
  const buscados = aliases.map((a) => normalizeHeader(a)).filter(Boolean);

  // Primero busca coincidencia exacta (más confiable)...
  for (const alias of buscados) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  // ...y si no, que el encabezado contenga el nombre buscado.
  for (const alias of buscados) {
    if (alias.length < LARGO_MINIMO_PARA_BUSCAR_POR_PARTES) continue;
    const idx = headers.findIndex((h) => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function buildColumnMap(rawHeaders: string[]): ColumnMap {
  const headers = rawHeaders.map(normalizeHeader);
  return {
    date: findColumnIndex(headers, COLUMN_ALIASES.date),
    description: findColumnIndex(headers, COLUMN_ALIASES.description),
    amount: findColumnIndex(headers, COLUMN_ALIASES.amount),
    charge: findColumnIndex(headers, COLUMN_ALIASES.charge),
    credit: findColumnIndex(headers, COLUMN_ALIASES.credit),
    category: findColumnIndex(headers, COLUMN_ALIASES.category),
    method: findColumnIndex(headers, COLUMN_ALIASES.method),
    type: findColumnIndex(headers, COLUMN_ALIASES.type),
    reference: findColumnIndex(headers, COLUMN_ALIASES.reference),
    merchant: findColumnIndex(headers, COLUMN_ALIASES.merchant),
  };
}

// Un mapa sirve si sabemos CUÁNDO pasó algo y CUÁNTO fue. El monto puede
// venir en una sola columna, o repartido en "cargo" y "abono".
export function isUsableMap(map: ColumnMap): boolean {
  const hasAmount = map.amount !== -1 || map.charge !== -1 || map.credit !== -1;
  return map.date !== -1 && hasAmount;
}

// ---------------------------------------------------------------------
// 3. DÓNDE EMPIEZA LA TABLA DE VERDAD
// ---------------------------------------------------------------------

// Casi todos los bancos ponen basura arriba antes de la tabla real:
// el nombre del titular, el número de cuenta, el periodo, líneas
// vacías... Buscamos la primera fila que parezca un encabezado de tabla
// de verdad (o sea, que tenga fecha y monto reconocibles).
export function findHeaderRow(
  lines: string[],
  delimiter: string
): { headerIndex: number; map: ColumnMap } | null {
  const maxScan = Math.min(lines.length, 30);
  for (let i = 0; i < maxScan; i++) {
    const cells = parseDelimitedLine(lines[i], delimiter);
    if (cells.length < 2) continue;
    const map = buildColumnMap(cells);
    if (isUsableMap(map)) return { headerIndex: i, map };
  }
  return null;
}

// ---------------------------------------------------------------------
// 4. LECTURA DE VALORES
// ---------------------------------------------------------------------

// Entiende los dos formatos de número que se usan en el mundo:
//   "1,234.56" (inglés)  y  "1.234,56" (español/portugués)
// El separador que está MÁS A LA DERECHA es el de los centavos; el otro
// es de miles y se ignora.
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  // Algunos bancos marcan los negativos entre paréntesis: (1,250.00)
  const inParentheses = /^\(.*\)$/.test(raw.trim());
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const isNegative = cleaned.startsWith("-") || inParentheses;
  const digits = cleaned.replace(/-/g, "");
  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");

  let normalized: string;
  if (lastDot === -1 && lastComma === -1) {
    normalized = digits;
  } else {
    const decimalPos = Math.max(lastDot, lastComma);
    const separator = digits[decimalPos];
    const decimalsAfter = digits.length - decimalPos - 1;
    const hasBothSeparators = lastDot !== -1 && lastComma !== -1;
    const separatorAppearsOnce = digits.split(separator).length - 1 === 1;

    // "1.234" o "1,234": un solo separador con exactamente 3 cifras
    // detrás es separador de miles, no centavos.
    const isThousandsOnly = !hasBothSeparators && separatorAppearsOnce && decimalsAfter === 3;

    if (isThousandsOnly) {
      normalized = digits.replace(/[.,]/g, "");
    } else {
      const intPart = digits.slice(0, decimalPos).replace(/[.,]/g, "");
      const decPart = digits.slice(decimalPos + 1);
      normalized = `${intPart}.${decPart}`;
    }
  }

  const n = parseFloat(normalized);
  if (isNaN(n)) return null;
  return isNegative ? -n : n;
}

// Comprueba que la fecha exista de verdad en el calendario, para que
// basura como "2026-13-45" no entre como válida.
function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}

const MONTH_WORDS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, mai: 5,
  jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, oct: 10, out: 10,
  nov: 11, dic: 12, dec: 12, dez: 12,
};

/**
 * EL MES QUE EL PROPIO ARCHIVO DECLARA ARRIBA, si lo declara.
 *
 * Sale de su hoja de control (12/08/2026): las filas de gastos no llevan fecha porque el mes ya
 * está escrito en la cabecera de la hoja — "MES: Enero"— y ahí una columna llena de "enero,
 * enero, enero" no le sirve a nadie. Quien la llenó no se equivocó; simplemente la fecha vive en
 * otro sitio.
 *
 * Solo se mira lo que hay ANTES de la fila de cabeceras: más abajo son datos, y un movimiento
 * que diga "pago de enero" no habla del mes del archivo.
 *
 * El año, si no aparece, es el de hoy. Es lo que hace cualquiera al escribir "MES: Enero" en una
 * hoja: hablar del enero de este año.
 */
export function mesDeclaradoEn(lineas: string[]): { anio: number; mes: number } | null {
  const NOMBRES: [RegExp, number][] = [
    [/\benero?\b/, 1], [/\bfebrero?\b/, 2], [/\bmarzo?\b/, 3], [/\babril\b/, 4],
    [/\bmayo\b/, 5], [/\bjunio\b/, 6], [/\bjulio\b/, 7], [/\bagosto\b/, 8],
    [/\bsetiembre\b|\bseptiembre\b/, 9], [/\boctubre\b/, 10], [/\bnoviembre\b/, 11],
    [/\bdiciembre\b/, 12],
  ];
  let mes: number | null = null;
  let anio: number | null = null;
  for (const linea of lineas) {
    const texto = normalizeHeader(linea);
    if (mes === null) {
      for (const [patron, numero] of NOMBRES) {
        if (patron.test(texto)) {
          mes = numero;
          break;
        }
      }
    }
    if (anio === null) {
      const encontrado = texto.match(/\b(20\d{2})\b/);
      if (encontrado) anio = Number(encontrado[1]);
    }
  }
  if (mes === null) return null;
  return { anio: anio ?? new Date().getFullYear(), mes };
}

/**
 * Una celda que trae SOLO el número del día ("5"), convertida en fecha de verdad.
 *
 * Hace falta cuando la columna se llama "Día" y el mes está en la cabecera del archivo, que es
 * como se escribe una hoja mensual a mano.
 *
 * SIN MES DECLARADO NO SE INVENTA NADA. Un "5" suelto puede ser cualquier cosa —un número de
 * cuota, un código— y ponerle un mes a dedo metería movimientos en un mes equivocado sin que se
 * note. Que no entre es mucho menos grave.
 */
export function fechaDeDiaSuelto(
  raw: string,
  mesDeclarado: { anio: number; mes: number } | null
): string | null {
  if (!mesDeclarado) return null;
  const soloDigitos = (raw || "").trim().match(/^(\d{1,2})$/);
  if (!soloDigitos) return null;
  const dia = Number(soloDigitos[1]);
  if (!isRealDate(mesDeclarado.anio, mesDeclarado.mes, dia)) return null;
  return `${mesDeclarado.anio}-${String(mesDeclarado.mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Devuelve la fecha en formato "YYYY-MM-DD", o null si no se entiende.
export function parseDate(raw: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    if (!isRealDate(Number(y), Number(m), Number(d))) return null;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 24/07/2026 · 24-07-2026 · 24.07.2026 (y también con año de 2 cifras)
  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) {
    const [, dRaw, mRaw, yRaw] = dmy;
    let year = Number(yRaw);
    if (yRaw.length === 2) year += year < 70 ? 2000 : 1900;
    if (!isRealDate(year, Number(mRaw), Number(dRaw))) return null;
    return `${year}-${mRaw.padStart(2, "0")}-${dRaw.padStart(2, "0")}`;
  }

  // "24 JUL 2026" o "24-jul-26"
  const withWord = trimmed.match(/^(\d{1,2})[\s\-/]+([a-zA-Zá-úÁ-Ú]{3,})[\s\-/]+(\d{2,4})/);
  if (withWord) {
    const [, dRaw, monthWord, yRaw] = withWord;
    const key = normalizeHeader(monthWord).slice(0, 3);
    const month = MONTH_WORDS[key];
    if (!month) return null;
    let year = Number(yRaw);
    if (yRaw.length === 2) year += year < 70 ? 2000 : 1900;
    if (!isRealDate(year, month, Number(dRaw))) return null;
    return `${year}-${String(month).padStart(2, "0")}-${dRaw.padStart(2, "0")}`;
  }

  return null;
}

export function matchType(raw: string): "expense" | "income" | null {
  const v = normalizeHeader(raw);
  if (!v) return null;
  if (["gasto", "gastos", "expense", "egreso", "cargo", "debito", "debe", "retiro", "compra"].includes(v)) {
    return "expense";
  }
  if (["ingreso", "ingresos", "income", "abono", "credito", "haber", "deposito"].includes(v)) {
    return "income";
  }
  return null;
}

/**
 * COMO SE LLAMA CADA CATEGORIA EN LOS ARCHIVOS DE VERDAD (12/08/2026).
 *
 * Solo se reconocian los nombres EXACTOS de Fino. Pero nadie escribe "comida" en su hoja de
 * calculo: escribe "alimentacion", que es lo que trae el Excel que el trajo. Y entonces la
 * categoria que se habia tomado el trabajo de poner acababa en "Otros".
 *
 * Aqui van los sinonimos que salen de verdad, no todos los imaginables: cada uno de mas es un
 * gasto que puede acabar en la categoria equivocada, y eso es peor que en "Otros" — en "Otros"
 * se ve que falta clasificarlo; en la equivocada, no.
 */
const SINONIMOS: Record<string, string> = {
  alimentacion: "comida",
  alimentos: "comida",
  comidas: "comida",
  restaurante: "comida",
  supermercado: "comida",
  mercado: "comida",
  movilidad: "transporte",
  pasajes: "transporte",
  taxi: "transporte",
  gasolina: "combustible",
  combustibles: "combustible",
  luz: "servicios",
  agua: "servicios",
  internet: "servicios",
  telefono: "servicios",
  recibos: "servicios",
  ropa: "compras",
  farmacia: "salud",
  medicinas: "salud",
  colegio: "educacion",
  universidad: "educacion",
  alquiler: "hogar",
  trabajo: "salario",
  sueldo: "salario",
  sueldos: "salario",
  planilla: "salario",
  honorarios: "freelance",
  venta: "venta",
  ventas: "venta",
};

export function matchCategory(
  raw: string,
  type: "expense" | "income",
  t: (k: string) => string
): string {
  const cats = type === "expense" ? EXPENSE_CATS : INCOME_CATS;
  const normalized = normalizeHeader(raw);
  if (normalized) {
    const byId = cats.find((c) => normalizeHeader(c.id) === normalized);
    if (byId) return byId.id;
    const byLabel = cats.find((c) => normalizeHeader(t(c.label)) === normalized);
    if (byLabel) return byLabel.id;
    // Y por sinonimo, PERO solo si el resultado es del tipo que toca: "venta" es categoria de
    // ingreso, y un gasto que dijera "venta" no puede acabar ahi.
    const porSinonimo = SINONIMOS[normalized];
    if (porSinonimo && cats.some((c) => c.id === porSinonimo)) return porSinonimo;
  }
  return type === "expense" ? "otros" : "otro_ingreso";
}

// ---------------------------------------------------------------------
// 5. LEER EL ARCHIVO COMPLETO
// ---------------------------------------------------------------------

export type RawRow = {
  date: string;
  amount: number;
  type: "expense" | "income";
  description: string;
  merchant: string;
  reference: string;
  categoryRaw: string;
  methodRaw: string;
  // Banco del que salió el archivo. Puede quedar vacío si no se pudo
  // reconocer: en ese caso el detector de repetidos simplemente no usa
  // esta señal, en vez de inventarse un banco equivocado.
  account?: string;
};

export type ParseResult =
  | {
      ok: true;
      rows: RawRow[];
      errorCount: number;
      /**
       * De las malas, cuantas traian monto pero NINGUNA fecha que se pudiera averiguar.
       *
       * Va aparte de errorCount porque son las unicas sobre las que se puede hacer algo: son
       * movimientos de verdad y basta con poner la fecha en la hoja. Ver el bucle.
       */
      sinFecha: number;
      headerIndex: number;
    }
  | { ok: false; reason: "empty" | "noTable" };

export function parseStatement(text: string, account?: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, reason: "empty" };

  const delimiter = detectDelimiter(lines);
  const header = findHeaderRow(lines, delimiter);
  if (!header) return { ok: false, reason: "noTable" };

  const { headerIndex, map } = header;
  const rows: RawRow[] = [];
  let errorCount = 0;
  let sinFecha = 0;

  // Lo que el archivo dice de sí mismo antes de empezar la tabla. Ver mesDeclaradoEn.
  const mesDelArchivo = mesDeclaradoEn(lines.slice(0, headerIndex));
  // La última fecha que se leyó de verdad, para las filas que no traen ninguna. Ver abajo.
  let ultimaFecha: string | null = null;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = parseDelimitedLine(lines[i], delimiter);
    const cellAt = (idx: number) => (idx === -1 ? "" : cells[idx] || "");

    /**
     * LA FECHA, POR TRES CAMINOS Y EN ESTE ORDEN.
     *
     * Salió de su hoja de control (12/08/2026), donde no había ni una fecha escrita y no se
     * importaba absolutamente nada. Las tres son formas normales de llenar una hoja a mano; la
     * app las trataba a todas como "fila mala".
     *
     *   1. La fecha escrita, como siempre.
     *   2. Solo el número del día ("5"), con el mes que declara el archivo arriba.
     *   3. HEREDADA DE LA FILA DE ARRIBA, y solo si la celda está VACÍA. Es como se escribe una
     *      hoja de verdad: la fecha una vez y debajo los tres gastos de ese día.
     *
     * Que el tercero exija la celda vacía no es un detalle. Una celda con algo que no se
     * entiende —"TOTAL", "Resumen"— casi nunca es un movimiento: es el pie de la tabla. Heredarle
     * la fecha de arriba metería la suma del mes como si fuera un gasto más, y eso descuadra los
     * totales sin que se vea.
     */
    const fechaCruda = cellAt(map.date);
    let date = parseDate(fechaCruda);
    if (!date) date = fechaDeDiaSuelto(fechaCruda, mesDelArchivo);
    if (!date && !fechaCruda.trim()) date = ultimaFecha;
    if (date) ultimaFecha = date;

    // El monto puede venir de tres formas: una columna única, o dos
    // columnas separadas de cargo (sale dinero) y abono (entra dinero).
    let value: number | null = null;
    let typeFromColumns: "expense" | "income" | null = null;

    if (map.charge !== -1 || map.credit !== -1) {
      const charge = parseAmount(cellAt(map.charge));
      const credit = parseAmount(cellAt(map.credit));
      if (charge !== null && charge !== 0) {
        value = Math.abs(charge);
        typeFromColumns = "expense";
      } else if (credit !== null && credit !== 0) {
        value = Math.abs(credit);
        typeFromColumns = "income";
      }
    }
    if (value === null && map.amount !== -1) {
      const single = parseAmount(cellAt(map.amount));
      if (single !== null && single !== 0) {
        value = Math.abs(single);
        // Sin columna de tipo, el signo manda: negativo = salió dinero.
        typeFromColumns = single < 0 ? "expense" : null;
      }
    }

    if (!date || value === null || value === 0) {
      errorCount++;
      // SE CUENTAN APARTE LAS QUE SOLO LES FALTA LA FECHA. Una fila con monto pero sin fecha es
      // un movimiento de verdad que se está perdiendo, y hay algo que hacer al respecto —poner
      // la fecha en la hoja—. Una fila sin monto suele ser un hueco o el pie de la tabla, y no
      // hay nada que hacer. Contarlas juntas como "3 con errores" mezcla las dos y no deja
      // actuar sobre ninguna.
      if (!date && value !== null && value !== 0) sinFecha++;
      continue;
    }

    const explicitType = map.type !== -1 ? matchType(cellAt(map.type)) : null;
    // Si nada nos dice qué es, asumimos GASTO: en un estado de cuenta la
    // enorme mayoría de líneas son gastos, y equivocarse hacia "ingreso"
    // inflaría el saldo de la persona (error más confuso).
    const type = explicitType ?? typeFromColumns ?? "expense";

    const description = cellAt(map.description);
    rows.push({
      date,
      amount: value,
      type,
      description,
      merchant: cellAt(map.merchant) || description,
      reference: cellAt(map.reference),
      categoryRaw: cellAt(map.category),
      methodRaw: cellAt(map.method),
      account,
    });
  }

  return { ok: true, rows, errorCount, sinFecha, headerIndex };
}

// Convierte el método de pago que dice el banco a uno de los de Fino.
// Si no lo reconoce, deja el texto tal cual (mejor eso que perderlo).
//
// Vive aquí, y no en la pantalla de importar, porque la captura automática
// de notificaciones necesita exactamente la misma conversión: si fueran dos
// copias, un arreglo en una se olvidaría en la otra.
export function matchMethod(raw: string, t: (k: string) => string): string {
  const normalized = normalizeHeader(raw);
  if (!normalized) return "cash";
  const byId = PAYMENT_METHODS.find((m) => m.id === normalized);
  if (byId) return byId.id;
  const byLabel = PAYMENT_METHODS.find((m) => normalizeHeader(t(m.labelKey)) === normalized);
  if (byLabel) return byLabel.id;
  return raw.trim() || "cash";
}

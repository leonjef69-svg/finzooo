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
import { amountInputError, isSafeMoneyAmount } from "@/utils/amount";
import { CURRENCIES, currencyDecimals } from "@/constants/currencies";
import { normalizeHeader } from "@/utils/importText";
export { normalizeHeader } from "@/utils/importText";

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
    let count = 0;
    let quoted = false;
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === '"') {
        if (quoted && sample[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && sample[i] === candidate) count++;
    }
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
    "referencia", "reference", "operacion", "nro operacion", "num operacion", "numero operacion", "numero de operacion",
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
  const map: ColumnMap = {
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
  // «Fecha de operación» es fecha, no un código repetido ni un abono.
  for (const key of Object.keys(map) as (keyof ColumnMap)[]) {
    if (key !== "date" && map[key] === map.date) map[key] = -1;
  }
  if (map.reference >= 0 && map.reference === map.description) {
    if (/^(?:nro|num|numero|codigo|cod)\b/.test(headers[map.reference])) map.description = -1;
    else map.reference = -1;
  }
  return map;
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
  if (isNaN(n) || !isSafeMoneyAmount(n)) return null;
  return isNegative ? -n : n;
}

/** Lector de archivos: rechaza agrupaciones rotas en vez de cambiar la cifra.
 * No modifica el lector compartido por voz, recibos y notificaciones. */
const importMoneyTokens = [...new Set([...CURRENCIES.flatMap(c => [c.id, c.symbol]), "S/.", "Bs.", "$"])]
  .sort((a, b) => b.length - a.length).map(token => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
const importMoneyPrefix = new RegExp(`^(?:S\\s*/\\s*\\.?|${importMoneyTokens})(?=\\s*[+-]?\\d)\\s*`, "i");
const importMoneySuffix = new RegExp(`\\s*(?:${importMoneyTokens})$`, "i");

export function parseImportAmount(raw: string, currency = "PEN"): number | null {
  let value = (raw || "").trim();
  const parentheses = /^\(.*\)$/.test(value);
  if (parentheses) value = value.slice(1, -1).trim();
  const leadingSign = value.match(/^[+-]\s*/)?.[0];
  let negative = value.startsWith("-") || parentheses;
  if (leadingSign) value = value.slice(leadingSign.length);
  value = value.replace(importMoneyPrefix, "").replace(importMoneySuffix, "").trim();
  if (leadingSign && /^[+-]/.test(value)) return null;
  negative = negative || value.startsWith("-");
  value = value.replace(/^[+-]\s*/, "");
  // Puntuación final de una cifra, por ejemplo «S/ 6.50.».
  if (/\d\.$/.test(value)) value = value.slice(0, -1);
  // Espacios solo como agrupación de miles, no para unir cifras rotas.
  if (/\s/.test(value)) {
    if (!/^\d{1,3}(?:[\s\u00a0]\d{3})+(?:[.,]\d{1,3})?$/.test(value)) return null;
    value = value.replace(/[\s\u00a0]/g, "");
  }
  if (!/^\d+(?:[.,]\d+)*$/.test(value)) return null;
  let normalized = value;
  if (value.includes(".") && value.includes(",")) {
    const decimal = value.lastIndexOf(".") > value.lastIndexOf(",") ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    const parts = value.split(decimal);
    if (parts.length !== 2 || !/^\d{1,3}$/.test(parts[1])) return null;
    const groups = parts[0].split(thousands);
    if (!/^\d{1,3}$/.test(groups[0]) || !groups.slice(1).every(g => /^\d{3}$/.test(g))) return null;
    normalized = `${groups.join("")}.${parts[1]}`;
  } else if (/[.,]/.test(value)) {
    const groups = value.split(/[.,]/);
    const thousands = (groups.length > 2 || currencyDecimals(currency) !== 3)
      && /^\d{1,3}$/.test(groups[0]) && groups[0] !== "0"
      && groups.slice(1).every(g => /^\d{3}$/.test(g));
    if (thousands) normalized = groups.join("");
    else if (groups.length === 2 && /^\d{1,3}$/.test(groups[1])) normalized = groups.join(".");
    else return null;
  }
  const amount = Number(normalized);
  if ((normalized.split(".")[1]?.length ?? 0) > currencyDecimals(currency) || amountInputError(normalized, currency)) return null;
  return isSafeMoneyAmount(amount) ? (negative ? -amount : amount) : null;
}

export type ImportOptions = {
  currency?: string;
  dateOrder?: "DMY" | "MDY";
  rowTypes?: Record<number, "expense" | "income">;
};

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
export function parseDate(raw: string, order: "DMY" | "MDY" = "DMY"): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?=$|[T\s])/);
  if (iso) {
    const [, y, m, d] = iso;
    if (!isRealDate(Number(y), Number(m), Number(d))) return null;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 24/07/2026 · 24-07-2026 · 24.07.2026 (y también con año de 2 cifras)
  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?=$|\s)/);
  if (dmy) {
    const [, first, second, yRaw] = dmy;
    const [dRaw, mRaw] = order === "MDY" ? [second, first] : [first, second];
    let year = Number(yRaw);
    if (yRaw.length === 2) year += year < 70 ? 2000 : 1900;
    if (!isRealDate(year, Number(mRaw), Number(dRaw))) return null;
    return `${year}-${mRaw.padStart(2, "0")}-${dRaw.padStart(2, "0")}`;
  }

  // "24 JUL 2026" o "24-jul-26"
  const withWord = trimmed.match(/^(\d{1,2})[\s\-/]+([a-zA-Zá-úÁ-Ú]{3,})[\s\-/]+(\d{4}|\d{2})(?=$|\s)/);
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
  /** Posición estable dentro del archivo, aunque cambie el formato de fecha. */
  sourceRow?: number;
  /** Mantener el selector visible después de resolver una fila dudosa. */
  typeUncertain?: boolean;
  typePending?: boolean;
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
      /**
       * Esas mismas filas, enteras salvo la fecha (que va vacia).
       *
       * Se devuelven en vez de tirarlas para poder preguntarle a la persona de que mes son. Es
       * lo unico que se puede hacer con una hoja como la suya: los montos y las categorias estan
       * escritos, y el mes solo lo sabe quien la lleno.
       */
      rowsSinFecha: RawRow[];
      headerIndex: number;
      needsTypeChoice: boolean;
      needsDateOrder: boolean;
    }
  | { ok: false; reason: "empty" | "noTable" };

export function parseStatement(text: string, account?: string, options: ImportOptions = {}): ParseResult {
  // Un campo CSV entre comillas puede ocupar varias líneas físicas.
  const lines: string[] = [];
  let record = "", quoted = false;
  for (const line of text.split(/\r?\n/)) {
    record += (record ? "\n" : "") + line;
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== '"') continue;
      if (quoted && line[i + 1] === '"') i++;
      else quoted = !quoted;
    }
    if (!quoted) { if (record.trim()) lines.push(record); record = ""; }
  }
  if (record.trim()) return { ok: false, reason: "noTable" };
  if (lines.length < 2) return { ok: false, reason: "empty" };

  const delimiter = detectDelimiter(lines);
  const header = findHeaderRow(lines, delimiter);
  if (!header) return { ok: false, reason: "noTable" };

  const { headerIndex, map } = header;
  const columnCount = parseDelimitedLine(lines[headerIndex], delimiter).length;
  const rows: RawRow[] = [];
  let errorCount = 0;
  let sinFecha = 0;
  const rowsSinFecha: RawRow[] = [];
  // En algunos extractos hay una sola columna Monto: cargos negativos y
  // abonos positivos. No se puede inferir el signo de un solo renglón: otros
  // bancos ponen TODOS los cargos en positivo. La decisión se toma al final
  // del archivo y solo para filas reales sin columna de tipo ni cargo/abono.
  const positivosSinTipo: RawRow[] = [];
  let hayCargoNegativo = false;
  let needsDateOrder = false;
  // Una fecha como 05/10 tiene dos lecturas. Una fecha inequívoca del mismo
  // archivo permite determinar el orden; si ambas convenciones se mezclan,
  // se pide una elección y las filas incompatibles quedan como errores.
  const numericDates = lines.slice(headerIndex + 1).map(line =>
    parseDelimitedLine(line, delimiter)[map.date] ?? "");
  const onlyDmy = numericDates.some(date => parseDate(date, "DMY") && !parseDate(date, "MDY"));
  const onlyMdy = numericDates.some(date => parseDate(date, "MDY") && !parseDate(date, "DMY"));
  const order = options.dateOrder ?? (onlyMdy && !onlyDmy ? "MDY" : "DMY");

  // Lo que el archivo dice de sí mismo antes de empezar la tabla. Ver mesDeclaradoEn.
  const mesDelArchivo = mesDeclaradoEn(lines.slice(0, headerIndex));
  // La última fecha que se leyó de verdad, para las filas que no traen ninguna. Ver abajo.
  let ultimaFecha: string | null = null;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = parseDelimitedLine(lines[i], delimiter);
    // Una coma decimal sin comillas en un CSV separado por comas no puede
    // recortar 6,50 a 6. Las columnas extra con datos indican una fila rota.
    if (cells.slice(columnCount).some(cell => cell.trim())) { errorCount++; continue; }
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
    // Un resumen no hereda la fecha de la compra anterior.
    if (!fechaCruda.trim() && /^(total(?:es)?(?: del (?:mes|periodo)| (?:general|gastos|ingresos|egresos|cargos|abonos))?|sub ?total|saldo (?:inicial|final|anterior|actual|disponible|contable))$/.test(normalizeHeader(cellAt(map.description)))) continue;
    let date = parseDate(fechaCruda, order);
    const otherDate = parseDate(fechaCruda, order === "DMY" ? "MDY" : "DMY");
    if (!options.dateOrder && ((date && otherDate && date !== otherDate && onlyDmy === onlyMdy)
      || (onlyDmy && onlyMdy))) needsDateOrder = true;
    if (!date) date = fechaDeDiaSuelto(fechaCruda, mesDelArchivo);
    if (!date && !fechaCruda.trim()) date = ultimaFecha;
    if (!date && fechaCruda.trim()) ultimaFecha = null;
    if (date) ultimaFecha = date;

    // El monto puede venir de tres formas: una columna única, o dos
    // columnas separadas de cargo (sale dinero) y abono (entra dinero).
    let value: number | null = null;
    let typeFromColumns: "expense" | "income" | null = null;
    let montoUnico: number | null = null;

    if (map.charge !== -1 || map.credit !== -1) {
      const charge = parseImportAmount(cellAt(map.charge), options.currency);
      const credit = parseImportAmount(cellAt(map.credit), options.currency);
      if ((charge && credit) || (cellAt(map.charge).trim() && charge === null)
        || (cellAt(map.credit).trim() && credit === null)) { errorCount++; continue; }
      if (charge !== null && charge !== 0) {
        value = Math.abs(charge);
        typeFromColumns = "expense";
      } else if (credit !== null && credit !== 0) {
        value = Math.abs(credit);
        typeFromColumns = "income";
      }
    }
    if (value === null && map.amount !== -1) {
      const single = parseImportAmount(cellAt(map.amount), options.currency);
      if (single !== null && single !== 0) {
        montoUnico = single;
        value = Math.abs(single);
        // Sin columna de tipo, el signo manda: negativo = salió dinero.
        typeFromColumns = single < 0 ? "expense" : /^\s*\+/.test(cellAt(map.amount)) ? "income" : null;
      }
    }

    // Una fila TOTAL con fecha inválida no decide la convención de todo el
    // archivo. Sí cuentan las filas sin fecha que se conservan para revisión.
    const explicitType = map.type !== -1 ? matchType(cellAt(map.type)) : null;
    if (montoUnico === null && explicitType && typeFromColumns && explicitType !== typeFromColumns) { errorCount++; continue; }
    const signoDeFilaReal = !explicitType && montoUnico !== null
      && (date !== null || !fechaCruda.trim());
    if (signoDeFilaReal && montoUnico !== null && montoUnico < 0) hayCargoNegativo = true;

    if (!date || value === null || value === 0) {
      errorCount++;
      // SE CUENTAN APARTE LAS QUE SOLO LES FALTA LA FECHA. Una fila con monto pero sin fecha es
      // un movimiento de verdad que se está perdiendo, y hay algo que hacer al respecto —poner
      // la fecha en la hoja—. Una fila sin monto suele ser un hueco o el pie de la tabla, y no
      // hay nada que hacer. Contarlas juntas como "3 con errores" mezcla las dos y no deja
      // actuar sobre ninguna.
      if (!date && !fechaCruda.trim() && value !== null && value !== 0) {
        sinFecha++;
        // Se guarda entera menos la fecha. Ver rowsSinFecha.
        const sinDia = cellAt(map.description);
        const filaSinFecha: RawRow = {
          sourceRow: i + 1,
          date: "",
          amount: value,
          type: (map.type !== -1 ? matchType(cellAt(map.type)) : null) ?? typeFromColumns ?? "expense",
          description: sinDia,
          merchant: cellAt(map.merchant) || sinDia,
          reference: cellAt(map.reference),
          categoryRaw: cellAt(map.category),
          methodRaw: cellAt(map.method),
          account,
        };
        rowsSinFecha.push(filaSinFecha);
        if (signoDeFilaReal && montoUnico !== null && montoUnico > 0 && !typeFromColumns) positivosSinTipo.push(filaSinFecha);
      }
      continue;
    }

    // El valor de respaldo conserva el contrato del lector. Al terminar se
    // marca cada dirección desconocida: no se muestra ni se guarda como gasto.
    const type = explicitType ?? typeFromColumns ?? "expense";

    const description = cellAt(map.description);
    const fila: RawRow = {
      sourceRow: i + 1,
      date,
      amount: value,
      type,
      description,
      merchant: cellAt(map.merchant) || description,
      reference: cellAt(map.reference),
      categoryRaw: cellAt(map.category),
      methodRaw: cellAt(map.method),
      account,
    };
    rows.push(fila);
    if (signoDeFilaReal && montoUnico !== null && montoUnico > 0 && !typeFromColumns) positivosSinTipo.push(fila);
  }

  for (const fila of positivosSinTipo) {
    if (hayCargoNegativo) {
      fila.type = "income";
      continue;
    }
    // Cada importe sin dirección se resuelve por separado. El tipo de
    // respaldo no se muestra ni se guarda mientras siga pendiente.
    fila.typeUncertain = true;
    const choice = fila.sourceRow === undefined ? undefined : options.rowTypes?.[fila.sourceRow];
    fila.typePending = choice !== "income" && choice !== "expense";
    if (!fila.typePending) fila.type = choice!;
  }

  return { ok: true, rows, errorCount, sinFecha, rowsSinFecha, headerIndex,
    needsTypeChoice: positivosSinTipo.some(row => row.typePending),
    needsDateOrder };
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

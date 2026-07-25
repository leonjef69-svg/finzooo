// MOTOR DE IMPORTACIÓN DE ESTADOS DE CUENTA
//
// Lee un archivo exportado por un banco y lo convierte en movimientos de
// Finzo. Está aparte de la pantalla a propósito: así se puede probar sin
// abrir la app y sin tocar nada visual.
//
// Está pensado para ser GENÉRICO. Cada banco arma su archivo a su manera
// (distintos nombres de columna, filas de basura antes de la tabla,
// montos en una o dos columnas...), así que en vez de escribir un lector
// por banco, el motor observa el archivo y se adapta.

import { EXPENSE_CATS, INCOME_CATS } from "@/constants/categories";

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

function findColumnIndex(headers: string[], aliases: readonly string[]): number {
  // Primero busca coincidencia exacta (más confiable)...
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  // ...y si no, que el encabezado contenga el nombre buscado.
  for (const alias of aliases) {
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
  | { ok: true; rows: RawRow[]; errorCount: number; headerIndex: number }
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

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = parseDelimitedLine(lines[i], delimiter);
    const cellAt = (idx: number) => (idx === -1 ? "" : cells[idx] || "");

    const date = parseDate(cellAt(map.date));

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

  return { ok: true, rows, errorCount, headerIndex };
}

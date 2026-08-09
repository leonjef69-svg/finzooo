// INTÉRPRETE DE BOLETAS
//
// Convierte el texto que sacó el lector de la foto en los datos de un gasto.
//
// Es el tercer intérprete de Finzo, y sigue las mismas reglas que los otros
// dos (utils/voiceParser.ts para la voz, utils/notificationParser.ts para los
// avisos del banco):
//
//  · No inventa. Si no encuentra el total, devuelve null y la pantalla lo
//    dice, en vez de poner un número cualquiera.
//  · Avisa de lo mal que leyó. `confidence` es lo que permite mostrar
//    "revisa los datos" cuando la foto salió mal, sin que la persona tenga
//    que darse cuenta sola.
//  · Todo lo que decide se puede corregir a mano antes de guardar.
//
// Está pensado para boletas peruanas: fecha con el día delante, soles como
// moneda por defecto, y el formato de comprobante electrónico de SUNAT.

import { parseAmount } from "@/utils/importEngine";

export type ReceiptRead = {
  /** Nombre del comercio, ya limpio de "S.A.C." y similares. */
  merchant: string;
  /** "AAAA-MM-DD", o vacío si no se encontró ninguna fecha creíble. */
  date: string;
  /** "HH:MM", o vacío. */
  time: string;
  /** Lo que hay que pagar. null si no se pudo determinar. */
  total: number | null;
  currency: "PEN" | "USD";
  /** Número del comprobante: "B001-00123456". */
  docNumber: string;
  /** RUC del comercio, 11 cifras. */
  ruc: string;
  /**
   * Qué tan fiable es lo de arriba:
   *  · "high"   — total, fecha y comercio, los tres encontrados.
   *  · "medium" — hay total, pero falta algo más.
   *  · "low"    — no hay total, o casi no se leyó nada. La pantalla debe
   *               pedir que se revise a mano.
   */
  confidence: "high" | "medium" | "low";
};

/** Deja un texto comparable: sin tildes, en minúsculas. */
function soften(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Arregla las confusiones típicas del lector DENTRO de un número.
 *
 * El lector devuelve "1O.9O" en vez de "10.90" más a menudo de lo que
 * parece, porque la O y el 0 de una impresora térmica son casi iguales.
 *
 * Solo se aplica a trozos que YA parecen un número (más cifras que letras).
 * Si se aplicara a todo, un comercio llamado "SOL" se convertiría en "5OL".
 */
function repairDigits(token: string): string {
  const digits = (token.match(/\d/g) ?? []).length;
  const letters = (token.match(/[a-zA-Z]/g) ?? []).length;
  if (digits === 0 || letters > digits) return token;
  return token
    .replace(/[oO]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/[sS]/g, "5")
    .replace(/[bB]/g, "8");
}

// Fechas: 28/07/2026, 28-07-26, 28.07.2026, y también 2026-07-28.
const DATE_DMY = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;
const DATE_YMD = /\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/;

// La hora, SOLO con dos puntos.
//
// Antes esto aceptaba también el punto, y se comía los montos: "23.50" se
// leía como las once y media de la noche y desaparecía antes de buscar el
// total. Cualquier boleta que terminara entre .00 y .59 con menos de 24
// soles se quedaba sin total — o sea, casi todas.
const TIME_RE = /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/;

// Solo se usa en una línea que ya dice "hora", donde no hay nada que
// confundir. Ahí sí vale el punto: alguna impresora escribe "HORA 14.35".
const TIME_LOOSE = /\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::([0-5]\d))?\b/;

// Comprobante electrónico de SUNAT: B001-00123456 (boleta), F001-... (factura).
/**
 * El número de la boleta: "B001-00012345".
 *
 * ENTRE LA SERIE Y EL NÚMERO NO SIEMPRE HAY UN GUION. Se pedía uno obligatorio, y con la
 * boleta real de una botica (08/08/2026) el número se quedó vacío: esa lo imprime
 * **"B008 N° 00664859"**, con la abreviatura de "número" en medio en vez del guion. No es
 * rareza de una cadena — es de las dos formas más comunes en Perú.
 *
 * Se acepta el guion **o** la abreviatura (N, N°, No, Nro), pero **no el espacio a secas**:
 * sin ninguna de las dos señales, un "F001 2026" suelto se leería como número de boleta.
 */
const DOC_RE = /\b([BFEbfe]\s?\d{3})\s*(?:[-–]|N(?:ro|[°ºo])?\.?)\s*[-–]?\s*(\d{1,8})\b/;
// RUC: 11 cifras que empiezan por 10, 15, 17 o 20.
const RUC_RE = /\b((?:10|15|17|20)\d{9})\b/;

/** Palabras que descartan una línea como nombre de comercio. */
const NOT_A_NAME = [
  "boleta", "factura", "ticket", "comprobante", "nota de", "venta electronica",
  "r.u.c", "ruc", "dni", "direccion", "telefono", "telf", "tel:", "sucursal",
  "caja", "cajero", "vendedor", "atendido", "gracias", "vuelva", "bienvenid",
  "av.", "av ", "jr.", "jr ", "calle", "urb.", "mz.", "lote", "psje",
  "nro", "n°", "serie", "correlativo",
];

/**
 * Saca todos los montos de una línea, en orden.
 *
 * Antes de buscar, borra las fechas y el RUC: si no, el "28" de "28/07/2026"
 * se leería como veintiocho soles, que es exactamente el error que ya
 * cometió el micrófono con "gastos de 28 de julio".
 */
function amountsIn(line: string): number[] {
  const clean = line
    .replace(DATE_YMD, " ")
    .replace(DATE_DMY, " ")
    .replace(RUC_RE, " ")
    .replace(DOC_RE, " ")
    .replace(TIME_RE, " ");

  const out: number[] = [];
  // Un monto puede venir pegado a la moneda ("S/11.90") o suelto ("11.90").
  const re = /(?:S\s*\/\.?|US\s*\$|\$|PEN|USD)?\s*(\d[\dOolI|,.]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const raw = repairDigits(m[1]).replace(/[.,]$/, "");
    const sinSeparadores = raw.replace(/[.,]/g, "");
    const tieneCentimos = /[.,]\d{1,2}$/.test(raw);
    // Un número suelto sin decimales y muy largo no es un precio: es un
    // código de barras, un número de caja o un teléfono.
    if (!tieneCentimos && sinSeparadores.length > 4) continue;
    /**
     * UN AÑO SUELTO NO ES UN MONTO. Cuatro cifras, sin céntimos y entre 1900 y 2100.
     *
     * ESTE FALLO SE VIO EN UNA BOLETA DE VERDAD (08/08/2026), y era el peor de los tres: la
     * app propuso **"Guardar S/ 2.021,00"** por un documento cuya cifra mayor de verdad era
     * 645,10. Lo que hizo fue coger el año.
     *
     * Y no es un caso raro: **toda** boleta lleva el año escrito, así que en cuanto no se
     * encuentra una línea de "TOTAL" y hay que quedarse con la cifra más grande, el año gana
     * casi siempre — es más grande que casi cualquier compra de diario.
     *
     * El filtro de arriba no lo cazaba por poco: mide "más de 4 cifras" y un año tiene 4.
     */
    if (!tieneCentimos && /^(19|20)\d\d$/.test(sinSeparadores)) continue;
    const value = parseAmount(raw);
    if (value !== null && value > 0 && value < 1_000_000) out.push(value);
  }
  return out;
}

/**
 * Puntúa una línea como candidata a ser el total.
 *
 * Una boleta tiene muchos números y varios se llaman parecido. Lo que
 * distingue al total no es una palabra sino la combinación: dice "total",
 * no dice "sub", y no es una línea de cómo se pagó.
 *
 * El caso que obliga a puntuar en vez de buscar "total" a secas:
 *
 *     TOTAL          S/ 11.90
 *     EFECTIVO       S/ 20.00     ← más grande, y también un monto
 *     VUELTO         S/  8.10
 *
 * Buscando el número mayor saldría el efectivo. Buscando la última línea con
 * un monto saldría el vuelto.
 */
function scoreAsTotal(softened: string): number {
  let score = 0;
  if (/\btotal\b/.test(softened)) score += 3;
  if (/\ba pagar\b|\bimporte\b|\bmonto\b/.test(softened)) score += 2;

  // Lo que NO es el total, aunque lleve la palabra al lado
  if (/\bsub\s?total\b/.test(softened)) score -= 6;
  if (/vuelto|cambio|recibido|entregado/.test(softened)) score -= 8;
  if (/efectivo|tarjeta|visa|mastercard|yape|plin|credito|debito/.test(softened)) score -= 6;
  if (/igv|i\.g\.v|gravad|inafect|exonerad|descuent|ahorr|propina/.test(softened)) score -= 5;
  if (/\bitems?\b|cantidad|unidades/.test(softened)) score -= 4;

  return score;
}

/** Convierte día/mes/año a "AAAA-MM-DD", o vacío si la fecha no existe. */
function toISO(day: number, month: number, year: number, now: Date): string {
  let y = year;
  if (y < 100) y += 2000;
  if (y < 2000 || y > now.getFullYear() + 1) return "";
  if (month < 1 || month > 12) return "";
  const daysInMonth = new Date(y, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return "";
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Busca la fecha de la boleta.
 *
 * Se prefiere la que va junto a la palabra "fecha" o "emision". Solo si no
 * hay ninguna así se toma la primera fecha creíble del texto, porque una
 * boleta puede traer también la fecha de vencimiento de la tarjeta o la de
 * una promoción.
 */
function findDate(lines: string[], now: Date): string {
  const tryLine = (line: string): string => {
    const ymd = line.match(DATE_YMD);
    if (ymd) {
      const iso = toISO(Number(ymd[3]), Number(ymd[2]), Number(ymd[1]), now);
      if (iso) return iso;
    }
    const dmy = line.match(DATE_DMY);
    if (dmy) {
      // En Perú el día va delante. "07/08/2026" es 7 de agosto, no 8 de julio.
      return toISO(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]), now);
    }
    return "";
  };

  /**
   * NO TODAS LAS FECHAS DE UN PAPEL VALEN LO MISMO, y por eso se busca en tres pasadas.
   *
   * En el documento real del 08/08/2026 había cuatro fechas, y la app cogió la primera que
   * decía "fecha": **FECHA DE INGRESO**, que era de dos meses antes que la de pago. El
   * movimiento habría quedado guardado en el mes equivocado — y eso, en una app de
   * presupuesto mensual, descuadra el mes entero sin que se vea de dónde viene.
   *
   * Primero la que dice explícitamente cuándo se emitió o se pagó; luego cualquiera que hable
   * de fecha, saltando las que se refieren a OTRA cosa (el ingreso a la empresa, un
   * vencimiento, un nacimiento); y solo al final, cualquier fecha suelta del papel.
   */
  const ES_OTRA_FECHA = /ingreso|nacimiento|vencimiento|caducidad|vence/;

  for (const line of lines) {
    if (!/emision|emitido|fecha de pago|f\.?\s*pago/.test(soften(line))) continue;
    const found = tryLine(line);
    if (found) return found;
  }
  for (const line of lines) {
    const s = soften(line);
    if (!/fecha/.test(s) || ES_OTRA_FECHA.test(s)) continue;
    const found = tryLine(line);
    if (found) return found;
  }
  for (const line of lines) {
    const found = tryLine(line);
    if (found) return found;
  }
  return "";
}

function findTime(lines: string[]): string {
  const pick = (line: string, re: RegExp): string => {
    const m = line.match(re);
    return m ? `${String(Number(m[1])).padStart(2, "0")}:${m[2]}` : "";
  };
  // En una línea que dice "hora" se acepta también el punto: ahí no hay
  // ningún monto con el que confundirse.
  for (const line of lines) {
    if (!/hora/.test(soften(line))) continue;
    const found = pick(line, TIME_LOOSE);
    if (found) return found;
  }
  for (const line of lines) {
    const found = pick(line, TIME_RE);
    if (found) return found;
  }
  return "";
}

/**
 * Palabras que delatan un negocio.
 *
 * Sirven para desempatar. Muchas boletas ponen la dirección arriba del
 * nombre, y una línea suelta como "MIRAFLORES" —que es un distrito— parece
 * un nombre tan válido como cualquier otro. Si alguna de las primeras
 * líneas trae una de estas palabras, esa gana.
 */
const LOOKS_LIKE_BUSINESS = [
  "restaurant", "polleria", "cevicheria", "chifa", "pizzeria", "cafe",
  "bodega", "minimarket", "market", "super", "tienda", "comercial",
  "farmacia", "botica", "grifo", "estacion", "servicentro",
  "distribuidora", "importaciones", "corporacion", "inversiones",
  "hotel", "hostal", "clinica", "veterinaria", "libreria", "ferreteria",
];

function cleanName(line: string): string {
  return line
    .trim()
    /**
     * "InRetail Pharma S.A - INKA FARMA" → "INKA FARMA".
     *
     * Muchas boletas imprimen el nombre LEGAL y detrás el COMERCIAL, separados por un guion.
     * El legal no lo ha oído nadie: en la boleta de la botica (08/08/2026) el gasto habría
     * quedado guardado como "InRetail Pharma", y eso no se encuentra después buscando "inka".
     *
     * Solo se corta cuando delante del guion hay una **forma jurídica** (S.A., S.A.C.,
     * E.I.R.L.…). Sin esa condición, "PANADERIA DON JOSE - SUCURSAL 2" se quedaría en
     * "SUCURSAL 2", que es peor que no tocar nada.
     */
    .replace(/^.*\b(?:S\.?A\.?C?\.?|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?|S\.?A\.?A\.?)\s*[-–]\s*(?=[^\s]*[a-zA-Z]{3})/i, "")
    // Las formas jurídicas no son parte del nombre de la tienda para nadie
    // que no sea un contador.
    .replace(/\s*[.,]?\s*\b(S\.?A\.?C?\.?|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?|S\.?A\.?A\.?)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 40)
    .trim();
}

/**
 * Saca el nombre del comercio.
 *
 * Está casi siempre en las primeras líneas, antes del RUC y de la palabra
 * "BOLETA". Se recorren solo las primeras ocho: más abajo empiezan los
 * productos, y un paquete de fideos no es el nombre de la tienda.
 */
function findMerchant(lines: string[]): string {
  /**
   * "RAZON SOCIAL: SYG S.A.C" → "SYG". El nombre está DESPUÉS de la etiqueta.
   *
   * Va primero porque cuando esa etiqueta aparece, lo que sigue es el nombre de verdad y no
   * hay que adivinar nada. Visto en una boleta real el 08/08/2026.
   */
  for (const line of lines.slice(0, 10)) {
    const m = /raz[oó]n\s+social\s*:?\s*(.+)/i.exec(line);
    const valor = m?.[1]?.trim() ?? "";
    if (valor.length >= 3 && /[a-zA-Z]{3}/.test(valor)) return cleanName(valor);
  }

  const candidates: string[] = [];
  for (const line of lines.slice(0, 8)) {
    const s = soften(line).trim();
    if (s.length < 3) continue;
    if (NOT_A_NAME.some((word) => s.includes(word))) continue;
    // Al menos tres letras seguidas: descarta códigos y líneas de guiones.
    if (!/[a-z]{3}/.test(s)) continue;
    /**
     * UNA ETIQUETA SOLA NO ES EL NOMBRE DE NADIE.
     *
     * En la boleta real del 08/08/2026 la app propuso el comercio **"RAZON SoCIAL:"** — se
     * quedó con el rótulo porque el lector partió la línea y dejó la etiqueta sin su valor.
     *
     * Una línea que acaba en dos puntos está anunciando lo que viene después, no diciéndolo.
     * Descartarla es preferible a guardarla: un movimiento que dice "RAZON SOCIAL:" en el
     * comercio no se puede ni buscar después.
     */
    if (/:\s*$/.test(line.trim())) continue;
    candidates.push(line);
  }

  const named = candidates.find((line) =>
    LOOKS_LIKE_BUSINESS.some((word) => soften(line).includes(word))
  );
  const chosen = named ?? candidates[0];
  return chosen ? cleanName(chosen) : "";
}

/**
 * Lee una boleta a partir del texto que devolvió el lector.
 *
 * `now` se puede pasar para poder probar el resultado sin depender del reloj.
 */
export function parseReceipt(text: string, now: Date = new Date()): ReceiptRead {
  const lines = (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const merchant = findMerchant(lines);
  const date = findDate(lines, now);
  const time = findTime(lines);

  const whole = soften(lines.join(" "));
  // Sin ninguna señal se asume soles: la app es peruana y el 99% de las
  // boletas que va a ver están en soles.
  const currency: "PEN" | "USD" = /us\s*\$|\busd\b|dolar/.test(whole) ? "USD" : "PEN";

  const docMatch = text.match(DOC_RE);
  const docNumber = docMatch ? `${docMatch[1].replace(/\s/g, "").toUpperCase()}-${docMatch[2]}` : "";
  const rucMatch = text.match(RUC_RE);
  const ruc = rucMatch ? rucMatch[1] : "";

  // El total: se puntúan todas las líneas y gana la mejor. Si empatan varias
  // (pasa con "TOTAL" y "TOTAL A PAGAR"), gana la última, que es la de
  // abajo del papel.
  let bestScore = 0;
  let total: number | null = null;
  for (const line of lines) {
    const score = scoreAsTotal(soften(line));
    if (score <= 0) continue;
    const amounts = amountsIn(line);
    if (amounts.length === 0) continue;
    // El monto de una línea de total es el último: "TOTAL 3 ITEMS S/ 11.90".
    const amount = amounts[amounts.length - 1];
    if (total === null || score >= bestScore) {
      bestScore = score;
      total = amount;
    }
  }

  // Red de seguridad: sin ninguna línea que diga "total", se toma el monto
  // más grande de la boleta. Acierta a menudo, pero no siempre, así que esto
  // baja la confianza a "low" y la pantalla pedirá que se revise.
  let guessed = false;
  if (total === null) {
    const all = lines.flatMap(amountsIn);
    if (all.length > 0) {
      total = Math.max(...all);
      guessed = true;
    }
  }

  const found = [total !== null && !guessed, date !== "", merchant !== ""].filter(Boolean).length;
  const confidence: ReceiptRead["confidence"] =
    total === null || guessed ? "low" : found === 3 ? "high" : "medium";

  return { merchant, date, time, total, currency, docNumber, ruc, confidence };
}

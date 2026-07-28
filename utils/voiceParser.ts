// INTÉRPRETE DE VOZ
//
// Convierte lo que la persona dijo ("gasté 30 soles en KFC") en un
// movimiento de Finzo.
//
// Es primo del intérprete de notificaciones (utils/notificationParser.ts),
// pero con reglas propias a propósito: un aviso del banco y una frase
// hablada no se parecen en nada. El banco escribe siempre igual; una
// persona dice "gasté", "pagué", "se me fue", y a veces dice el número con
// letras porque el reconocimiento de voz lo escribió así.
//
// Diferencia importante con las notificaciones: ahí, ante la duda, no se
// registra nada. Aquí sí se arriesga a suponer, porque la persona está
// mirando la pantalla y ve una confirmación antes de guardar. Lo único
// que no se inventa es el monto: sin monto no hay movimiento.

import { parseAmount, type RawRow } from "@/utils/importEngine";

export type VoiceFailure =
  | "empty" // no se escuchó nada
  | "noAmount"; // se escuchó algo, pero sin un monto reconocible

export type VoiceParse =
  | { ok: true; row: RawRow }
  | { ok: false; reason: VoiceFailure };

// Números escritos con letras. El reconocimiento de voz de Google casi
// siempre devuelve dígitos ("30"), pero con números chicos a veces escribe
// la palabra ("treinta"), y sin esto esas frases se perderían.
//
// OJO: "un" y "una" NO están aquí a propósito, aunque valgan 1. Si
// estuvieran, "gasté un montón en el mercado" se registraría como un gasto
// de S/ 1. Quien quiera anotar un sol dirá el número.
const NUM_WORDS: Record<string, number> = {
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200,
  trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600,
  setecientos: 700, ochocientos: 800, novecientos: 900, mil: 1000,
};

// Entró dinero. Se revisan antes que los gastos, igual que en las
// notificaciones, porque algunas frases comparten palabras.
const INCOME_VERBS = [
  "recibi", "me pagaron", "me pago", "cobre", "gane", "me depositaron",
  "me deposito", "me transfirieron", "me dieron", "entro", "ingreso",
  "me llego", "me yapearon",
];

// Palabras que separan el monto del comercio, o que sobran en una frase
// hablada. Marcan dónde empieza y dónde termina el nombre.
const FILLER = new Set([
  "de", "del", "en", "el", "la", "los", "las", "un", "una", "unos", "unas",
  "por", "para", "con", "y", "a", "al", "mi", "mis", "tu", "su", "me", "se",
  "lo", "le", "que", "soles", "sol", "nuevos", "plata", "dinero",
]);

// Palabras de relleno que SÍ pueden ir dentro de un nombre: "bodega de Don
// Pepe", "casa de cambio". Se aceptan solo en medio, nunca al final, y solo
// estas dos: "por" o "para" en medio ya serían el resto de la frase.
const CONNECTORS = new Set(["de", "del"]);

// Artículos que pueden ir entre el conector y el nombre: "pan DE LA bodega".
const ARTICLES = new Set(["la", "el", "los", "las"]);

// Raíces de los verbos de la propia frase y de las palabras de tiempo. Si
// la extracción del nombre llega a una de estas, el nombre ya terminó.
const PHRASE_ROOTS = [
  "gast", "pag", "compr", "invert", "cost", "recib", "cobr",
  "gan", "deposit", "ingres", "retir", "yape", "consum", "transfir",
  "hoy", "ayer", "anteayer", "manana", "hace", "dia", "semana", "mes",
];

/**
 * Deja una palabra en su forma comparable: sin tildes, en minúsculas y sin
 * signos. Se hace palabra por palabra (y NO con normalizeHeader) por dos
 * razones que costaron errores reales:
 *
 *  1. normalizeHeader borra los puntos, así que "45.50" se convertía en
 *     "45 50" y el monto salía 45.
 *  2. Al partir una palabra en dos, las posiciones dejaban de coincidir con
 *     las del texto original, y el nombre del comercio salía corrido.
 */
function soften(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¡!¿?;:"'()]/g, "")
    .replace(/[.,]+$/, "");
}

/** Convierte una tira de palabras-número en su valor: "treinta y cinco" → 35. */
function spelledToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let found = false;

  for (const w of words) {
    if (w === "y") continue;
    const value = NUM_WORDS[w];
    if (value === undefined) return null;
    found = true;
    if (value === 1000) {
      // "dos mil" = 2 × 1000; "mil" solo = 1 × 1000.
      current = (current || 1) * 1000;
      total += current;
      current = 0;
    } else {
      current += value;
    }
  }

  return found ? total + current : null;
}

/** Busca la primera tira de palabras-número a partir de cierta posición. */
function findSpelledRun(tokens: string[], from: number): { value: number; end: number } | null {
  let i = from;
  while (i < tokens.length) {
    if (NUM_WORDS[tokens[i]] === undefined) {
      i++;
      continue;
    }
    const run: string[] = [];
    while (i < tokens.length && (NUM_WORDS[tokens[i]] !== undefined || (tokens[i] === "y" && run.length > 0))) {
      run.push(tokens[i]);
      i++;
    }
    while (run.length > 0 && run[run.length - 1] === "y") run.pop();
    const value = spelledToNumber(run);
    if (value !== null && value > 0) return { value, end: i };
  }
  return null;
}

/**
 * Saca el monto. Acepta "30", "30.50", "S/30", "treinta" y
 * "treinta con cincuenta" (la forma de decir los céntimos en Perú).
 */
function findAmount(tokens: string[]): number | null {
  // Primero con dígitos, que es lo que devuelve el reconocimiento de voz
  // casi siempre.
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].replace(/^s\/+\.?/, ""); // "s/30" → "30"
    if (!/^\d+([.,]\d{1,2})?$/.test(token)) continue;

    const whole = parseAmount(token);
    if (whole === null || whole <= 0) continue;

    // "30 con 50" = 30.50
    if (Number.isInteger(whole) && tokens[i + 1] === "con" && /^\d{1,2}$/.test(tokens[i + 2] ?? "")) {
      return whole + Number(tokens[i + 2]) / 100;
    }
    return whole;
  }

  // Si no, con letras.
  const run = findSpelledRun(tokens, 0);
  if (!run) return null;

  if (tokens[run.end] === "con") {
    const cents = findSpelledRun(tokens, run.end + 1);
    if (cents && cents.value < 100) return run.value + cents.value / 100;
  }
  return run.value;
}

/** ¿Esta palabra puede ser parte del nombre de un comercio? */
function looksLikeName(word: string): boolean {
  if (word.length <= 1) return false;
  if (FILLER.has(word) || NUM_WORDS[word] !== undefined) return false;
  if (PHRASE_ROOTS.some((root) => word.startsWith(root))) return false;
  // Solo letras y números, empezando por letra. Deja fuera al "S/" del
  // monto, que si no se colaba como si fuera el nombre del comercio.
  return /^[a-z][a-z0-9]*$/.test(word);
}

/**
 * Saca en qué se gastó. Devuelve las palabras del texto ORIGINAL (con sus
 * mayúsculas y tildes) para que "KFC" no acabe escrito "kfc" en la lista.
 *
 * Se salta el relleno del principio y corta en la primera palabra que ya no
 * encaja: "gasté 30 en el mercado" da "mercado", y "gasté 30 en KFC ayer"
 * da solo "KFC".
 */
function findMerchant(rawWords: string[], tokens: string[]): string {
  const picked: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!looksLikeName(token)) {
      // "de" y "del" pueden ir DENTRO del nombre ("bodega de Don Pepe",
      // "pan de la bodega"), pero solo si el nombre ya empezó y si después
      // viene otro nombre — con un artículo en medio como mucho. Así no se
      // arrastra el resto de la frase ("KFC por la tarde" queda en "KFC").
      if (picked.length > 0 && CONNECTORS.has(token)) {
        if (looksLikeName(tokens[i + 1] ?? "")) {
          picked.push(rawWords[i]);
          continue;
        }
        if (ARTICLES.has(tokens[i + 1] ?? "") && looksLikeName(tokens[i + 2] ?? "")) {
          picked.push(rawWords[i], rawWords[i + 1]);
          i++;
          continue;
        }
      }
      if (picked.length > 0) break; // el nombre ya empezó: aquí termina
      continue; // todavía era relleno del principio
    }

    picked.push(rawWords[i].replace(/[.,;:!¡?¿]+$/, ""));
    if (picked.length >= 5) break;
  }

  // Ni un conector ni un artículo pueden quedar al final: "bodega de" y
  // "pan de la" no son nombres.
  while (picked.length > 0) {
    const last = soften(picked[picked.length - 1]);
    if (!CONNECTORS.has(last) && !ARTICLES.has(last)) break;
    picked.pop();
  }

  const name = picked.join(" ");
  return name.length >= 2 && name.length <= 40 ? name : "";
}

/** Fecha en formato "AAAA-MM-DD", en hora local. */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "ayer" y "anteayer" mueven la fecha; cualquier otra cosa es hoy. */
function findDate(normalized: string, now: Date): string {
  const d = new Date(now);
  if (normalized.includes("anteayer")) d.setDate(d.getDate() - 2);
  else if (normalized.includes("ayer")) d.setDate(d.getDate() - 1);
  return toISO(d);
}

/**
 * Convierte una frase hablada en un movimiento.
 * `now` se puede pasar para poder probar el resultado sin depender del reloj.
 */
export function parseVoice(transcript: string, now: Date = new Date()): VoiceParse {
  const original = (transcript ?? "").trim();
  if (!original) return { ok: false, reason: "empty" };

  // Una sola partida en palabras, y de ahí salen las dos versiones: la
  // original (para mostrar) y la comparable (para entender). Al ser la
  // misma cantidad de palabras, las posiciones siempre coinciden.
  const rawWords = original.split(/\s+/);
  const tokens = rawWords.map(soften);
  const normalized = tokens.join(" ");
  if (!normalized.trim()) return { ok: false, reason: "empty" };

  const amount = findAmount(tokens);
  if (amount === null) return { ok: false, reason: "noAmount" };

  // Sin verbo reconocible se asume gasto: es lo que la gente registra el
  // 90% de las veces, y la pantalla de confirmación deja cambiarlo de un
  // toque antes de guardar.
  const isIncome = INCOME_VERBS.some((v) => normalized.includes(v));
  const type: "expense" | "income" = isIncome ? "income" : "expense";

  const merchant = findMerchant(rawWords, tokens);

  return {
    ok: true,
    row: {
      date: findDate(normalized, now),
      amount,
      type,
      description: merchant,
      merchant,
      reference: "",
      categoryRaw: "",
      methodRaw: "",
    },
  };
}

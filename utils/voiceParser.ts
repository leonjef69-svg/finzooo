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
  // "typeSaid" avisa si la persona DIJO si era gasto o ingreso ("gasté 20",
  // "recibí 500") o si se supuso. Cuando lo dijo, la pantalla de
  // confirmación no ofrece cambiarlo: preguntar "¿gasto o ingreso?" a quien
  // acaba de decir "gasté" sobra, y ofrecer el contrario como si fuera igual
  // de probable invita a tocarlo por error.
  | { ok: true; rows: RawRow[]; typeSaid: boolean }
  | { ok: false; reason: VoiceFailure };

// Tope de movimientos por frase.
//
// Estaba en 6, y era un error: quien volvía del mercado y dictaba diez
// compras seguidas perdía las cuatro últimas SIN QUE NADIE SE LO DIJERA —
// justo el fallo que este archivo existe para evitar.
//
// Ahora es un número que nadie alcanza hablando de corrido (el propio
// reconocedor de Android corta antes, apenas te quedas callado un segundo).
// Y el tope real ya no es este número: es que la pantalla de confirmación
// muestra la lista completa antes de guardar nada, así que lo que se
// registra es siempre lo que se vio.
const MAX_ROWS = 30;

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

// Salió dinero. Solo se usan para decidir el tipo de CADA movimiento
// cuando en una misma frase se mezclan gastos e ingresos.
const EXPENSE_VERBS = [
  "gaste", "pague", "compre", "invert", "me costo", "costo", "se me fue",
  "salio", "yapee", "consumi", "deposite", "retire",
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
const CONNECTORS = new Set(["de", "del", "para"]);

// Artículos que pueden ir entre el conector y el nombre: "pan DE LA bodega".
// "lo" está por "lomo a LO pobre", que sin él se quedaba en "lomo".
const ARTICLES = new Set(["la", "el", "los", "las", "lo"]);

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

// Un monto encontrado y dónde estaba: "start" es la palabra donde empieza y
// "end" la primera palabra que ya no es parte de él (contando los céntimos
// de "treinta con cincuenta").
type AmountHit = { value: number; start: number; end: number };

/**
 * Saca TODOS los montos de la frase, en el orden en que se dijeron.
 *
 * Que sean todos y no solo el primero es lo que permite decir varias cosas
 * de corrido: "gasté 10 en una hamburguesa y 20 en una gaseosa". Antes se
 * registraba solo la hamburguesa y los 20 soles se perdían sin avisar.
 *
 * Acepta "30", "30.50", "S/30", "treinta" y "treinta con cincuenta".
 */
/**
 * ¿Este número es CUÁNTAS COSAS y no cuánto dinero?
 *
 * "gasté 10 en 2 mandarinas" registraba DOS movimientos: uno de S/ 10 sin nombre y
 * otro de S/ 2 llamado "mandarinas". El de 2 no existió nunca, y el de 10 se quedaba
 * sin nombre, así que caía en "Otros". Encontrado el 07/08/2026 probando el intérprete
 * con frases de verdad, no leyéndolo.
 *
 * La señal es la de la propia forma de hablar: un número es cantidad cuando va justo
 * después de "en" o "de" y justo antes del nombre de la cosa. Nadie dice "gasté en 10
 * soles"; sí se dice "en 2 mandarinas", "de 12 huevos", "en 3 kilos".
 *
 * Es importante que sea EXACTAMENTE eso y no algo más suelto:
 *
 *  · "la cuenta de 45 soles" → detrás va "soles", que no es el nombre de nada, así que
 *    los 45 siguen siendo dinero. Bien.
 *  · "gasté 10 en pan y 20 en leche" → el 20 va detrás de "y", no de "en". Bien.
 *  · "una caja de 12 huevos por 20 soles" → el 12 es cantidad y el 20 dinero. Bien.
 */
function esCantidad(tokens: string[], start: number, end: number): boolean {
  const antes = tokens[start - 1];
  if (antes !== "en" && antes !== "de") return false;
  return looksLikeName(tokens[end] ?? "");
}

/**
 * ¿Este número es UNA HORA y no dinero?
 *
 * "gasté 30 en pan a las 5" registraba el pan Y un gasto de S/ 5 que no existió. Es el
 * mismo fallo que el de la cantidad, con otra ropa, y sale de lo mismo: cualquier
 * número de la frase se tomaba por dinero.
 *
 * Se pide el "a" además del artículo, porque "las 5" a secas puede ser otra cosa
 * ("las 5 mandarinas" ya lo agarra esCantidad). Cubre "a las 5" y "a la 1", que es como
 * se dice la hora.
 */
function esHora(tokens: string[], start: number): boolean {
  const antes = tokens[start - 1];
  return (antes === "las" || antes === "la") && tokens[start - 2] === "a";
}

function findAmounts(tokens: string[]): AmountHit[] {
  const hits: AmountHit[] = [];
  let i = 0;

  while (i < tokens.length && hits.length < MAX_ROWS) {
    const token = tokens[i].replace(/^s\/+\.?/, ""); // "s/30" → "30"

    if (/^\d+([.,]\d{1,2})?$/.test(token)) {
      const whole = parseAmount(token);
      if (whole !== null && whole > 0 && !esCantidad(tokens, i, i + 1) && !esHora(tokens, i)) {
        // "30 con 50" = 30.50
        if (Number.isInteger(whole) && tokens[i + 1] === "con" && /^\d{1,2}$/.test(tokens[i + 2] ?? "")) {
          hits.push({ value: whole + Number(tokens[i + 2]) / 100, start: i, end: i + 3 });
          i += 3;
          continue;
        }
        hits.push({ value: whole, start: i, end: i + 1 });
        i += 1;
        continue;
      }
    }

    if (NUM_WORDS[tokens[i]] !== undefined) {
      const run = findSpelledRun(tokens, i);
      // La misma regla vale dicho con letras: "gasté 10 en dos mandarinas".
      //
      // Y se salta la cantidad ENTERA, no solo su primera palabra. Con "en treinta y
      // cinco mandarinas", saltar una sola dejaba suelto el "cinco" — que ya no venía
      // detrás de "en" y se colaba como un gasto de S/ 5 que nadie hizo.
      if (run && run.end > i && (esCantidad(tokens, i, run.end) || esHora(tokens, i))) {
        i = run.end;
        continue;
      }
      if (run && run.end > i) {
        if (tokens[run.end] === "con") {
          const cents = findSpelledRun(tokens, run.end + 1);
          if (cents && cents.value < 100) {
            hits.push({ value: run.value + cents.value / 100, start: i, end: cents.end });
            i = cents.end;
            continue;
          }
        }
        hits.push({ value: run.value, start: i, end: run.end });
        i = run.end;
        continue;
      }
    }

    i++;
  }

  return hits;
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
      // "POLLO A LA BRASA" SE QUEDABA EN "POLLO", y en Perú eso es media carta:
      // "arroz a la cubana", "lomo a lo pobre", "pescado a la chorrillana".
      //
      // Se pide "a" MÁS artículo MÁS nombre, las tres cosas. Un "a" suelto no vale, y
      // por eso "gasté 30 en pan a las 5" no se lleva la hora: detrás del artículo hay
      // un número, no un nombre.
      if (
        picked.length > 0 &&
        token === "a" &&
        ARTICLES.has(tokens[i + 1] ?? "") &&
        looksLikeName(tokens[i + 2] ?? "")
      ) {
        picked.push(rawWords[i], rawWords[i + 1]);
        i++;
        continue;
      }
      if (picked.length > 0) break; // el nombre ya empezó: aquí termina
      continue; // todavía era relleno del principio
    }

    picked.push(rawWords[i].replace(/[.,;:!¡?¿]+$/, ""));
    if (picked.length >= 5) break;
  }

  // Ni un conector ni un artículo pueden quedar al final: "bodega de", "pan de la" y
  // "pollo a la" no son nombres. El "a" entra aquí por lo mismo que arriba.
  while (picked.length > 0) {
    const last = soften(picked[picked.length - 1]);
    if (!CONNECTORS.has(last) && !ARTICLES.has(last) && last !== "a") break;
    picked.pop();
  }

  const name = picked.join(" ");
  return name.length >= 2 && name.length <= 40 ? name : "";
}

// Los meses como los dice una persona. "setiembre" y "septiembre" valen
// igual: en Perú se escribe de las dos formas y el reconocedor devuelve una
// o la otra según el día.
const MONTH_NAMES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, setiembre: 8, septiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11,
};

/**
 * Una fecha dicha en voz alta, y —esto es lo importante— QUÉ PALABRAS ocupa.
 *
 * Saber dónde está permite tacharla antes de buscar montos. Sin eso, el "28"
 * de "gastos de 28 de julio" se leía como un monto de S/ 28 y "julio" como
 * el nombre de lo comprado: la app registraba un gasto de S/ 28 llamado
 * "julio" que nunca existió.
 *
 * "day" o "month" pueden venir en null: "de julio" no dice ningún día, y
 * "el día 28" no dice ningún mes.
 */
export type SpokenDate = {
  day: number | null;
  month: number | null;
  year: number;
  /** Primera palabra de la fecha. */
  from: number;
  /** Primera palabra que ya NO es parte de la fecha. */
  to: number;
};

/** Lee un número en la posición dada, en dígitos o en letras. */
function numberAt(tokens: string[], i: number): { value: number; end: number } | null {
  const token = (tokens[i] ?? "").replace(/^s\/+\.?/, "");
  if (/^\d{1,2}$/.test(token)) return { value: Number(token), end: i + 1 };
  if (NUM_WORDS[tokens[i] ?? ""] !== undefined) {
    const run = findSpelledRun(tokens, i);
    if (run && run.end > i) return { value: run.value, end: run.end };
  }
  return null;
}

/**
 * El año que corresponde a un mes dicho a secas.
 *
 * Un mes suelto se entiende como el más reciente que ya pasó o está en
 * curso: en julio de 2026, "mayo" es mayo de 2026, pero "diciembre" es
 * diciembre de 2025. Nadie pregunta por un mes que todavía no ha ocurrido.
 */
function yearForMonth(month: number, now: Date): number {
  return month > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
}

/**
 * Busca una fecha en la frase. Devuelve la primera que encuentre, o null.
 *
 * `allowBareDay` permite entender un día suelto ("los gastos del 28"). Está
 * apagado al anotar movimientos a propósito: ahí un número suelto es casi
 * siempre el monto, y confundirlos costaría un gasto perdido. Al PREGUNTAR
 * no hay ese riesgo, porque una pregunta no lleva monto.
 */
export function findSpokenDate(
  tokens: string[],
  now: Date,
  allowBareDay = false
): SpokenDate | null {
  const y = now.getFullYear();

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];

    // "hoy", "ayer", "anteayer"
    const shift = w === "hoy" ? 0 : w === "ayer" ? -1 : w === "anteayer" ? -2 : null;
    if (shift !== null) {
      const d = new Date(now);
      d.setDate(d.getDate() + shift);
      return { day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), from: i, to: i + 1 };
    }

    // "28 de julio" / "veintiocho de julio"
    const num = numberAt(tokens, i);
    if (num && num.value >= 1 && num.value <= 31) {
      const after = tokens[num.end];
      const monthWord = after === "de" || after === "del" ? tokens[num.end + 1] : after;
      const month = MONTH_NAMES[monthWord ?? ""];
      if (month !== undefined) {
        const to = after === "de" || after === "del" ? num.end + 2 : num.end + 1;
        return withYear({ day: num.value, month, from: i, to }, tokens, now);
      }
      // "el día 28" — un día sin mes. Se pide "dia" delante justamente para
      // no tragarse un monto.
      if (tokens[i - 1] === "dia" || tokens[i - 1] === "dias") {
        return { day: num.value, month: null, year: y, from: i - 1, to: num.end };
      }
      if (allowBareDay && (tokens[i - 1] === "el" || tokens[i - 1] === "del")) {
        return { day: num.value, month: null, year: y, from: i - 1, to: num.end };
      }
    }

    // Un mes a secas: "de julio", "en mayo"
    const month = MONTH_NAMES[w];
    if (month !== undefined) {
      return withYear({ day: null, month, from: i, to: i + 1 }, tokens, now);
    }
  }

  return null;
}

/** Pega el año: el que se dijo a mano si lo hay, y si no el que toca. */
function withYear(
  hit: { day: number | null; month: number; from: number; to: number },
  tokens: string[],
  now: Date
): SpokenDate {
  // "28 de julio de 2025": un año dicho a mano manda sobre lo que se supone,
  // y sus palabras también son parte de la fecha.
  const skip = tokens[hit.to] === "de" || tokens[hit.to] === "del" ? 1 : 0;
  const said = tokens[hit.to + skip];
  if (said && /^20\d{2}$/.test(said)) {
    return { ...hit, year: Number(said), to: hit.to + skip + 1 };
  }
  return { ...hit, year: yearForMonth(hit.month, now) };
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

  // La fecha se busca ANTES que los montos y sus palabras quedan tachadas.
  // Si no, el "28" de "el 28 de julio" se registraba como un gasto de S/ 28
  // y "julio" como el nombre de lo comprado.
  const spoken = findSpokenDate(tokens, now);
  const maskedTokens = tokens.slice();
  const maskedRaw = rawWords.slice();
  if (spoken) {
    for (let i = spoken.from; i < spoken.to; i++) {
      maskedTokens[i] = "";
      maskedRaw[i] = "";
    }
  }

  const hits = findAmounts(maskedTokens);
  if (hits.length === 0) return { ok: false, reason: "noAmount" };

  // Tipo general de la frase. Sin verbo reconocible se asume gasto: es lo
  // que la gente registra el 90% de las veces, y la pantalla de
  // confirmación deja cambiarlo de un toque antes de guardar.
  const saidIncome = INCOME_VERBS.some((v) => normalized.includes(v));
  const saidExpense = EXPENSE_VERBS.some((v) => normalized.includes(v));
  const overall: "expense" | "income" = saidIncome ? "income" : "expense";

  // Una fecha con día y mes manda ("el 28 de julio"). Un día sin mes cae en
  // el mes en curso. Si no se dijo ninguna, valen "ayer"/"anteayer"/hoy.
  const date =
    spoken && spoken.day !== null
      ? toISO(new Date(spoken.year, spoken.month ?? now.getMonth(), spoken.day))
      : findDate(normalized, now);

  // Cada monto se queda con las palabras que van DESDE él hasta el
  // siguiente monto. Ahí está su comercio: en "10 en hamburguesa y 20 en
  // gaseosa", la hamburguesa cae del lado del 10 y la gaseosa del lado
  // del 20.
  return {
    ok: true,
    typeSaid: saidIncome || saidExpense,
    rows: hits.map((hit, index) => {
      const nextStart = hits[index + 1]?.start ?? tokens.length;
      // Con las palabras de la fecha tachadas: "gasté 20 el 28 de julio"
      // llamaba al gasto "julio".
      let merchant = findMerchant(
        maskedRaw.slice(hit.end, nextStart),
        maskedTokens.slice(hit.end, nextStart)
      );

      // SI DETRÁS DEL MONTO NO HAY NOMBRE, SE BUSCA DELANTE.
      //
      // "el pan me costó 5 soles" y "compré una hamburguesa de 15" se guardaban sin
      // nombre, y sin nombre no se puede adivinar la categoría: iban a "Otros". El
      // nombre estaba dicho, solo que antes del monto.
      //
      // Solo para el PRIMER monto, y esto no es timidez: en "recibí 500 de sueldo y
      // gasté 20", mirar hacia atrás desde el 20 encontraría "sueldo" y llamaría
      // "sueldo" a un gasto de pan. Delante del primero no hay ningún movimiento
      // anterior al que robarle palabras.
      if (!merchant && index === 0) {
        merchant = findMerchant(maskedRaw.slice(0, hit.start), maskedTokens.slice(0, hit.start));
      }

      // Las palabras justo ANTES de este monto mandan sobre su tipo, para
      // frases mezcladas como "recibí 500 de sueldo y gasté 20 en pan".
      // Si ahí no hay ningún verbo, vale el tipo general de la frase.
      const before = tokens.slice(hits[index - 1]?.end ?? 0, hit.start).join(" ");
      const type = INCOME_VERBS.some((v) => before.includes(v))
        ? "income"
        : EXPENSE_VERBS.some((v) => before.includes(v))
          ? "expense"
          : overall;

      return {
        date,
        amount: hit.value,
        type,
        description: merchant,
        merchant,
        reference: "",
        categoryRaw: "",
        methodRaw: "",
      };
    }),
  };
}

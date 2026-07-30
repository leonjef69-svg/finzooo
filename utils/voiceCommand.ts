// ÓRDENES POR VOZ
//
// El micrófono empezó sabiendo una sola cosa: anotar gastos. Esto decide
// si la frase es eso o alguna de las otras órdenes que entiende.
//
// Por qué está separado de voiceParser: aquel traduce una frase a
// movimientos y no sabe nada del resto de la app. Este solo decide QUÉ se
// pidió. Así se puede agregar una orden nueva sin tocar lo que ya funciona.
//
// Regla de diseño: las órdenes que entiende **no destruyen nada**. Exportar
// abre una pantalla; el resumen solo lee. Si algún día se agrega "borra el
// último gasto", tiene que enseñar primero cuál va a borrar y esperar un sí,
// porque una palabra mal oída no puede costarle datos a nadie.

import { findSpokenDate, parseVoice, type VoiceParse } from "@/utils/voiceParser";

export type VoiceCommand =
  | { kind: "movements"; parsed: VoiceParse }
  | { kind: "export"; monthKey: string; format: "pdf" | "csv"; destination: "share" | "drive" }
  // "focus" dice de qué se pidió el resumen: solo lo que salió, solo lo que
  // entró, o las dos cosas. "category" queda puesto cuando se nombró una
  // ("solo comida"), y entonces el resumen se limita a esa.
  // "day" queda puesto cuando se preguntó por un día concreto ("gastos de 28
  // de julio", "cuánto gasté ayer"). Sin él, el resumen es del mes entero.
  | {
      kind: "summary";
      monthKey: string;
      day?: number;
      focus: "expense" | "income" | "all";
      category?: string;
    };

// "Bájame", "descárgame", "pásame el PDF"...
const EXPORT_WORDS = [
  "exporta", "exportar", "exportame", "descarga", "descargar", "descargame",
  "pdf", "excel", "pasame", "bajame", "reporte", "comprobante",
];

// "¿En qué gasté más?", "dame un resumen", "cuánto entró"...
const SUMMARY_WORDS = [
  "resumen", "resumeme", "cuanto gaste", "cuanto he gastado",
  "cuanto llevo", "en que gaste", "en que se me fue", "balance",
  "como voy", "cuanto me queda", "reporte de gastos",
  "cuanto recibi", "cuanto entro", "cuanto gane", "cuanto me pagaron",
  "mis ingresos", "cuanto ingreso",
  // Formas de PEDIR, que es como sale natural y no estaban previstas:
  // "dame los gastos de mayo..." no encajaba con ninguna de arriba y
  // acababa tratándose como si se quisiera anotar un movimiento.
  "dame los gastos", "dame mis gastos", "dame el gasto",
  "dame los ingresos", "dame mis ingresos",
  "muestrame", "muestra los", "muestra mis", "ensename",
  "ver mis gastos", "ver los gastos", "ver mis ingresos",
  "lista de gastos", "detalle de",
  // Nombrar la categoría ya delata que se está preguntando, no anotando.
  "categoria",
];

// Palabras que piden ver SOLO lo que entró.
const INCOME_FOCUS = [
  "ingreso", "ingresos", "recibi", "entro", "gane", "me pagaron",
  "cobre", "sueldo", "gane",
];

// Palabras que piden ver SOLO lo que salió.
const EXPENSE_FOCUS = ["gasto", "gastos", "gaste", "gastado", "se me fue"];

// Formas verbales: se está CONTANDO algo que se hizo, no preguntando.
// Sirven para decidir si un número suelto es un día o un monto.
const SPOKEN_VERBS = [
  // Van sin tildes porque se comparan contra el texto ya normalizado.
  "gaste", "gastado", "pague", "compre", "inverti",
  "recibi", "gane", "cobre", "me pagaron", "me dieron", "yapee",
];

// Nombres de categoría tal como los diría una persona → la categoría de
// Finzo. Ojo: esto NO es lo mismo que el diccionario de classifier.ts.
// Aquel traduce en QUÉ se gastó ("salchipapa" → comida); este traduce el
// nombre de la categoría en sí ("comida" → comida), que es lo que se dice
// al pedir un resumen.
const CATEGORY_WORDS: { match: string; category: string }[] = [
  // Gastos
  { match: "comida", category: "comida" },
  { match: "comidas", category: "comida" },
  { match: "alimentacion", category: "comida" },
  { match: "restaurante", category: "comida" },
  { match: "transporte", category: "transporte" },
  { match: "movilidad", category: "transporte" },
  { match: "pasajes", category: "transporte" },
  { match: "combustible", category: "combustible" },
  { match: "gasolina", category: "combustible" },
  { match: "grifo", category: "combustible" },
  { match: "servicios", category: "servicios" },
  { match: "recibos", category: "servicios" },
  { match: "salud", category: "salud" },
  { match: "farmacia", category: "salud" },
  { match: "compras", category: "compras" },
  { match: "ropa", category: "compras" },
  { match: "entretenimiento", category: "entretenimiento" },
  { match: "diversion", category: "entretenimiento" },
  { match: "videojuegos", category: "videojuegos" },
  { match: "juegos", category: "videojuegos" },
  { match: "suscripciones", category: "suscripciones" },
  { match: "suscripcion", category: "suscripciones" },
  { match: "educacion", category: "educacion" },
  { match: "estudios", category: "educacion" },
  { match: "mascotas", category: "mascotas" },
  { match: "mascota", category: "mascotas" },
  { match: "hogar", category: "hogar" },
  // Ingresos
  { match: "sueldo", category: "salario" },
  { match: "salario", category: "salario" },
  { match: "freelance", category: "freelance" },
  { match: "regalo", category: "regalo" },
  { match: "regalos", category: "regalo" },
  { match: "inversiones", category: "inversiones" },
  { match: "inversion", category: "inversiones" },
  { match: "venta", category: "venta" },
  { match: "ventas", category: "venta" },
  { match: "premio", category: "premios" },
  { match: "premios", category: "premios" },
  { match: "prestamo", category: "prestamo" },
  { match: "dividendos", category: "dividendos" },
  { match: "cripto", category: "cripto" },
  { match: "beca", category: "beca" },
  // Va al final porque es la única ambigua: como gasto es "hogar" (pagar
  // el alquiler) y como ingreso es "alquiler" (cobrarlo). Se resuelve más
  // abajo, mirando si se pidió de gastos o de ingresos.
  { match: "alquiler", category: "alquiler" },
];

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Índice 0-11 del mes nombrado, o null. "setiembre" y "septiembre" valen igual. */
function monthIndexFrom(normalized: string): number | null {
  for (let i = 0; i < MONTHS.length; i++) {
    if (normalized.includes(MONTHS[i])) {
      // "setiembre" y "septiembre" están los dos en la lista, en las
      // posiciones 8 y 9, pero ambos son el mes 9 (índice 8).
      return i >= 9 ? i - 1 : i;
    }
  }
  return null;
}

function key(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * De qué mes habla la frase.
 *
 * Un mes suelto ("enero") se entiende como el más reciente que YA PASÓ o
 * está en curso: en julio de 2026, "enero" es enero de 2026, pero
 * "diciembre" es diciembre de 2025. Nadie pide el reporte de un mes que
 * todavía no ha ocurrido.
 */
export function monthFromPhrase(normalized: string, now: Date): string {
  if (normalized.includes("mes pasado") || normalized.includes("mes anterior")) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return key(d.getFullYear(), d.getMonth());
  }

  const named = monthIndexFrom(normalized);
  if (named !== null) {
    // Un año dicho a mano manda sobre todo lo demás.
    const year = normalized.match(/\b(20\d{2})\b/);
    if (year) return key(Number(year[1]), named);
    const y = named > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    return key(y, named);
  }

  return key(now.getFullYear(), now.getMonth());
}

/**
 * ¿Aparece esta palabra ENTERA? Hace falta para el foco del resumen: si se
 * buscara por pedazo de texto, "gasto" saltaría dentro de "gastos" (bien)
 * pero "entro" también dentro de "encuentro" (mal).
 */
function hasWord(normalized: string, term: string): boolean {
  return ` ${normalized} `.includes(` ${term} `);
}

/** Igual que soften() de voiceParser: minúsculas, sin tildes, sin signos. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¡!¿?;:"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿Se nombró alguna categoría? ("...solamente la categoría comida").
 *
 * Se compara por palabra entera: buscando "venta" como pedazo de texto,
 * un "aventura" o un "ventana" la activarían sin que nadie la nombrara.
 */
function categoryFromPhrase(
  normalized: string,
  focus: "expense" | "income" | "all"
): string | undefined {
  for (const rule of CATEGORY_WORDS) {
    if (!hasWord(normalized, rule.match)) continue;
    // "Alquiler" es la única que significa dos cosas distintas: pagarlo es
    // un gasto de hogar, cobrarlo es un ingreso. Manda lo que se pidió.
    if (rule.category === "alquiler" && focus === "expense") return "hogar";
    return rule.category;
  }
  return undefined;
}

export function parseVoiceCommand(transcript: string, now: Date = new Date()): VoiceCommand {
  const normalized = normalize(transcript ?? "");

  if (EXPORT_WORDS.some((w) => normalized.includes(w))) {
    // Si se nombró Excel se manda un CSV; en cualquier otro caso, PDF.
    const wantsCsv = normalized.includes("excel") || normalized.includes("csv");
    // "a Drive", "a la nube", "guardalo en drive"...
    const wantsDrive =
      normalized.includes("drive") || normalized.includes("nube") || normalized.includes("google");
    return {
      kind: "export",
      monthKey: monthFromPhrase(normalized, now),
      format: wantsCsv ? "csv" : "pdf",
      destination: wantsDrive ? "drive" : "share",
    };
  }
  // Los ingresos se revisan primero porque son los que hay que nombrar a
  // propósito: quien no dice nada casi siempre está preguntando por sus
  // gastos, que es de lo que uno quiere enterarse.
  const wantsIncome = INCOME_FOCUS.some((w) => hasWord(normalized, w));
  const wantsExpense = EXPENSE_FOCUS.some((w) => hasWord(normalized, w));
  const focus = wantsIncome && !wantsExpense ? "income" : wantsExpense ? "expense" : "all";

  const tokens = normalized.split(" ");
  // Al preguntar sí se acepta un día suelto ("los gastos del 28"): una
  // pregunta no lleva monto, así que no hay con qué confundirlo.
  //
  // Salvo si la frase trae un verbo. "gasté el veinte en pan" quiere decir
  // veinte SOLES, no el día veinte; "gastos del 28" sí es el día. La forma
  // del verbo es lo que los distingue, así que con verbo no se acepta un día
  // suelto y el número se queda siendo el monto.
  const allowBareDay = !SPOKEN_VERBS.some((v) => hasWord(normalized, v));
  const spoken = findSpokenDate(tokens, now, allowBareDay);

  // Se pidió un resumen con todas las letras: "resumen", "cuánto gasté"...
  let asking = SUMMARY_WORDS.some((w) => normalized.includes(w));

  // Y la forma en que sale natural, que no lleva ninguna de esas palabras:
  // "gastos de 28 de julio".
  //
  // La regla: si se nombró gasto o ingreso y, quitando la fecha, no queda
  // ningún monto, es una pregunta. Si queda un monto, se está anotando algo.
  // Así "gastos de 28 de julio" pregunta, y "gasté 20 en pan el 28 de julio"
  // anota — la fecha sale de la cuenta en los dos casos.
  //
  // Esto era el fallo: "gastos de 28 de julio" acababa registrando un gasto
  // inventado de S/ 28 llamado "julio", cuando lo que había que hacer era
  // contestar con lo que de verdad se gastó ese día.
  if (!asking && (wantsIncome || wantsExpense)) {
    const withoutDate = spoken
      ? tokens.filter((_, i) => i < spoken.from || i >= spoken.to).join(" ")
      : normalized;
    asking = !parseVoice(withoutDate, now).ok;
  }

  if (asking) {
    // El mes lo pone la fecha que se oyó; si no se oyó ninguna, la frase
    // entera ("mes pasado") o, en último caso, el mes en curso.
    const monthKey =
      spoken && spoken.month !== null
        ? key(spoken.year, spoken.month)
        : monthFromPhrase(normalized, now);

    return {
      kind: "summary",
      monthKey,
      day: spoken?.day ?? undefined,
      focus,
      category: categoryFromPhrase(normalized, focus),
    };
  }

  return { kind: "movements", parsed: parseVoice(transcript, now) };
}

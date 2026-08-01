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
  | {
      kind: "export";
      monthKey: string;
      format: "pdf" | "xlsx" | "csv";
      destination: "share" | "mail" | "gmail" | "whatsapp" | "drive";
      /** A quien, tal como se dijo. Lo resuelve quien llama. */
      recipient?: string;
    }
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
    }
  // "¿En qué mes gasté más?" — mira TODOS los meses que hay guardados y
  // dice cuál gana, no uno en concreto.
  | { kind: "topMonth"; focus: "expense" | "income"; direction: "most" | "least" }
  // "Compara junio con mayo" — dos meses, uno al lado del otro.
  | { kind: "compare"; months: [string, string]; focus: "expense" | "income" | "all" };

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

// "Compara junio con mayo", "junio versus mayo", "diferencia entre..."
const COMPARE_WORDS = [
  "compara", "comparar", "comparame", "comparacion", "comparado", "comparativa",
  "versus", " vs ", "diferencia entre", "frente a", "contra el mes",
];

// "¿En qué mes gasté más?", "¿cuál fue mi mes más caro?"
//
// Son trozos de DOS palabras a propósito. Buscando solo "mes" saltaría en
// "cuánto gasté este mes", que es otra pregunta distinta.
const TOP_MONTH_WORDS = [
  "que mes", "cual mes", "mes mas", "mes menos", "mes con mas", "mes con menos",
  "mes que mas", "mes que menos", "mejor mes", "peor mes", "mes mejor", "mes peor",
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

/** El mes anterior a uno dado. "2026-01" → "2025-12". */
export function previousMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 1 ? key(y - 1, 11) : key(y, m - 2);
}

/**
 * TODOS los meses nombrados en la frase, en el orden en que se dijeron.
 *
 * Hace falta para comparar: "compara junio con mayo" tiene que dar junio
 * primero y mayo después, porque el orden es el que se enseña en pantalla y
 * el que decide de qué mes se dice "gastaste más".
 *
 * "setiembre" y "septiembre" son el mismo mes; si se dicen los dos, cuenta
 * una sola vez.
 */
export function monthsInPhrase(normalized: string, now: Date): string[] {
  const found: { pos: number; m: number }[] = [];
  for (let i = 0; i < MONTHS.length; i++) {
    const pos = normalized.indexOf(MONTHS[i]);
    if (pos >= 0) found.push({ pos, m: i >= 9 ? i - 1 : i });
  }
  found.sort((a, b) => a.pos - b.pos);

  const said = normalized.match(/\b(20\d{2})\b/);
  const out: string[] = [];
  const seen = new Set<number>();
  for (const f of found) {
    if (seen.has(f.m)) continue;
    seen.add(f.m);
    // Un mes suelto es el más reciente que ya pasó o está en curso.
    const y = said ? Number(said[1]) : f.m > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    out.push(key(y, f.m));
  }
  return out;
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

/** Qué formato se pidió. Sin decir nada, PDF. */
export function formatFromPhrase(normalized: string): "pdf" | "xlsx" | "csv" {
  if (normalized.includes("csv")) return "csv";
  if (normalized.includes("excel")) return "xlsx";
  return "pdf";
}

/**
 * A dónde se pidió mandarlo.
 *
 * El orden importa. "Gmail" se mira antes que "correo" porque quien dice
 * "mándalo por Gmail" quiere Gmail, y las dos palabras aparecen en frases
 * parecidas; al revés, "gmail" caería en "correo" y se abriría la aplicación
 * de correo del fabricante en vez de Gmail.
 */
export function destinationFromPhrase(
  normalized: string
): "share" | "mail" | "gmail" | "whatsapp" | "drive" {
  if (normalized.includes("whatsapp") || normalized.includes("wasap") || normalized.includes("wasa")) {
    return "whatsapp";
  }
  if (normalized.includes("gmail")) return "gmail";
  if (normalized.includes("correo") || normalized.includes("email")) return "mail";
  if (normalized.includes("drive") || normalized.includes("nube") || normalized.includes("google")) {
    return "drive";
  }
  return "share";
}

/**
 * A quién, tal como se dijo: "a mamá", "al contador", "a mi número".
 *
 * Devuelve el texto en crudo, no un contacto. Este archivo solo traduce la
 * frase y no sabe nada de la app; quien llame busca ese texto entre los
 * contactos guardados. Mezclar las dos cosas aquí obligaría a este archivo a
 * leer del almacenamiento, y dejaría de poder probarse solo.
 *
 * Se corta en la primera palabra que ya significa otra cosa —un formato, un
 * destino, un mes— porque el reconocedor entrega la frase entera de corrido:
 * sin ese corte, "exportar julio pdf whatsapp a mama" daría un nombre de
 * "mama" con media orden pegada detrás.
 */
const PALABRAS_QUE_CORTAN = [
  "pdf", "excel", "csv", "whatsapp", "wasap", "wasa", "gmail", "correo", "email",
  "drive", "nube", "google", "de", "del",
  ...MONTHS,
];

export function recipientFromPhrase(normalized: string): string | undefined {
  // "a mamá" / "al contador" / "para el contador". El "a" suelto no vale:
  // aparece en medio de cualquier frase.
  const m = normalized.match(/\b(?:a|al|para)\s+(?:el\s+|la\s+|mi\s+)?([a-zñáéíóú0-9 ]+)$/);
  if (m) {
    const palabras: string[] = [];
    for (const palabra of m[1].trim().split(/\s+/)) {
      if (PALABRAS_QUE_CORTAN.includes(palabra)) break;
      palabras.push(palabra);
    }
    const nombre = palabras.join(" ").trim();
    if (nombre.length >= 2) return nombre;
  }

  return nombreAlFinal(normalized);
}

/**
 * El nombre dicho SIN "a" ni "para" delante: "exportar julio pdf whatsapp mi
 * número".
 *
 * Hablando no se dice la preposición. Se dice el destino y detrás a quién, de
 * corrido, y exigir el "a" hacía que no se entendiera a nadie — WhatsApp se
 * abría con el archivo puesto pero preguntando a quién mandarlo, que es
 * justo el paso que la orden por voz existe para quitar.
 *
 * Se toma lo que queda DESPUÉS de la última palabra de la orden (formato,
 * destino o mes). Todo lo de antes ya significa otra cosa, así que lo que
 * sobra al final solo puede ser el nombre.
 */
function nombreAlFinal(normalized: string): string | undefined {
  const palabras = normalized.trim().split(/\s+/);

  let ultimaDeLaOrden = -1;
  for (let i = 0; i < palabras.length; i++) {
    if (PALABRAS_QUE_CORTAN.includes(palabras[i])) ultimaDeLaOrden = i;
  }
  // Si no se dijo ni formato ni destino ni mes, lo del final no es un nombre:
  // es la orden entera. Sin esto, "exportar movimientos" tomaría
  // "movimientos" por una persona.
  if (ultimaDeLaOrden < 0) return undefined;

  const cola = palabras.slice(ultimaDeLaOrden + 1);
  const nombre = cola.join(" ").trim();
  if (nombre.length < 2) return undefined;
  // Un año no es nadie. "exportar julio de 2026" deja "2026" al final, y sin
  // esto se avisaría de que no existe el contacto "2026" en una frase donde
  // nadie nombró a nadie.
  if (/^\d+$/.test(nombre)) return undefined;
  return nombre;
}

export function parseVoiceCommand(transcript: string, now: Date = new Date()): VoiceCommand {
  const normalized = normalize(transcript ?? "");

  if (EXPORT_WORDS.some((w) => normalized.includes(w))) {
    return {
      kind: "export",
      monthKey: monthFromPhrase(normalized, now),
      format: formatFromPhrase(normalized),
      destination: destinationFromPhrase(normalized),
      // A quién, tal como se dijo. Aquí no se puede resolver a un contacto:
      // este archivo no sabe nada de la app, solo traduce la frase. Quien
      // llame se encarga de buscarlo entre los contactos guardados.
      recipient: recipientFromPhrase(normalized),
    };
  }
  // Los ingresos se revisan primero porque son los que hay que nombrar a
  // propósito: quien no dice nada casi siempre está preguntando por sus
  // gastos, que es de lo que uno quiere enterarse.
  const wantsIncome = INCOME_FOCUS.some((w) => hasWord(normalized, w));
  const wantsExpense = EXPENSE_FOCUS.some((w) => hasWord(normalized, w));
  const focus = wantsIncome && !wantsExpense ? "income" : wantsExpense ? "expense" : "all";

  // "¿En qué mes gasté más?" — va antes que el resumen porque comparte
  // palabras con él ("gasté"), y antes que comparar porque "el mes que más
  // gasté" no nombra ningún mes que comparar.
  if (TOP_MONTH_WORDS.some((w) => normalized.includes(w))) {
    const menos = hasWord(normalized, "menos") || normalized.includes("mejor mes") || normalized.includes("mes mejor");
    const mas = hasWord(normalized, "mas") || normalized.includes("peor mes") || normalized.includes("mes peor");
    if (menos || mas) {
      return {
        kind: "topMonth",
        // Sin decir nada se entiende que se pregunta por los gastos, igual
        // que en el resumen.
        focus: wantsIncome && !wantsExpense ? "income" : "expense",
        // "Menos" manda sobre "más": en "el mes que menos gasté" están las
        // dos palabras si se dijo "gasté más o menos".
        direction: menos ? "least" : "most",
      };
    }
  }

  // "Compara junio con mayo"
  if (COMPARE_WORDS.some((w) => normalized.includes(w))) {
    const dichos = monthsInPhrase(normalized, now);
    // Con un solo mes nombrado se compara con el anterior, que es lo que
    // quiere decir "compara junio" sin más. Sin ninguno, este mes con el
    // pasado.
    const base = dichos[0] ?? monthFromPhrase(normalized, now);
    const months: [string, string] = [base, dichos[1] ?? previousMonth(base)];
    return { kind: "compare", months, focus };
  }

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

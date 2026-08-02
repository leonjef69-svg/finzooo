// INTÉRPRETE DE NOTIFICACIONES
//
// Convierte el texto de una notificación ("Yapeaste S/ 20.00 a Juan Pérez")
// en un movimiento de Finzo. Está separado del código nativo a propósito:
// así se puede probar entero sin celular y sin permisos.
//
// Regla de oro: ante la duda, NO registrar. Un movimiento que no se capturó
// se puede escribir a mano en diez segundos; uno inventado con el monto
// equivocado ensucia el presupuesto y cuesta mucho más encontrarlo.
// Por eso se exige SIEMPRE dos señales independientes: un monto reconocible
// Y una palabra que diga si el dinero entró o salió.

import { normalizeHeader, parseAmount, type RawRow } from "@/utils/importEngine";
import type { CapturedNotification } from "@/modules/notification-reader";

export type ParseFailure =
  | "notMoney" // es publicidad, un código de seguridad, un aviso de saldo...
  | "noAmount" // no se encontró ningún monto
  | "noDirection"; // no se pudo saber si entró o salió dinero

export type NotificationParse =
  | { ok: true; row: RawRow }
  | { ok: false; reason: ParseFailure };

// Letras que pueden formar parte de un nombre en español.
const L = "A-Za-zÁÉÍÓÚÑÜáéíóúñü";

/**
 * De qué apps se registran movimientos. **Solo Yape**, por ahora.
 *
 * Tiene que decir lo mismo que MONEY_APP_HINTS en FinzoNotificationListener.
 * Hay una prueba que lo comprueba: si las dos listas se separan, el servicio
 * captura avisos que la app tira —o al revés— y desde fuera eso se ve como
 * que el registro automático falla sin motivo.
 *
 * Se compara por "contiene" y no por el nombre exacto: el paquete real de
 * Yape es "com.bcp.innovacxion.yapeapp".
 */
const APPS_ACEPTADAS = ["yape"];

/**
 * ¿Este aviso viene de una app que Finzo mira?
 *
 * Se usa para DESCARTARLO SIN DEJAR RASTRO. No es lo mismo que un aviso de
 * Yape que no se entendió: ese sí tiene que salir en la pantalla, porque es
 * lo que permite saber qué texto falta reconocer. Un aviso de otra app no
 * aporta nada ahí y encima ensucia la lista — y si es de clave, la deja
 * escrita en el celular.
 */
export function esAppVigilada(pkg: string): boolean {
  const p = (pkg ?? "").toLowerCase();
  return APPS_ACEPTADAS.some((app) => p.includes(app));
}

// Avisos que traen un monto pero NO son un movimiento. La lista es corta a
// propósito: exigir una palabra de dirección ya descarta casi toda la
// publicidad, y una lista larga corre el riesgo de bloquear gastos reales
// ("Pagaste S/20 y ganaste puntos" es un gasto de verdad).
const NOT_A_MOVEMENT = [
  "codigo de verificacion",
  "codigo de seguridad",
  "clave temporal",
  "no compartas",
  // Yape manda esto junto a cada pago: "Operación en curso. Hemos generado
  // y autocompletado la clave". Hoy no trae monto, así que se descartaba
  // solo por eso. Si algún día se lo agregan, el mismo pago se registraría
  // DOS veces — y descubrirlo después, con los números ya descuadrados, es
  // mucho peor que blindarlo ahora.
  "operacion en curso",
  "autocompletado la clave",
  "generado y autocompletado",
  "sorteo",
  "promocion",
  "encuesta",
  "preaprobado",
  "pre aprobado",
  "solicita tu",
];

// Entró dinero. Se revisan ANTES que los gastos porque algunas frases
// ("pago recibido") contienen palabras que también aparecen en gastos.
const INCOME_HINTS = [
  "te yapearon",
  "te yapeo",
  "nuevo yapeo",
  "yapeo recibido",
  "te plinearon",
  "te plineo",
  "recibiste",
  "has recibido",
  "pago recibido",
  "abono",
  "abonaron",
  "abonado",
  "deposito",
  "depositaron",
  "te envio",
  "te enviaron",
  "te transfirio",
  "te transfirieron",
  "cobraste",
];

// Salió dinero.
const EXPENSE_HINTS = [
  "yapeaste",
  "yapeo enviado",
  "plineaste",
  "pagaste",
  "pago exitoso",
  "pago realizado",
  "pago procesado",
  "compra",
  "consumo",
  "consumiste",
  "cargo",
  "debito",
  "retiro",
  "retiraste",
  "enviaste",
  "transferiste",
  "transferencia enviada",
];

// Palabras que nunca son el nombre de una persona ni de un comercio: si la
// extracción cae en una de ellas, es que agarró parte de la frase.
const NOT_A_NAME = new Set([
  "tu", "su", "el", "la", "los", "las", "un", "una", "tus", "sus",
  "cuenta", "tarjeta", "soles", "dolares", "nuevo", "nueva", "pago",
  "cobro", "yape", "plin", "hoy", "ayer", "esta", "este",
]);

/**
 * De qué cuenta viene, según el paquete de la app que emitió la notificación.
 *
 * El orden importa: el paquete de Yape es "com.bcp.innovacxion.yapeapp", que
 * contiene "bcp". Si se revisara BCP primero, todos los Yapes quedarían
 * marcados como BCP y el detector de repetidos los compararía contra la
 * cuenta equivocada.
 */
export function accountFromPackage(pkg: string): string | undefined {
  const p = pkg.toLowerCase();
  if (p.includes("yape")) return "yape";
  if (p.includes("plin")) return "plin";
  if (p.includes("interbank")) return "interbank";
  if (p.includes("bbva")) return "bbva";
  if (p.includes("scotia")) return "scotiabank";
  if (p.includes("bcp") || p.includes("viabcp")) return "bcp";
  return undefined;
}

/** Nombre corto de la app, para mostrarlo cuando no hay un nombre de persona. */
export function appLabelFromPackage(pkg: string): string {
  const account = accountFromPackage(pkg);
  if (!account) return "Banco";
  return account === "yape"
    ? "Yape"
    : account === "plin"
      ? "Plin"
      : account.toUpperCase();
}

/** Fecha local en formato "AAAA-MM-DD". */
function localDate(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Busca el monto. Acepta "S/ 20", "S/20.00", "S/. 1,250.50" y "PEN 20.00".
 * Si no hay símbolo de moneda, solo acepta un número con centavos
 * ("20.00"): un número suelto sin decimales suele ser un número de
 * operación o los últimos dígitos de una tarjeta, no un monto.
 */
function findAmount(text: string): number | null {
  const withSymbol = text.match(/(?:s\s*\/\s*\.?|pen\b)\s*([0-9][\d.,]*)/i);
  if (withSymbol) {
    const value = parseAmount(withSymbol[1]);
    if (value !== null && value !== 0) return Math.abs(value);
  }

  const withCents = text.match(/(?:^|\s)([0-9][\d,]*[.,]\d{2})(?:\s|$)/);
  if (withCents) {
    const value = parseAmount(withCents[1]);
    if (value !== null && value !== 0) return Math.abs(value);
  }

  return null;
}

// Palabras de relleno. Marcan dónde termina el nombre y sigue el resto de la
// frase: en "Compra en LA BODEGA por S/ 15.00", el "por" avisa que "BODEGA"
// fue la última palabra del comercio.
const FILLER = new Set([
  "por", "con", "el", "la", "los", "las", "de", "del", "desde", "hasta",
  "en", "a", "y", "tu", "su", "sus", "para", "un", "una", "al", "te", "le",
]);

// Raíces de verbos y sustantivos de la propia frase bancaria. Una palabra que
// empiece así no es un nombre: es parte del aviso ("Nuevo yapeo Rosa Díaz").
const PHRASE_ROOTS = [
  "yape", "yapa", "plin", "pago", "pagas", "cobr", "envi", "transfer",
  "transfir", "recib", "abon", "deposit", "retir", "compr", "consum",
  "nuevo", "nueva", "monto", "soles", "operacion", "cuenta", "tarjeta",
  "saldo", "banco", "exitos", "realiz",
];

/**
 * ¿Esta palabra suelta puede formar parte de un nombre de persona o comercio?
 * Se descartan las de relleno, las de la propia frase del banco y las letras
 * sueltas (la "S" de "S/" queda colgando cuando el monto va detrás).
 */
function looksLikeName(word: string): boolean {
  const w = normalizeHeader(word);
  if (w.length <= 1) return false;
  if (FILLER.has(w) || NOT_A_NAME.has(w)) return false;
  if (PHRASE_ROOTS.some((root) => w.startsWith(root))) return false;
  return /^[a-z]/.test(w);
}

/**
 * Arma el nombre a partir de un trozo de texto: se saltan las palabras de
 * relleno del principio y se cortan en la primera palabra que ya no encaja.
 * Así "LA BODEGA por S/ 15" da "BODEGA" y "PLAZA VEA con tu tarjeta" da
 * "PLAZA VEA", en vez de arrastrar media frase.
 */
function cleanName(raw: string): string {
  const words = raw.replace(/\s+/g, " ").trim().split(" ");
  const picked: string[] = [];

  for (const word of words) {
    const clean = word.replace(/[.,;:!¡?¿]+$/, "");
    if (!looksLikeName(clean)) {
      if (picked.length > 0) break; // ya empezó el nombre: aquí termina
      continue; // todavía no empezó: era relleno del principio
    }
    picked.push(clean);
    if (picked.length === 5) break;
  }

  const name = picked.join(" ");
  return name.length >= 2 && name.length <= 40 ? name : "";
}

/**
 * Toma las últimas palabras antes de una posición dada, que es donde va el
 * nombre en "JEFFERSON GIOVANNI LEON CARLOS te envió un pago". Se camina
 * hacia atrás para no arrastrar el título de la notificación, que va pegado
 * delante ("Confirmación de Pago Yape!").
 *
 * El tope es de cuatro palabras porque así son los nombres completos en Perú:
 * dos nombres y dos apellidos. Con tres se perdía el primer nombre.
 */
function nameBefore(text: string): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const picked: string[] = [];

  for (let i = words.length - 1; i >= 0 && picked.length < 4; i--) {
    const clean = words[i].replace(/[.,;:!¡?¿]+$/, "");
    if (!looksLikeName(clean)) break;
    picked.unshift(clean);
  }

  const name = picked.join(" ");
  return name.length >= 2 && name.length <= 40 ? name : "";
}

/**
 * Saca con quién fue el movimiento. Trabaja sobre el texto original (con sus
 * mayúsculas y tildes) para que el nombre se vea bien en la lista.
 */
function findCounterparty(text: string, type: "expense" | "income"): string {
  const flat = text.replace(/\s+/g, " ").trim();

  if (type === "income") {
    // "Juan Pérez te yapeó S/ 50.00" — el nombre va ANTES del verbo.
    const verb = flat.match(/\s+te\s+(?:yape|pline|envi|transfir)/i);
    if (verb && verb.index !== undefined) {
      const name = nameBefore(flat.slice(0, verb.index));
      if (name) return name;
    }
    // "Recibiste S/ 50.00 de Juan Pérez"
    const after = flat.match(new RegExp(`\\bde\\s+([${L}][${L}\\s.'-]{1,40})`, "i"));
    if (after) {
      const name = cleanName(after[1]);
      if (name) return name;
    }
    return "";
  }

  // "Yapeaste S/ 20.00 a Juan Pérez"
  const toSomeone = flat.match(new RegExp(`\\ba\\s+([${L}][${L}\\s.'-]{1,40})`, "i"));
  if (toSomeone) {
    const name = cleanName(toSomeone[1]);
    if (name) return name;
  }
  // "Compra en KFC SAN MIGUEL"
  const atPlace = flat.match(new RegExp(`\\ben\\s+([${L}][${L}0-9\\s.'-]{1,40})`, "i"));
  if (atPlace) {
    const name = cleanName(atPlace[1]);
    if (name) return name;
  }
  return "";
}

/** Método de pago probable, según la app y lo que diga el texto. */
function findMethod(pkg: string, normalized: string): string {
  const account = accountFromPackage(pkg);
  if (account === "yape") return "yape";
  if (account === "plin") return "plin";
  if (normalized.includes("credito") || normalized.includes("tarjeta de credito")) return "credit";
  if (normalized.includes("debito") || normalized.includes("tarjeta")) return "debit";
  if (normalized.includes("transferencia") || normalized.includes("transfir")) return "transfer";
  return "";
}

/**
 * Intenta convertir una notificación en un movimiento.
 * Devuelve el motivo del rechazo cuando no se puede, para poder mostrarlo en
 * la pantalla de diagnóstico y así saber qué formato falta reconocer.
 */
export function parseNotification(n: CapturedNotification): NotificationParse {
  // SOLO YAPE. Decisión del usuario el 02/08/2026.
  //
  // El servicio de Android ya filtra por app, pero esa lista viaja dentro del
  // APK y solo cambia reinstalando. Esta comprobación va aquí ADEMÁS, no en
  // vez de: así el cambio hace efecto por actualización, sin esperar a un APK
  // nuevo, y con uno anterior instalado tampoco se cuela nada.
  //
  // Los demás bancos nunca se probaron con un movimiento de verdad. Volver a
  // meter uno pide un aviso real suyo, aquí y en MONEY_APP_HINTS del servicio.
  if (!esAppVigilada(n.package)) {
    return { ok: false, reason: "notMoney" };
  }

  const original = `${n.title ?? ""} ${n.text ?? ""}`.trim();
  const normalized = normalizeHeader(original);

  if (!normalized) return { ok: false, reason: "notMoney" };
  if (NOT_A_MOVEMENT.some((hint) => normalized.includes(hint))) {
    return { ok: false, reason: "notMoney" };
  }

  const amount = findAmount(original);
  if (amount === null) return { ok: false, reason: "noAmount" };

  const isIncome = INCOME_HINTS.some((hint) => normalized.includes(hint));
  const isExpense = !isIncome && EXPENSE_HINTS.some((hint) => normalized.includes(hint));
  if (!isIncome && !isExpense) return { ok: false, reason: "noDirection" };

  const type: "expense" | "income" = isIncome ? "income" : "expense";
  const date = localDate(n.postedAt);
  if (!date) return { ok: false, reason: "notMoney" };

  const counterparty = findCounterparty(original, type);
  const label = appLabelFromPackage(n.package);

  return {
    ok: true,
    row: {
      date,
      amount,
      type,
      description: counterparty || label,
      merchant: counterparty,
      reference: "",
      categoryRaw: "",
      methodRaw: findMethod(n.package, normalized),
      account: accountFromPackage(n.package),
    },
  };
}

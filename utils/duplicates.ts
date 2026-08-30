// DETECTOR DE MOVIMIENTOS REPETIDOS
//
// Problema que resuelve: pagas S/10 en KFC y lo anotas a mano. Días
// después importas el estado de cuenta del banco, que trae ese mismo
// KFC. Sin esto, tendrías el gasto dos veces y tu saldo saldría mal.
//
// Cómo funciona: a cada par (uno tuyo + uno del banco) se le da un
// puntaje de parecido de 0 a 100. Cuanto más alto, más probable es que
// sean el mismo gasto.

import type { Transaction } from "@/types";
import type { RawRow } from "@/utils/importEngine";
import { normalizeHeader } from "@/utils/importEngine";

// Cuánto vale cada coincidencia. Suman 100 entre todas.
const WEIGHT_AMOUNT = 40;
const WEIGHT_DATE = 25;
const WEIGHT_ACCOUNT = 20;
const WEIGHT_MERCHANT = 15;

export type MatchLevel = "high" | "review" | "new";

export type DuplicateMatch = {
  existing: Transaction;
  score: number;
  level: MatchLevel;
  reasons: string[];
};

// --- Monto ---
// Se compara con una tolerancia de un centavo, porque los redondeos
// (0.1 + 0.2 no da exactamente 0.3 en una computadora) pueden hacer que
// dos montos iguales parezcan distintos.
function amountScore(a: number, b: number): number {
  return Math.abs(a - b) < 0.01 ? WEIGHT_AMOUNT : 0;
}

// --- Fecha ---
// A propósito NO exige el mismo día. Compras en KFC el 24 pero el banco
// puede registrarlo el 26: es lo normal, la fecha de compra y la de
// cargo casi nunca coinciden. Si exigiéramos el día exacto, ese KFC se
// registraría dos veces — justo lo que queremos evitar.
function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(`${isoA}T00:00:00`).getTime();
  const b = new Date(`${isoB}T00:00:00`).getTime();
  if (isNaN(a) || isNaN(b)) return 999;
  return Math.abs(Math.round((a - b) / 86400000));
}

function dateScore(isoA: string, isoB: string): number {
  const diff = daysBetween(isoA, isoB);
  if (diff === 0) return WEIGHT_DATE;
  if (diff === 1) return 20;
  if (diff <= 3) return 12;
  return 0;
}

// --- Cuenta ---
// Si sabemos que son de bancos DISTINTOS, es casi seguro que son gastos
// diferentes aunque el monto coincida. Eso se castiga aparte, más abajo.
function accountScore(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  return a === b ? WEIGHT_ACCOUNT : 0;
}

// --- Comercio ---
// El banco escribe "KFC SAN MIGUEL 0234" y tú escribiste "KFC". No se
// puede exigir texto idéntico: se comparan las palabras que comparten.
function textSimilarity(a: string, b: string): number {
  const wordsA = normalizeHeader(a).split(" ").filter((w) => w.length > 2);
  const wordsB = normalizeHeader(b).split(" ").filter((w) => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setB = new Set(wordsB);
  const shared = wordsA.filter((w) => setB.has(w)).length;
  return shared / Math.min(wordsA.length, wordsB.length);
}

function merchantScore(existing: Transaction, incoming: RawRow): number {
  const mine = `${existing.description} ${existing.merchant ?? ""}`.trim();
  const theirs = `${incoming.merchant} ${incoming.description}`.trim();
  const similarity = textSimilarity(mine, theirs);
  if (similarity >= 0.6) return WEIGHT_MERCHANT;
  if (similarity >= 0.3) return Math.round(WEIGHT_MERCHANT * 0.5);
  return 0;
}

// ---------------------------------------------------------------------
// PUNTAJE TOTAL
// ---------------------------------------------------------------------
//
// IMPORTANTE — por qué el puntaje se reparte:
// Si un movimiento no tiene banco anotado, esos 20 puntos no se pueden
// dar NUNCA. El máximo posible sería 80 y la franja "90-100" quedaría
// vacía para siempre: todo caería en "revisar" y la persona tendría que
// revisar movimiento por movimiento, que es justo lo que esta función
// debe evitar.
//
// Solución: solo se cuentan las señales que SÍ se pueden comparar, y el
// puntaje se expresa sobre ese total. Así, si coinciden monto y fecha y
// no hay banco anotado, el resultado es 100% de lo comparable — no un
// 65 engañoso.
export function scoreMatch(existing: Transaction, incoming: RawRow): DuplicateMatch {
  const reasons: string[] = [];

  // El tipo debe coincidir: un ingreso nunca es duplicado de un gasto.
  if (existing.type !== incoming.type) {
    return { existing, score: 0, level: "new", reasons: [] };
  }

  let earned = 0;
  let possible = 0;

  // Monto y fecha siempre se pueden comparar.
  possible += WEIGHT_AMOUNT + WEIGHT_DATE;
  const gotAmount = amountScore(existing.amount, incoming.amount);
  earned += gotAmount;
  if (gotAmount > 0) reasons.push("amount");

  const gotDate = dateScore(existing.date, incoming.date);
  earned += gotDate;
  if (gotDate > 0) reasons.push("date");

  // La cuenta solo cuenta si AMBOS la tienen anotada.
  const bothHaveAccount = Boolean(existing.account && incoming.account);
  if (bothHaveAccount) {
    possible += WEIGHT_ACCOUNT;
    const gotAccount = accountScore(existing.account, incoming.account);
    earned += gotAccount;
    if (gotAccount > 0) reasons.push("account");
  }

  // El comercio solo cuenta si ambos tienen texto con el que comparar.
  const mineText = `${existing.description} ${existing.merchant ?? ""}`.trim();
  const theirsText = `${incoming.merchant} ${incoming.description}`.trim();
  if (mineText.length > 0 && theirsText.length > 0) {
    possible += WEIGHT_MERCHANT;
    const gotMerchant = merchantScore(existing, incoming);
    earned += gotMerchant;
    if (gotMerchant > 0) reasons.push("merchant");
  }

  let score = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  // Regla de seguridad: si el monto NO coincide, no son el mismo gasto,
  // por mucho que compartan fecha y comercio. Sin esto, dos almuerzos en
  // el mismo sitio el mismo día se fusionarían y perderías uno.
  if (gotAmount === 0) score = Math.min(score, 40);

  // Si sabemos que son de bancos distintos, casi seguro son gastos
  // distintos aunque todo lo demás coincida.
  if (bothHaveAccount && existing.account !== incoming.account) {
    score = Math.min(score, 50);
  }

  return { existing, score, level: levelFor(score), reasons };
}

export function levelFor(score: number): MatchLevel {
  if (score >= 90) return "high";
  if (score >= 70) return "review";
  return "new";
}

// Busca, entre todos tus movimientos, el que más se parece al que viene
// del banco. Devuelve null si ninguno se parece lo suficiente.
export function findBestMatch(
  existingList: Transaction[],
  incoming: RawRow,
  alreadyMatchedIds: Set<number>
): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;
  for (const existing of existingList) {
    // Un movimiento tuyo no puede ser el duplicado de dos filas del
    // banco a la vez.
    if (alreadyMatchedIds.has(existing.id)) continue;
    // Un cargo bancario puede demorarse algunos días, pero no meses. Evitar
    // comparar años enteros de historial hace que archivos grandes no traben
    // celulares modestos y también reduce falsos parecidos por monto/comercio.
    if (daysBetween(existing.date, incoming.date) > 14) continue;
    const match = scoreMatch(existing, incoming);
    if (match.level === "new") continue;
    if (!best || match.score > best.score) best = match;
  }
  return best;
}

// ---------------------------------------------------------------------
// FUSIÓN
// ---------------------------------------------------------------------
//
// Al fusionar se queda lo mejor de cada uno:
//   De lo TUYO      → la categoría que elegiste, tus notas y etiquetas.
//                     (tú sabes mejor que el banco en qué gastaste)
//   Del BANCO       → el nombre real del comercio, la fecha del cargo,
//                     el código de operación y la cuenta.
export function mergeTransaction(existing: Transaction, incoming: RawRow): Transaction {
  return {
    ...existing,
    // Lo tuyo manda en la clasificación:
    category: existing.category,
    notes: existing.notes,
    tags: existing.tags,
    // El banco manda en los datos duros:
    date: incoming.date,
    amount: incoming.amount,
    merchant: incoming.merchant || existing.merchant,
    reference: incoming.reference || existing.reference,
    account: incoming.account || existing.account,
    // La descripción tuya se conserva si la escribiste; si estaba vacía,
    // se usa la del banco.
    description: existing.description || incoming.description,
    // Tú lo anotaste Y el banco lo confirmó: queda "verificado" (🟢), tal
    // como el ejemplo de la especificación.
    origin: "verified",
  };
}

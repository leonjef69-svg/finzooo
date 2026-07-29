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

import { parseVoice, type VoiceParse } from "@/utils/voiceParser";

export type VoiceCommand =
  | { kind: "movements"; parsed: VoiceParse }
  | { kind: "export"; monthKey: string; format: "pdf" | "csv"; destination: "share" | "drive" }
  | { kind: "summary"; monthKey: string };

// "Bájame", "descárgame", "pásame el PDF"...
const EXPORT_WORDS = [
  "exporta", "exportar", "exportame", "descarga", "descargar", "descargame",
  "pdf", "excel", "pasame", "bajame", "reporte", "comprobante",
];

// "¿En qué gasté más?", "dame un resumen", "cuánto llevo gastado"...
const SUMMARY_WORDS = [
  "resumen", "resumeme", "cuanto gaste", "cuanto he gastado",
  "cuanto llevo", "en que gaste", "en que se me fue", "balance",
  "como voy", "cuanto me queda", "reporte de gastos",
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
  if (SUMMARY_WORDS.some((w) => normalized.includes(w))) {
    return { kind: "summary", monthKey: monthFromPhrase(normalized, now) };
  }

  return { kind: "movements", parsed: parseVoice(transcript, now) };
}

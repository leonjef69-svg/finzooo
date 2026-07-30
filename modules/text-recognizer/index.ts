import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** Una línea de texto leída de la foto, con dónde estaba. */
export type OcrLine = {
  text: string;
  /** Posición en píxeles dentro de la imagen. */
  x: number;
  y: number;
  w: number;
  /** Alto de la línea. Sirve para saber qué texto es más grande. */
  h: number;
};

export type OcrResult = {
  /** Todo el texto, ya ordenado como se leería con el ojo. */
  text: string;
  lines: OcrLine[];
};

type NativeShape = {
  recognize: (uri: string) => Promise<string>;
};

// "Optional" porque este módulo solo existe en Android y solo dentro de una
// compilación de verdad. En Expo Go o en un APK anterior a esta función vale
// null, y `isSupported` deja avisarlo en pantalla en vez de reventar.
const Native = requireOptionalNativeModule<NativeShape>("TextRecognizer");

/**
 * Si esto es false, el escáner no existe en este dispositivo.
 *
 * El caso normal es tener un APK viejo: el lector de texto es código nativo
 * y NO llega con "Buscar actualización", así que hasta instalar el APK nuevo
 * esto seguirá en false.
 */
export const isSupported = Platform.OS === "android" && Native != null;

export type OcrFailure = "unsupported" | "unreadable";

export type OcrOutcome =
  | { ok: true; result: OcrResult }
  | { ok: false; reason: OcrFailure };

/**
 * Lee el texto de una foto.
 *
 * Nunca lanza: una foto movida o un archivo que ya no está son cosas que
 * pasan todos los días, y la pantalla tiene que poder ofrecer "repetir" en
 * vez de cerrarse.
 */
export async function recognize(uri: string): Promise<OcrOutcome> {
  if (!Native) return { ok: false, reason: "unsupported" };
  try {
    const raw = await Native.recognize(uri);
    const parsed = JSON.parse(raw) as Partial<OcrResult>;
    if (typeof parsed.text !== "string" || !Array.isArray(parsed.lines)) {
      return { ok: false, reason: "unreadable" };
    }
    return { ok: true, result: { text: parsed.text, lines: parsed.lines as OcrLine[] } };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

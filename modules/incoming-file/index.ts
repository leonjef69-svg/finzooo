import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** Un archivo que llegó desde otra aplicación, ya copiado a Fino. */
export type IncomingFile = {
  /** Ruta local ("file://..."), lista para leer como cualquier otra. */
  uri: string;
  /** El nombre original. De aquí sale el reconocimiento del banco. */
  name: string;
};

type NativeShape = {
  consumePendingFile: () => string | null;
  elegirArchivo?: () => Promise<string | null>;
};

const Native = requireOptionalNativeModule<NativeShape>("IncomingFile");

export const isSupported = Platform.OS === "android" && Native != null;

/**
 * Recoge el archivo con el que se abrió Fino, si lo hubo.
 *
 * Solo lo entrega UNA vez: la segunda llamada devuelve null aunque la app
 * siga abierta. Es lo que evita que el mismo estado de cuenta se importe de
 * nuevo cada vez que la app vuelve al frente.
 *
 * Nunca lanza: que Android mande algo raro no puede impedir que la app se
 * abra.
 */
export function consumePendingFile(): IncomingFile | null {
  if (!Native) return null;
  try {
    const raw = Native.consumePendingFile();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IncomingFile>;
    if (typeof parsed.uri !== "string" || typeof parsed.name !== "string") return null;
    return { uri: parsed.uri, name: parsed.name };
  } catch {
    return null;
  }
}
/** Lo que pasó al pedirle a Android que se eligiera un archivo. */
export type ArchivoElegido =
  | {
      estado: "listo";
      /** Ruta local ("file://..."), lista para leer como cualquier otra. */
      uri: string;
      /** El nombre que le da Android. De aquí sale el reconocimiento del banco. */
      nombre: string;
      /**
       * En qué formato quedó, SOLO si hubo que convertirlo — una Hoja de
       * Google sale de aquí como "text/csv". Vacío cuando ya era un archivo.
       */
      convertido: string | null;
    }
  | { estado: "cancelado" }
  | { estado: "error"; motivo: string };

/**
 * Si esta versión de Fino sabe abrir ella misma la pantalla de elegir archivo.
 *
 * Hace falta preguntarlo porque las actualizaciones por internet no cambian la
 * parte de Android: alguien puede tener la pantalla nueva encima de una app
 * vieja que todavía no trae esto. Sin la comprobación, importar dejaría de
 * funcionar del todo para esa gente.
 */
export const puedeElegirArchivo =
  Platform.OS === "android" && typeof Native?.elegirArchivo === "function";

/**
 * Abre la pantalla de Android para elegir un archivo y lo devuelve ya copiado
 * dentro de Fino, convertido si era un documento de Google.
 *
 * Ver elegirArchivo en IncomingFileModule.kt: está escrito a mano porque la
 * librería de siempre le pone al pedido una categoría que deja las Hojas de
 * Google en gris.
 */
export async function elegirArchivo(): Promise<ArchivoElegido> {
  if (!Native?.elegirArchivo) return { estado: "error", motivo: "sin-soporte" };
  let raw: string | null;
  try {
    raw = await Native.elegirArchivo();
  } catch (e) {
    // El texto del fallo se enseña. Un error mudo aquí deja al usuario mirando
    // una pantalla que no reacciona, que es exactamente lo que costó más
    // tiempo el 12/08/2026.
    return { estado: "error", motivo: String(e) };
  }
  if (!raw) return { estado: "error", motivo: "sin-respuesta" };
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.cancelado === true) return { estado: "cancelado" };
    if (typeof p.error === "string") return { estado: "error", motivo: p.error };
    if (typeof p.uri !== "string" || typeof p.nombre !== "string") {
      return { estado: "error", motivo: "respuesta-rara" };
    }
    return {
      estado: "listo",
      uri: p.uri,
      nombre: p.nombre,
      convertido: typeof p.convertido === "string" ? p.convertido : null,
    };
  } catch {
    return { estado: "error", motivo: "respuesta-rota" };
  }
}

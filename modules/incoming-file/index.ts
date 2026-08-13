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
  traerArchivo?: (uri: string) => Promise<string | null>;
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

/** Un archivo elegido en la pantalla de Android y ya copiado dentro de Fino. */
export type ArchivoTraido = {
  /** Ruta local ("file://..."), lista para leer como cualquier otra. */
  uri: string;
  /**
   * En que formato quedo, SOLO si hubo que convertirlo — una Hoja de Google
   * sale de aqui como "text/csv". Vacio cuando el archivo ya era un archivo.
   */
  convertido: string | null;
};

/**
 * Si esta version de Fino sabe traer archivos ella misma.
 *
 * Hace falta preguntarlo porque las actualizaciones por internet no cambian
 * la parte de Android: alguien puede tener la pantalla nueva encima de una
 * app vieja que todavia no trae esta funcion. Sin esta comprobacion, importar
 * dejaria de funcionar del todo para esa gente.
 */
export const puedeTraerArchivos =
  Platform.OS === "android" && typeof Native?.traerArchivo === "function";

/**
 * Copia dentro de Fino el archivo que se acaba de elegir, y de paso convierte
 * los documentos de Google —que no son archivos y no se pueden leer— a algo
 * que si se pueda. Ver traerArchivo en IncomingFileModule.kt.
 *
 * Devuelve null si no se pudo. Quien llama tiene que avisar: aqui el usuario
 * acaba de elegir algo a proposito y el silencio no vale.
 */
export async function traerArchivo(uri: string): Promise<ArchivoTraido | null> {
  if (!Native?.traerArchivo) return null;
  try {
    const raw = await Native.traerArchivo(uri);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ArchivoTraido>;
    if (typeof parsed.uri !== "string") return null;
    return {
      uri: parsed.uri,
      convertido: typeof parsed.convertido === "string" ? parsed.convertido : null,
    };
  } catch {
    return null;
  }
}

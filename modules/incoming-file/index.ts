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

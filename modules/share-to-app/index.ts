import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** El paquete de Gmail en Android. No cambia y no hay otro. */
export const GMAIL_PACKAGE = "com.google.android.gm";

type NativeShape = {
  isAppInstalled: (packageName: string) => boolean;
  shareToPackage: (
    fileUri: string,
    mimeType: string,
    packageName: string,
    subject: string,
    text: string
  ) => boolean;
};

// requireOptionalNativeModule y no requireNativeModule: esto es código nativo
// y no viaja en las actualizaciones por internet. Quien tenga un APK anterior
// recibirá el JavaScript nuevo sin esta parte, y con la versión obligatoria la
// app no abriría. Así, simplemente, el botón de Gmail no aparece.
const Native = requireOptionalNativeModule<NativeShape>("ShareToApp");

export const isSupported = Platform.OS === "android" && Native != null;

/** ¿Está Gmail en este celular? Falso también si el módulo nativo no está. */
export function isGmailInstalled(): boolean {
  if (!Native) return false;
  try {
    return Native.isAppInstalled(GMAIL_PACKAGE);
  } catch {
    return false;
  }
}

/**
 * Abre Gmail con el archivo ya adjunto. Devuelve false si no se pudo, para
 * que quien llame ofrezca el menú de compartir de siempre en vez de dejar a
 * la persona mirando una pantalla donde no pasó nada.
 */
export function shareToGmail(
  fileUri: string,
  mimeType: string,
  subject: string,
  text: string
): boolean {
  if (!Native) return false;
  try {
    return Native.shareToPackage(fileUri, mimeType, GMAIL_PACKAGE, subject, text);
  } catch {
    return false;
  }
}

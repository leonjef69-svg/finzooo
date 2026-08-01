import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** El paquete de Gmail en Android. No cambia y no hay otro. */
export const GMAIL_PACKAGE = "com.google.android.gm";

/**
 * WhatsApp. Son DOS aplicaciones distintas y hay gente que solo tiene la de
 * negocios: mandar al paquete normal en ese celular no abriría nada.
 */
export const WHATSAPP_PACKAGE = "com.whatsapp";
export const WHATSAPP_BUSINESS_PACKAGE = "com.whatsapp.w4b";

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

/**
 * Cuál de las dos WhatsApp hay en este celular, o null si no hay ninguna.
 *
 * Se mira primero la normal porque es la que tiene casi todo el mundo. Quien
 * tenga las dos verá abrirse la normal, que es lo esperable para mandar un
 * estado de cuenta a alguien.
 */
export function whatsAppPackage(): string | null {
  if (!Native) return null;
  try {
    if (Native.isAppInstalled(WHATSAPP_PACKAGE)) return WHATSAPP_PACKAGE;
    if (Native.isAppInstalled(WHATSAPP_BUSINESS_PACKAGE)) return WHATSAPP_BUSINESS_PACKAGE;
    return null;
  } catch {
    return null;
  }
}

/** ¿Hay WhatsApp en este celular? */
export function isWhatsAppInstalled(): boolean {
  return whatsAppPackage() !== null;
}

/**
 * Abre WhatsApp con el archivo ya adjunto, para elegir a quién mandarlo.
 *
 * Va directo y no por el menú de compartir de Android a propósito: ese menú
 * lo arma Android, qué apps salen ahí cambia de un celular a otro, y WhatsApp
 * puede aparecer al final de una lista larga o no aparecer.
 *
 * Devuelve false si no se pudo, para que quien llame ofrezca el menú de
 * siempre en vez de dejar a la persona mirando una pantalla donde no pasó
 * nada.
 */
export function shareToWhatsApp(fileUri: string, mimeType: string, text: string): boolean {
  const paquete = whatsAppPackage();
  if (!Native || !paquete) return false;
  try {
    // WhatsApp ignora el asunto —no tiene—, así que va vacío. El texto sí lo
    // usa: se manda junto al archivo.
    return Native.shareToPackage(fileUri, mimeType, paquete, "", text);
  } catch {
    return false;
  }
}

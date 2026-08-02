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
  /** El paquete de la app de correo predeterminada, o "" si no hay. */
  defaultMailPackage: () => string;
  shareToPackage: (
    fileUri: string,
    mimeType: string,
    packageName: string,
    subject: string,
    text: string,
    /** A quién: un correo, o un número con código de país y solo dígitos. */
    recipient: string
  ) => boolean;
};

// requireOptionalNativeModule y no requireNativeModule: esto es código nativo
// y no viaja en las actualizaciones por internet. Quien tenga un APK anterior
// recibirá el JavaScript nuevo sin esta parte, y con la versión obligatoria la
// app no abriría. Así, simplemente, el botón de Gmail no aparece.
const Native = requireOptionalNativeModule<NativeShape>("ShareToApp");

export const isSupported = Platform.OS === "android" && Native != null;

/**
 * ¿Este APK sabe abrir la aplicación de correo directamente?
 *
 * Sirve para saber, mirando la pantalla de Acerca de, si el APK instalado es
 * el que trae esa parte o uno anterior. Sin esto no había forma de
 * distinguirlos: el módulo existe en los dos y la línea de partes nativas
 * salía igual, así que quien no recordara si llegó a instalar el nuevo tenía
 * que ponerse a exportar un documento para averiguarlo.
 *
 * Se pregunta si la función EXISTE, no si devuelve algo: en un APK anterior
 * ni siquiera está, y llamarla revienta.
 */
export const hasDirectMail =
  isSupported && typeof (Native as Partial<NativeShape> | null)?.defaultMailPackage === "function";

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
  text: string,
  /** El correo de quien lo recibe. Vacío para elegirlo dentro de Gmail. */
  recipient = ""
): boolean {
  if (!Native) return false;
  try {
    return Native.shareToPackage(fileUri, mimeType, GMAIL_PACKAGE, subject, text, recipient);
  } catch {
    return false;
  }
}

/**
 * A qué aplicación de correo mandar el archivo, o null si no hay ninguna.
 *
 * POR QUÉ NO SE DEJA QUE PREGUNTE ANDROID
 *
 * "Correo" abría el menú de Android preguntando con qué aplicación. Con la
 * orden por voz eso es justo el toque que se quiere quitar: se dice la frase
 * entera —mes, formato, destino y a quién— y aun así hay que contestar una
 * pregunta antes de llegar al correo.
 *
 * Se busca en dos pasos:
 *
 *   1. La que el celular tenga marcada para abrir direcciones de correo. Es
 *      la respuesta correcta cuando existe: es la que la persona eligió.
 *
 *   2. Si no hay ninguna marcada —el caso de quien tiene Gmail y la del
 *      fabricante y nunca eligió—, Gmail. Es a donde va a parar el correo de
 *      casi todo el mundo, y ese "casi" tiene arreglo: basta con marcar la
 *      otra como predeterminada en los ajustes de Android y el paso 1 la
 *      encuentra.
 *
 * Si no hay ni una ni otra se devuelve null y quien llame abre el menú de
 * siempre, que es mejor que no hacer nada.
 */
export function mailPackage(): string | null {
  if (!Native) return null;
  try {
    const preferida = Native.defaultMailPackage();
    if (preferida) return preferida;
    if (Native.isAppInstalled(GMAIL_PACKAGE)) return GMAIL_PACKAGE;
    return null;
  } catch {
    return null;
  }
}

/**
 * Abre la aplicación de correo con el archivo adjunto y el destinatario ya
 * puesto. Devuelve false si no se pudo, para que quien llame abra el menú de
 * siempre en vez de dejar a la persona mirando una pantalla donde no pasó
 * nada.
 */
export function shareToMail(
  fileUri: string,
  mimeType: string,
  subject: string,
  text: string,
  recipient = ""
): boolean {
  const paquete = mailPackage();
  if (!Native || !paquete) return false;
  try {
    return Native.shareToPackage(fileUri, mimeType, paquete, subject, text, recipient);
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
export function shareToWhatsApp(
  fileUri: string,
  mimeType: string,
  text: string,
  /**
   * El número con código de país y SOLO dígitos ("51999888777"). Vacío para
   * que WhatsApp abra su selector de contactos.
   *
   * Con un "+" o un espacio dentro, WhatsApp no encuentra a nadie y abre el
   * selector igual, como si no se hubiera pedido nada. Por eso el número se
   * limpia antes de guardarlo, en utils/sendContacts.
   */
  recipient = ""
): boolean {
  const paquete = whatsAppPackage();
  if (!Native || !paquete) return false;
  try {
    // WhatsApp ignora el asunto —no tiene—, así que va vacío. El texto sí lo
    // usa: se manda junto al archivo.
    return Native.shareToPackage(fileUri, mimeType, paquete, "", text, recipient);
  } catch {
    return false;
  }
}

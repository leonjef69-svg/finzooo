import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

// "round" es el círculo del tamaño de un ícono; "wide" el 2x1 con la
// etiqueta "Anotar gasto".
export type WidgetVariant = "round" | "wide";

type NativeShape = {
  canRequestPin: () => boolean;
  requestPin: (variant: string) => boolean;
};

// "Optional" porque el widget solo existe en Android y solo dentro de una
// compilación de verdad. En iPhone, en Expo Go o en un APK viejo esto vale
// null, y las funciones de abajo responden "no disponible" en vez de
// reventar la app.
const Native = requireOptionalNativeModule<NativeShape>("VoiceWidget");

export const isSupported = Platform.OS === "android" && Native != null;

/**
 * ¿Se le puede pedir a la pantalla de inicio que coloque el widget?
 *
 * Android lo permite desde la versión 8, pero algunos lanzadores —sobre
 * todo los que se instalan aparte— no lo implementan. Cuando esto es
 * false, la app explica el camino a mano en vez de ofrecer un botón que no
 * haría nada.
 */
export function canRequestPin(): boolean {
  if (!Native) return false;
  try {
    return Native.canRequestPin();
  } catch {
    return false;
  }
}

/**
 * Le pide a Android que coloque el widget. Sale la ventana de confirmación
 * del propio sistema; la app no puede colocarlo por su cuenta.
 * Devuelve false si el celular no lo permite.
 */
export function requestPin(variant: WidgetVariant = "round"): boolean {
  if (!Native) return false;
  try {
    return Native.requestPin(variant);
  } catch {
    return false;
  }
}

import { Platform } from "react-native";

/** Herramienta temporal local: jamás se activa en una compilación de producción. */
export function isLocalAccountDiagnosticMode(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__ && Platform.OS === "android"
    && process.env.EXPO_PUBLIC_FINO_LOCAL_ACCESS_DIAGNOSTIC === "1";
}

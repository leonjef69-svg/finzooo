// Recuperación acompañada autorizada, nunca disponible en la app publicada.
// La entrada Android exige además isLocalAccountDiagnosticMode().
export function isLocalAccountRecoveryEnabled(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__
    && process.env.EXPO_PUBLIC_FINO_LOCAL_ACCESS_DIAGNOSTIC === "1"
    && process.env.EXPO_PUBLIC_FINO_LOCAL_LEGACY_RECOVERY === "1";
}

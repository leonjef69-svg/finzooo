import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { LockEnabledState } from "@/utils/appLock";

const native = requireOptionalNativeModule<{
  setProtected(value: boolean): Promise<boolean>;
}>("ScreenPrivacy");

/** El APK anterior no contiene este módulo; no se debe anunciar como protegido. */
export async function applyLockScreenPrivacy(
  status: LockEnabledState,
): Promise<"confirmed" | "unsupported"> {
  if (Platform.OS !== "android" || !native) return "unsupported";
  // Ante una lectura fallida se conserva la protección, incluso en el margen
  // de regreso: tapar solo el PIN no protege la miniatura del saldo.
  if (!await native.setProtected(status !== "disabled")) {
    throw new Error("screen-privacy-unconfirmed");
  }
  return "confirmed";
}

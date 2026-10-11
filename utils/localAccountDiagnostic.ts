import AsyncStorage from "@react-native-async-storage/async-storage";
import { decryptText } from "@/utils/encryption";
import { auth } from "@/utils/firebase";
import { isLocalAccountDiagnosticMode } from "@/utils/localAccountDiagnosticMode";

const OWNER_KEY = "finzo:localAccountOwner:v1";
const PROFILE_KEY = "finzo:profile";
type LocalValue = Record<string, unknown>;
export type LocalAccountDiagnosticReason = "disabled" | "no-session" | "session-changed"
  | "read-failed" | "owner-unreadable" | "profile-unreadable" | "owner-same-active"
  | "owner-same-archived" | "owner-different" | "legacy-matching-email"
  | "legacy-different-email" | "legacy-missing-email" | "no-owner-incomplete-profile"
  | "no-owner-no-profile";
export type LocalAccountDiagnostic = {
  reason: LocalAccountDiagnosticReason;
  verified: boolean;
  ownerPresent: boolean | null;
  profilePresent: boolean | null;
  ownerMatches: boolean | null;
  configured: boolean | null;
  savedEmailPresent: boolean | null;
  emailMatches: boolean | null;
};
const emailKey = (email: unknown) => typeof email === "string" ? email.trim().toLowerCase() : "";
function empty(reason: LocalAccountDiagnosticReason, verified = false): LocalAccountDiagnostic {
  return { reason, verified, ownerPresent: null, profilePresent: null, ownerMatches: null,
    configured: null, savedEmailPresent: null, emailMatches: null };
}
function object(text: string | null): LocalValue | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as LocalValue : null;
  } catch { return null; }
}

/**
 * Lee exactamente dos metadatos; nunca abre/archiva/adjudica una cuenta.
 * El descifrado de solo lectura no crea una llave ni escanea el historial.
 * Los textos, UID, correos y nombres solo se comparan aquí: jamás se devuelven.
 * No examina movimientos, manifiestos de copias ni datos de la nube.
 */
export async function readLocalAccountDiagnostic(): Promise<LocalAccountDiagnostic> {
  if (!isLocalAccountDiagnosticMode()) return empty("disabled");
  const user = auth.currentUser;
  if (!user) return empty("no-session");
  const current = () => auth.currentUser === user;
  try {
    const values = new Map(await AsyncStorage.multiGet([OWNER_KEY, PROFILE_KEY]));
    if (!current()) return empty("session-changed");
    const rawOwner = values.get(OWNER_KEY) ?? null, rawProfile = values.get(PROFILE_KEY) ?? null;
    const result = empty("read-failed", user.emailVerified);
    result.ownerPresent = rawOwner !== null;
    result.profilePresent = rawProfile !== null;
    const owner = rawOwner === null ? null : object(await decryptText(rawOwner, { readOnly: true }));
    if (!current()) return empty("session-changed");
    if (rawOwner !== null && (!owner || typeof owner.uid !== "string" || !owner.uid
      || !["active", "archived"].includes(String(owner.mode)))) return { ...result, reason: "owner-unreadable" };
    const profile = rawProfile === null ? null : object(await decryptText(rawProfile, { readOnly: true }) ?? rawProfile);
    if (!current()) return empty("session-changed");
    if (rawProfile !== null && !profile) return { ...result, reason: "profile-unreadable" };
    result.configured = profile ? profile.hasOnboarded === true : false;
    result.savedEmailPresent = !!emailKey(profile?.userEmail);
    result.emailMatches = result.savedEmailPresent && !!emailKey(user.email)
      ? emailKey(profile?.userEmail) === emailKey(user.email) : null;
    if (owner) {
      result.ownerMatches = owner.uid === user.uid;
      result.reason = !result.ownerMatches ? "owner-different"
        : owner.mode === "active" ? "owner-same-active" : "owner-same-archived";
    } else if (profile?.hasOnboarded) {
      result.reason = !result.savedEmailPresent || !emailKey(user.email) ? "legacy-missing-email"
        : result.emailMatches ? "legacy-matching-email" : "legacy-different-email";
    } else result.reason = profile ? "no-owner-incomplete-profile" : "no-owner-no-profile";
    return result;
  } catch { return empty(current() ? "read-failed" : "session-changed"); }
}

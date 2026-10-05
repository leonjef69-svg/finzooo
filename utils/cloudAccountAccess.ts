import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/utils/firebase";

export type CloudAccountAccess = {
  uid: string;
  isPremium: boolean;
  isTester: boolean;
  canSync: boolean;
  hasCloudCopy: boolean;
  deletionPending: boolean;
  premiumTrialStartedAt?: number;
  serverNow: number;
};

// Se comparte solo la consulta que está en vuelo. No se guarda un permiso
// duradero que pueda seguir concediendo nube tras revocar Pro.
const pending = new Map<string, Promise<CloudAccountAccess>>();
function checkAccount(uid: string) {
  if (auth.currentUser?.uid !== uid || !auth.currentUser.emailVerified) throw new Error("cloud-account-changed");
}

export function getCloudAccountAccess(uid: string): Promise<CloudAccountAccess> {
  try { checkAccount(uid); } catch (error) { return Promise.reject(error); }
  const earlier = pending.get(uid);
  if (earlier) return earlier;
  const request = (async () => {
    const result = await httpsCallable<undefined, CloudAccountAccess>(functions, "getCloudAccess")();
    checkAccount(uid);
    const value = result.data;
    if (value?.uid !== uid || !Number.isFinite(value.serverNow)
      || [value.isPremium, value.isTester, value.canSync, value.hasCloudCopy, value.deletionPending].some((flag) => typeof flag !== "boolean")
      || (value.premiumTrialStartedAt !== undefined && (!Number.isFinite(value.premiumTrialStartedAt) || value.premiumTrialStartedAt < 0))) {
      throw new Error("cloud-access-invalid-response");
    }
    return value;
  })();
  pending.set(uid, request);
  void request.finally(() => { if (pending.get(uid) === request) pending.delete(uid); }).catch(() => undefined);
  return request;
}

export async function deletePersonalCloudCopy(uid: string): Promise<void> {
  checkAccount(uid);
  const result = await httpsCallable<undefined, { ok: boolean }>(functions, "deletePersonalCloudCopy", { timeout: 600_000 })();
  checkAccount(uid);
  if (result.data?.ok !== true) throw new Error("cloud-delete-invalid-response");
}

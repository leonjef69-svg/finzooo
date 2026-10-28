import { getAccountStorageSession } from "@/utils/storage";

// Solo memoria de esta sesión: volver a abrir una invitación vigente no escribe otra.
let session: ReturnType<typeof getAccountStorageSession> | undefined;
const codes = new Map<string, { until: number; value: Promise<string> }>();
export function reusableInvitation(uid: string, space: string, create: () => Promise<string>): Promise<string> {
  const current = getAccountStorageSession();
  if (session !== current) { codes.clear(); session = current; }
  const key = uid + ":" + space, now = Date.now();
  const cached = codes.get(key);
  if (cached && cached.until > now) return cached.value;
  const entry = { until: now + 7 * 86400000 - 60000, value: Promise.resolve("") };
  entry.value = create().then(code => {
    if (getAccountStorageSession() !== current) throw new Error("invitation-session-changed");
    return code;
  }).catch(error => { if (codes.get(key) === entry) codes.delete(key); throw error; });
  codes.set(key, entry);
  return entry.value;
}

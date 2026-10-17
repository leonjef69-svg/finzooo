/** Coordinación entre montajes de un espacio de la MISMA cuenta y sesión.
 * No guarda dinero ni sustituye la validación del servidor. */
type Entry = { revision: number; pending: number; listeners: Set<() => void> };
const entries = new Map<string, Entry>();
type Kind = "family" | "box";
function entry(uid: string, session: number | null, kind: Kind = "family"): Entry {
  const key = `${kind}:${uid}:${session}`;
  let value = entries.get(key);
  if (!value) { value = { revision: 0, pending: 0, listeners: new Set() }; entries.set(key, value); }
  return value;
}
export function familyMutationVersion(uid: string, session: number | null, kind: Kind = "family"): number { return entry(uid, session, kind).revision; }
export function familyMutationPending(uid: string, session: number | null, kind: Kind = "family"): boolean { return entry(uid, session, kind).pending > 0; }
export function observeFamilyMutation(uid: string, session: number | null, listener: () => void, kind: Kind = "family"): () => void {
  const value = entry(uid, session, kind); value.listeners.add(listener);
  return () => { value.listeners.delete(listener); };
}
export function beginFamilyMutation(uid: string, session: number | null, kind: Kind = "family"): () => void {
  const value = entry(uid, session, kind);
  const notify = () => { value.revision++; for (const listener of value.listeners) listener(); };
  value.pending++; notify();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true; value.pending--; notify();
  };
}

import { auth } from "@/utils/firebase";
import { getAccountStorageSession, hasUnreadableLocalData, loadJSON, saveJSONNow, STORAGE_KEYS } from "@/utils/storage";

type Preferences = { hideAmounts: boolean; collapsedPreviousBalanceMonths: string[] };
type Snapshot = Preferences & { ready: boolean };
type Entry = { uid: string; session: number | null; snapshot: Snapshot; pending?: Promise<void> };
let entry: Entry | undefined;
const listeners = new Set<() => void>();
const announce = () => { for (const listener of listeners) listener(); };

function currentEntry(): Entry {
  const uid = auth.currentUser?.uid ?? "", session = getAccountStorageSession();
  if (!entry || entry.uid !== uid || entry.session !== session) {
    entry = { uid, session, snapshot: { ready: false, hideAmounts: true, collapsedPreviousBalanceMonths: [] } };
  }
  return entry;
}
function current(target: Entry): boolean {
  return target === currentEntry() && !!target.uid && target.session !== null;
}
function normalize(value: unknown): Preferences {
  const input = value && typeof value === "object" ? value as Partial<Preferences> : {};
  return { hideAmounts: input.hideAmounts === true,
    collapsedPreviousBalanceMonths: Array.isArray(input.collapsedPreviousBalanceMonths)
      ? [...new Set(input.collapsedPreviousBalanceMonths.filter(key => typeof key === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(key)))] : [] };
}
export function readHomeVisibility(): Snapshot { return currentEntry().snapshot; }
export function subscribeHomeVisibility(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function loadHomeVisibility(): Promise<void> {
  const target = currentEntry();
  if (!current(target) || target.snapshot.ready) return Promise.resolve();
  if (target.pending) return target.pending;
  target.pending = (async () => {
    try {
      const saved = await loadJSON<unknown>(STORAGE_KEYS.homeVisibility, null);
      if (!current(target) || hasUnreadableLocalData()) return;
      target.snapshot = { ...normalize(saved), ready: true }; announce();
    } finally { target.pending = undefined; }
  })();
  return target.pending;
}
export async function updateHomeVisibility(update: (previous: Preferences) => Preferences): Promise<boolean> {
  const target = currentEntry();
  if (!current(target) || !target.snapshot.ready) return false;
  const next = normalize(update(target.snapshot));
  // Actualizar la memoria antes de esperar al disco: navegar enseguida no
  // vuelve a mostrar un saldo que la persona acaba de ocultar.
  target.snapshot = { ...next, ready: true }; announce();
  try { return await saveJSONNow(STORAGE_KEYS.homeVisibility, next) && current(target); }
  catch { return false; } // La elección más reciente no se revierte ni revela importes.
}

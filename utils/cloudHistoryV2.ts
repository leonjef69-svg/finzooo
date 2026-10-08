import {
  collection, doc, getDocs, limit, orderBy, query, runTransaction,
  serverTimestamp, Timestamp, where, writeBatch,
} from "firebase/firestore";
import type { Transaction } from "@/types";
import { db } from "@/utils/firebase";
import {
  type HistoryEntry, historyDocumentId, mergeHistoryEntries,
  planLocalHistoryChanges, UnsupportedHistoryFormatError,
} from "@/utils/cloudHistoryMigration";
import { withPrivateBoxCloudLease, type PrivateBoxCloudLease } from "@/utils/privateBoxSync";
import { assertMatchingAccountCurrencies } from "@/utils/cloudFieldMerge";

type Cache = { entries: HistoryEntry[]; checkpoint: Timestamp | null };
const caches = new Map<string, Cache>();
const pending = new Map<string, Promise<unknown>>();

function exclusive<T>(uid: string, work: () => Promise<T>): Promise<T> {
  const previous = pending.get(uid) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(work);
  const settled = result.catch(() => undefined);
  pending.set(uid, settled);
  void settled.then(() => { if (pending.get(uid) === settled) pending.delete(uid); });
  return result;
}

function parseEntry(raw: Record<string, unknown>): HistoryEntry {
  const id = raw.id;
  if (typeof id !== "number") throw new Error("historial-documento-invalido");
  historyDocumentId(id);
  if (raw.deleted === true) return { id, deleted: true };
  const transaction = raw.transaction as Transaction | undefined;
  if (raw.deleted !== false || !transaction || transaction.id !== id) {
    throw new Error("historial-documento-invalido");
  }
  return { id, deleted: false, transaction };
}

function maxTimestamp(a: Timestamp | null, b: Timestamp): Timestamp {
  if (!a || b.seconds > a.seconds ||
    (b.seconds === a.seconds && b.nanoseconds > a.nanoseconds)) return b;
  return a;
}

async function refresh(uid: string): Promise<Cache> {
  const current = caches.get(uid);
  const ref = collection(db, "users", uid, "history");
  // En la primera apertura se restaura todo. Las siguientes solo buscan cambios
  // desde la última marca conocida; >= repite el borde para no perder empates.
  const snap = current?.checkpoint
    ? await getDocs(query(ref, where("syncAt", ">=", current.checkpoint), orderBy("syncAt")))
    : await getDocs(ref);
  let entries = current?.entries ?? [];
  let checkpoint = current?.checkpoint ?? null;
  const incoming: HistoryEntry[] = [];
  for (const row of snap.docs) {
    const raw = row.data();
    if (row.id !== historyDocumentId(raw.id)) throw new Error("historial-documento-invalido");
    if (!(raw.syncAt instanceof Timestamp)) throw new Error("historial-sin-fecha-de-sincronizacion");
    incoming.push(parseEntry(raw));
    checkpoint = maxTimestamp(checkpoint, raw.syncAt);
  }
  entries = mergeHistoryEntries(entries, incoming);
  const next = { entries, checkpoint };
  caches.set(uid, next);
  return next;
}

function asLists(entries: HistoryEntry[]): { transactions: Transaction[]; deletedIds: number[] } {
  const transactions: Transaction[] = [];
  const deletedIds: number[] = [];
  for (const entry of entries) {
    if (entry.deleted) deletedIds.push(entry.id);
    else transactions.push(entry.transaction);
  }
  return { transactions, deletedIds };
}

/** Historial completo para restauración o actualización; nunca interpreta fallo como vacío. */
export function loadHistoryV2(uid: string, lease?: PrivateBoxCloudLease): Promise<{ transactions: Transaction[]; deletedIds: number[] }> {
  return withPrivateBoxCloudLease(uid, lease, approved => exclusive(uid, async () => {
    const response = asLists((await approved.wait(() => refresh(uid))).entries);
    return approved.remember(response);
  }));
}

/** Guarda solo cambios locales. Cada fila verifica de nuevo su versión dentro de una transacción. */
export function saveHistoryV2(
  uid: string, transactions: Transaction[], deletedIds: number[], lease?: PrivateBoxCloudLease,
  currency?: string,
): Promise<{ transactions: Transaction[]; deletedIds: number[] }> {
  return withPrivateBoxCloudLease(uid, lease, approved => exclusive(uid, async () => {
    let cache = await approved.wait(() => refresh(uid));
    const changes = planLocalHistoryChanges(transactions, deletedIds, cache.entries);
    for (const change of changes) {
      const rootRef = doc(db, "users", uid);
      const rowRef = doc(db, "users", uid, "history", historyDocumentId(change.id));
      const saved = await approved.wait(() => runTransaction(db, async (tx) => {
        const [root, row] = await approved.wait(() => Promise.all([tx.get(rootRef), tx.get(rowRef)]));
        if (!root.exists() || root.data().historyFormat !== 2) throw new UnsupportedHistoryFormatError();
        if (currency !== undefined) assertMatchingAccountCurrencies(
          { hasOnboarded: true, userCurrency: currency },
          { hasOnboarded: root.data().hasOnboarded === true, userCurrency: root.data().userCurrency || "PEN" },
        );
        const old = row.exists() ? parseEntry(row.data()) : null;
        const merged = mergeHistoryEntries(old ? [old] : [], [change])[0];
        if (!old || JSON.stringify(old) !== JSON.stringify(merged)) {
          approved.assertCurrent();
          tx.set(rowRef, { ...merged, syncAt: serverTimestamp() });
        }
        return merged;
      }));
      cache = { ...cache, entries: mergeHistoryEntries(cache.entries, [saved]) };
      caches.set(uid, cache);
    }
    return approved.remember(asLists((await approved.wait(() => refresh(uid))).entries));
  }));
}

export function clearHistoryV2Cache(uid: string): void {
  caches.delete(uid);
}

/** Solo se llama después de marcar la cuenta para eliminación en el servidor. */
export async function deleteHistoryV2(uid: string): Promise<void> {
  await exclusive(uid, async () => {
    const rows = collection(db, "users", uid, "history");
    while (true) {
      const page = await getDocs(query(rows, limit(200)));
      if (page.empty) break;
      const batch = writeBatch(db);
      for (const row of page.docs) batch.delete(row.ref);
      await batch.commit();
    }
    caches.delete(uid);
  });
}

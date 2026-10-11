import type { Transaction } from "@/types";
import { utf8ByteLength } from "@/utils/utf8";
import { assertNoIdentifiedDeletionOverlap, assertSameTransactionOrigin } from "@/utils/mergeTransactions";
import { recordOriginOf, recordDeletionIdentity } from "@/utils/recordOrigin";
import { mergeTransactionCopies, mutationInfo, mutationKey, metadataForRecord, metadataByRecord, mergeMutationMetadata } from "@/utils/recordMerge";

/**
 * Operaciones puras del historial por documentos. La migración de una cuenta
 * real es administrativa y manual; importar este módulo nunca la ejecuta.
 */
export type HistoryEntry = (
  | { id: number; deleted: true; origin?: string; transaction?: never }
  | { id: number; deleted: false; transaction: Transaction }
) & { mutationMeta?: Record<string, number>; recordIdentity?: Record<string, string> };

export class UnsupportedHistoryFormatError extends Error {
  readonly code = "cloud/history-format-unsupported";
  constructor() {
    super("historial-formato-no-compatible");
    this.name = "UnsupportedHistoryFormatError";
  }
}

export class InvalidRecordIdentityFormatError extends Error {
  readonly code = "cloud/record-identity-invalid";
  constructor() {
    super("cloud-field-invalid");
    this.name = "InvalidRecordIdentityFormatError";
  }
}

/** No quitar un marcador desconocido al reconstruir una copia antigua.
 * Ausencia es el formato histórico; solo se interpreta la revisión conocida.
 * La activación de una revisión nueva requiere app/reglas/servidor juntos. */
export function assertKnownRecordIdentityFormat(data: { recordIdentityFormat?: unknown } | null): void {
  const format = data?.recordIdentityFormat;
  if (format === undefined || format === 1 || format === 2) return;
  if (typeof format !== "number" || !Number.isSafeInteger(format) || format < 1) throw new InvalidRecordIdentityFormatError();
  throw new UnsupportedHistoryFormatError();
}

/** Una app que solo entiende la lista antigua jamás debe sobrescribir otro formato. */
export function assertLegacyHistoryFormat(data: { historyFormat?: unknown } | null): void {
  if (data?.historyFormat !== undefined && data.historyFormat !== 1) {
    throw new UnsupportedHistoryFormatError();
  }
}

const MAX_BATCH_DOCUMENTS = 200;
const MAX_BATCH_BYTES = 4_000_000;
const MAX_DOCUMENT_BYTES = 800_000;

export function historyDocumentId(id: number): string {
  if (!Number.isSafeInteger(id)) throw new Error("historial-id-invalido");
  return String(id);
}

/** Los borrados conocidos prevalecen sobre copias antiguas del movimiento. */
export function stageLegacyHistory(transactions: Transaction[], deletedIds: number[], deletedOrigins: Record<string, string> = {}, metadata: Record<string, number> = {}): HistoryEntry[] {
  let source = metadata;
  for (const id of deletedIds) if (deletedOrigins[id] && !mutationInfo(source, "transaction").has(id)) {
    source = { ...source, [mutationKey("transaction", "delete", id, deletedOrigins[id], "")]: 0 };
  }
  const known = mutationInfo(source, "transaction"), metadataGroups = metadataByRecord(source, "transaction");
  assertNoIdentifiedDeletionOverlap(transactions, deletedIds.filter(id => !known.has(id)));
  const rows: HistoryEntry[] = transactions.map((transaction) => ({
    id: transaction.id,
    deleted: false,
    transaction,
    ...(known.has(transaction.id) ? { mutationMeta: metadataGroups.get(transaction.id)! } : {}),
  }));
  rows.push(...deletedIds.map((id) => {
    const origin = deletedOrigins[id];
    if (origin !== undefined && (typeof origin !== "string" || !origin)) throw new InvalidRecordIdentityFormatError();
    return { id, deleted: true as const, ...(origin ? { origin } : {}),
      ...(known.has(id) ? { mutationMeta: metadataGroups.get(id)! } : {}) };
  }));
  return mergeHistoryEntries([], rows);
}

/** Calcula solo los cambios locales frente a la última copia confirmada.
 * Ausencia en la lista local no significa borrado: puede ser un teléfono sin restaurar.
 */
export function planLocalHistoryChanges(
  transactions: Transaction[],
  deletedIds: number[],
  baseline: HistoryEntry[],
  deletedOrigins: Record<string, string> = {},
  metadata: Record<string, number> = {},
): HistoryEntry[] {
  const previous = new Map(baseline.map(entry => [entry.id, entry]));
  const local = stageLegacyHistory(transactions, deletedIds, deletedOrigins, metadata);
  return mergeHistoryEntries(baseline, local).filter(entry => canonical(entry) !== canonical(previous.get(entry.id)));
}

/** Dos teléfonos pueden aportar cambios distintos; un borrado nunca resucita. */
export function mergeHistoryEntries(existing: HistoryEntry[], incoming: HistoryEntry[]): HistoryEntry[] {
  const a = historyEntryLists(existing), b = historyEntryLists(incoming);
  // No escoger al azar dos ediciones con la misma versión/generación.
  const known = new Map<number, Transaction>();
  for (const record of [...a.transactions, ...b.transactions]) {
    const previous = known.get(record.id);
    if (previous && (previous.restorationId || "") === (record.restorationId || "")
      && (previous.updatedAt || 0) === (record.updatedAt || 0) && canonical(previous) !== canonical(record)) {
      assertSameTransactionOrigin(previous, record); throw new Error("historial-edicion-en-conflicto");
    }
    known.set(record.id, record);
  }
  const result = mergeTransactionCopies(a.transactions, b.transactions, a.deletedIds, b.deletedIds, a.syncUpdatedAt, b.syncUpdatedAt);
  const info = mutationInfo(result.metadata, "transaction"), groups = metadataByRecord(result.metadata, "transaction");
  const identities = new Map<number, Record<string, string>>();
  for (const entry of [...existing, ...incoming]) {
    const state = info.get(entry.id);
    const identity = entry.deleted ? entry.recordIdentity : state?.deleted ? recordDeletionIdentity(entry.transaction) : undefined;
    if (identity && state?.deleted && recordOriginOf({ id: entry.id, ...identity }) === state.origin
      && (identity.restorationId || "") === state.generation) identities.set(entry.id, identity);
  }
  const rows: HistoryEntry[] = result.transactions.map(transaction => ({ id: transaction.id, deleted: false, transaction,
    ...(info.has(transaction.id) ? { mutationMeta: groups.get(transaction.id)! } : {}) }));
  rows.push(...result.deletedIds.map(id => ({ id, deleted: true as const,
    ...(info.has(id) ? { origin: info.get(id)!.origin, mutationMeta: groups.get(id)! } : {}),
    ...(identities.has(id) ? { recordIdentity: identities.get(id)! } : {}) })));
  return rows.sort((a, b) => a.id - b.id);
}

export function historyEntryLists(entries: HistoryEntry[]): { transactions: Transaction[]; deletedIds: number[]; syncUpdatedAt: Record<string, number> } {
  const transactions: Transaction[] = [], deletedIds: number[] = [];
  let syncUpdatedAt: Record<string, number> = {};
  for (const entry of entries) {
    historyDocumentId(entry.id);
    let metadata = entry.mutationMeta || {};
    const own = metadataForRecord(metadata, "transaction", entry.id);
    if (Object.keys(own).length !== Object.keys(metadata).length) throw new InvalidRecordIdentityFormatError();
    const state = mutationInfo(metadata, "transaction").get(entry.id);
    if (entry.recordIdentity) {
      const identity = entry.recordIdentity;
      if (!entry.deleted || typeof identity !== "object" || Array.isArray(identity)
        || Object.keys(identity).some(key => !["creationId", "captureId", "internalTransferLink", "internalTransfer", "internalTransferSpaceId", "restorationId", "restorationParent"].includes(key))
        || Object.values(identity).some(value => typeof value !== "string")
        || !entry.origin || recordOriginOf({ id: entry.id, ...identity }) !== entry.origin
        || state && (identity.restorationId || "") !== state.generation) throw new Error("record-origin-conflict");
    }
    if (entry.deleted && state && (!state.deleted || entry.origin !== undefined && state.origin !== entry.origin)) throw new Error("record-origin-conflict");
    if (entry.deleted && entry.origin && !state) {
      metadata = { ...metadata, [mutationKey("transaction", "delete", entry.id, entry.origin, "")]: 0 };
    }
    for (const [key, value] of Object.entries(metadata)) syncUpdatedAt[key] = Math.max(syncUpdatedAt[key] || 0, value);
    if (entry.deleted) deletedIds.push(entry.id); else transactions.push(entry.transaction);
  }
  return { transactions, deletedIds, syncUpdatedAt: mergeMutationMetadata(syncUpdatedAt) };
}

/** La marca histórica solo tiene un número. No acredita el borrado de una
 * creación identificada, ni autoriza retirar su original durante migración.
 * Es un freno conservador, NO un protocolo de restauración ya completado. */
function assertUnambiguousHistoryDeletion(a: HistoryEntry, b: HistoryEntry): void {
  if (a.mutationMeta || b.mutationMeta) { mergeHistoryEntries([a], [b]); return; }
  if (a.deleted && b.deleted && (a.origin || b.origin) && a.origin !== b.origin) throw new Error("record-origin-conflict");
  if (a.deleted === b.deleted) return;
  const mark = a.deleted ? a : b;
  const live = a.deleted ? b : a;
  if (mark.deleted && mark.origin && !live.deleted) {
    if (mark.origin !== recordOriginOf(live.transaction)) throw new Error("record-origin-conflict");
    return;
  }
  if (!live.deleted && (live.transaction.creationId || live.transaction.captureId || live.transaction.internalTransferLink)) {
    throw new Error("record-origin-conflict");
  }
}

/** Lotes acotados tanto por cantidad de documentos como por bytes. */
export function historyBatches(entries: HistoryEntry[]): HistoryEntry[][] {
  const batches: HistoryEntry[][] = [];
  let batch: HistoryEntry[] = [];
  let bytes = 0;
  for (const entry of entries) {
    historyDocumentId(entry.id);
    const size = utf8ByteLength(JSON.stringify(entry));
    if (size > MAX_DOCUMENT_BYTES) throw new Error("historial-movimiento-demasiado-grande");
    if (batch.length && (batch.length >= MAX_BATCH_DOCUMENTS || bytes + size > MAX_BATCH_BYTES)) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(entry);
    bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** No se puede retirar el formato viejo hasta comprobar que cada fila llegó. */
export function missingFromShadow(source: HistoryEntry[], shadow: HistoryEntry[]): number[] {
  const persisted = new Map(mergeHistoryEntries([], shadow).map((entry) => [entry.id, entry]));
  const missing: number[] = [];
  for (const entry of mergeHistoryEntries([], source)) {
    const stored = persisted.get(entry.id);
    if (stored && (stored.mutationMeta || entry.mutationMeta)) {
      if (canonical(mergeHistoryEntries([stored], [entry])[0]) !== canonical(stored)) missing.push(entry.id);
      continue;
    }
    if (stored) assertUnambiguousHistoryDeletion(stored, entry);
    if (!stored || (entry.deleted && !stored.deleted)) {
      missing.push(entry.id);
      continue;
    }
    if (entry.deleted || stored.deleted) continue;
    assertSameTransactionOrigin(entry.transaction, stored.transaction);
    const oldVersion = entry.transaction.updatedAt ?? 0;
    const savedVersion = stored.transaction.updatedAt ?? 0;
    if (savedVersion < oldVersion ||
      (savedVersion === oldVersion && canonical(stored.transaction) !== canonical(entry.transaction))) {
      missing.push(entry.id);
    }
  }
  return missing;
}

export type LegacyHistorySnapshot = {
  /** Debe cambiar ante cualquier escritura en el documento antiguo. */
  revision: string;
  transactions: Transaction[];
  deletedIds: number[];
  syncUpdatedAt?: Record<string, number>;
  deletedOrigins?: Record<string, string>;
};

export type HistoryShadowStore = {
  readLegacy: () => Promise<LegacyHistorySnapshot>;
  readShadow: () => Promise<HistoryEntry[]>;
  /** Fusiona cada documento con lo ya persistido; nunca pisa una edición nueva. */
  mergeBatch: (batch: HistoryEntry[]) => Promise<void>;
};

export type HistoryShadowResult =
  | { ready: true; revision: string; missing: [] }
  | { ready: false; reason: "legacy-changed" | "shadow-incomplete"; missing?: number[] };

/**
 * Copia verificable y reanudable. No retira ni modifica el documento antiguo.
 * El escritor real debe fusionar cada lote atómicamente con el destino.
 */
export async function stageHistoryShadow(store: HistoryShadowStore): Promise<HistoryShadowResult> {
  const initial = await store.readLegacy();
  const source = stageLegacyHistory(initial.transactions, initial.deletedIds, initial.deletedOrigins ?? {}, initial.syncUpdatedAt ?? {});
  const existing = await store.readShadow();
  const missingIds = new Set(missingFromShadow(source, existing));
  const pending = source.filter((entry) => missingIds.has(entry.id));
  for (const batch of historyBatches(pending)) await store.mergeBatch(batch);

  const latest = await store.readLegacy();
  if (latest.revision !== initial.revision) return { ready: false, reason: "legacy-changed" };
  const remaining = missingFromShadow(source, await store.readShadow());
  return remaining.length === 0
    ? { ready: true, revision: initial.revision, missing: [] }
    : { ready: false, reason: "shadow-incomplete", missing: remaining };
}

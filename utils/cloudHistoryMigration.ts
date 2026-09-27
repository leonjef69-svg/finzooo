import type { Transaction } from "@/types";
import { utf8ByteLength } from "@/utils/utf8";

/**
 * Preparación del futuro historial por documentos. No activa la migración:
 * todavía faltan el lector/escritor de Firestore, las reglas y Telegram.
 * Mantener esta parte pura permite probar la conservación antes de tocar datos reales.
 */
export type HistoryEntry =
  | { id: number; deleted: true; transaction?: never }
  | { id: number; deleted: false; transaction: Transaction };

export class UnsupportedHistoryFormatError extends Error {
  readonly code = "cloud/history-format-unsupported";
  constructor() {
    super("historial-formato-no-compatible");
    this.name = "UnsupportedHistoryFormatError";
  }
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
export function stageLegacyHistory(transactions: Transaction[], deletedIds: number[]): HistoryEntry[] {
  const rows: HistoryEntry[] = transactions.map((transaction) => ({
    id: transaction.id,
    deleted: false,
    transaction,
  }));
  rows.push(...deletedIds.map((id) => ({ id, deleted: true as const })));
  return mergeHistoryEntries([], rows);
}

/** Dos teléfonos pueden aportar cambios distintos; un borrado nunca resucita. */
export function mergeHistoryEntries(existing: HistoryEntry[], incoming: HistoryEntry[]): HistoryEntry[] {
  const byId = new Map<number, HistoryEntry>();
  for (const entry of [...existing, ...incoming]) {
    historyDocumentId(entry.id);
    const previous = byId.get(entry.id);
    if (previous && !previous.deleted && !entry.deleted &&
      (entry.transaction.updatedAt ?? 0) === (previous.transaction.updatedAt ?? 0) &&
      canonical(entry.transaction) !== canonical(previous.transaction)) {
      throw new Error("historial-edicion-en-conflicto");
    }
    if (!previous || entry.deleted || (!previous.deleted &&
      (entry.transaction.updatedAt ?? 0) >= (previous.transaction.updatedAt ?? 0))) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
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
    if (!stored || (entry.deleted && !stored.deleted)) {
      missing.push(entry.id);
      continue;
    }
    if (entry.deleted || stored.deleted) continue;
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
  const source = stageLegacyHistory(initial.transactions, initial.deletedIds);
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

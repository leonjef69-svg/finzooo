import type { Transaction } from "@/types";
import type { RawRow } from "@/utils/importEngine";
import { findBestMatchInIndex, mergeTransaction, type DuplicateDateIndex, type DuplicateMatch } from "@/utils/duplicates";

export type ImportCandidate = {
  tx: Transaction;
  raw: RawRow;
  match: DuplicateMatch | null;
  /** Repetido dentro del propio archivo; aún no existe en Personal. */
  inFile?: boolean;
};
export type ImportResolution = "new" | "merge" | "keepBoth" | "skip";

export function importRowKey(row: RawRow): string {
  const text = (s?: string) => (s ?? "").trim().toUpperCase();
  return JSON.stringify([row.date, row.amount, row.type, text(row.account),
    text(row.reference), ...(row.reference ? [] : [text(row.description), text(row.merchant), text(row.methodRaw)])]);
}

/** Se comparte entre las tandas con fecha y las que reciben un mes elegido. */
export function buildImportCandidates(
  rows: RawRow[], index: DuplicateDateIndex, matched: Set<number>,
  seen: Map<string, ImportCandidate>, makeTransaction: (row: RawRow) => Transaction,
): ImportCandidate[] {
  // La dirección puede cambiar qué filas son duplicadas. Esperar a resolver
  // todos evita clasificar con un gasto supuesto y recorrer el índice por toque.
  if (rows.some(row => row.typePending)) return rows.map(raw => ({ tx: makeTransaction(raw), raw, match: null }));
  return rows.map(raw => {
    const tx = makeTransaction(raw);
    const key = importRowKey(raw);
    const earlier = seen.get(key);
    // Si la primera fila ya coincide con Personal, todas sus repeticiones
    // también. Si es nueva, se puede omitir o conservar ambas explícitamente.
    const match = earlier?.match ?? (earlier
      ? { existing: earlier.tx, score: 100, level: "high" as const, reasons: ["file"] }
      : findBestMatchInIndex(index, raw, matched));
    if (match && !earlier) matched.add(match.existing.id);
    const candidate = { tx, raw, match, inFile: Boolean(earlier && !earlier.match) };
    if (!earlier) seen.set(key, candidate);
    return candidate;
  });
}

export function pendingImportTypeCount(candidates: ImportCandidate[], undated: RawRow[]): number {
  return candidates.reduce((n, candidate) => n + Number(Boolean(candidate.raw.typePending)), 0)
    + undated.reduce((n, row) => n + Number(Boolean(row.typePending)), 0);
}

/** Solo cambia la fila elegida y conserva IDs, importes, fechas y otras
 * elecciones. La búsqueda completa de duplicados se hace al terminar. */
export function classifyImportRow(
  candidates: ImportCandidate[], undated: RawRow[], sourceRow: number,
  type: "expense" | "income", index: DuplicateDateIndex,
  categoryFor: (row: RawRow) => string,
): { candidates: ImportCandidate[]; undated: RawRow[] } {
  let changed = false;
  const choose = (row: RawRow): RawRow => {
    if (row.sourceRow !== sourceRow || !row.typeUncertain || (!row.typePending && row.type === type)) return row;
    changed = true;
    return { ...row, type, typePending: false };
  };
  let updated = candidates.map(candidate => {
    const raw = choose(candidate.raw);
    return raw === candidate.raw ? candidate : {
      ...candidate, raw, tx: { ...candidate.tx, type, category: categoryFor(raw) }, match: null, inFile: false,
    };
  });
  const updatedUndated = undated.map(choose);
  if (!changed) return { candidates, undated };
  if (pendingImportTypeCount(updated, updatedUndated) === 0) {
    const transactions = new Map(updated.map(candidate => [candidate.raw, candidate.tx]));
    updated = buildImportCandidates(updated.map(candidate => candidate.raw), index, new Set(), new Map(), raw => transactions.get(raw)!);
  }
  return { candidates: updated, undated: updatedUndated };
}

export function resolveImportCandidates(candidates: ImportCandidate[], resolutions: Map<number, ImportResolution>) {
  if (candidates.some(candidate => candidate.raw?.typePending)) throw new Error("import-type-unresolved");
  const toAdd: Transaction[] = [];
  const replacements = new Map<number, Transaction>();
  for (const candidate of candidates) {
    const decision = resolutions.get(candidate.tx.id) ?? (candidate.match ? "skip" : "new");
    if (decision === "skip") continue;
    if (decision === "merge" && candidate.match) {
      if (candidate.inFile) throw new Error("import-in-file-merge");
      replacements.set(candidate.match.existing.id, mergeTransaction(candidate.match.existing, candidate.raw));
    } else toAdd.push(candidate.tx);
  }
  return { toAdd, toReplace: [...replacements.values()] };
}

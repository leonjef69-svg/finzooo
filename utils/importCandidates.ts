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

export function resolveImportCandidates(candidates: ImportCandidate[], resolutions: Map<number, ImportResolution>) {
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

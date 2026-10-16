import type { Transaction } from "@/types";
import { canonical } from "@/functions/src/private-box-money-shared";
import { mergeMutationMetadata, metadataForRecord } from "@/utils/recordMerge";

export type SharedTransferProof = { space: Record<string, unknown>; movement: Record<string, unknown> };
type ReadProof = (kind: "family" | "box", spaceId: string, movementId: string) => Promise<SharedTransferProof | null>;
const referenceFields = ["creationId", "internalTransferSpaceId", "restorationId", "restorationParent"] as const;
const legacyDifferences = new Set<string>([...referenceFields, "updatedAt", "time", "internalTransferSpaceName",
  "internalTransferAllocations", "internalTransferSettled", "internalTransferConsumedAmount"]);

/** Solo completa referencias ausentes de la copia v1 de un aporte comprobado.
 * No cambia el contrato general de identidades ni elige entre importes distintos.
 * leer DEBE usar la misma transacción de Firestore que guardará el respaldo. */
export async function completarReferenciasCompartidasAntiguas(uid: string, currency: string,
  local: Transaction[], remote: Transaction[], localMeta: Record<string, number>, remoteMeta: Record<string, number>, leer: ReadProof) {
  const byId = new Map(local.map(row => [row.id, row]));
  let metadata = remoteMeta;
  const transactions: Transaction[] = [];
  const matchesProof = async (row: Transaction) => {
    if ((row.internalTransfer !== "family" && row.internalTransfer !== "box") || !row.internalTransferSpaceId || !row.internalTransferLink) return false;
    const proof = await leer(row.internalTransfer, row.internalTransferSpaceId, row.internalTransferLink);
    if (!proof || proof.space.currency !== currency || proof.space.accountDeletionPending === true
      || proof.space.migrationComplete === false || proof.movement.personalOwnerUid !== uid
      || proof.movement.personalTransactionId !== row.id || proof.movement.fecha !== row.date) return false;
    const returned = row.type === "income";
    if (proof.movement.tipo !== (returned ? "gasto" : "ingreso")
      || (returned ? proof.movement.personalReturnAmount : proof.movement.monto) !== row.amount) return false;
    if (row.internalTransferSettled && proof.space.closed !== true) return false;
    // Una cantidad consumida no se deduce de que una Caja esté cerrada.
    if ((row.internalTransferConsumedAmount ?? 0) !== 0) return false;
    return true;
  };
  for (const old of remote) {
    const current = byId.get(old.id);
    if (!current?.creationId || old.creationId || old.captureId || old.restorationId || old.restorationParent
      || old.internalTransferSpaceId || !old.internalTransferLink || current.internalTransferLink !== old.internalTransferLink
      || current.internalTransfer !== old.internalTransfer || !current.internalTransferSpaceId
      || (current.updatedAt ?? 0) <= (old.updatedAt ?? 0)
      || (old.internalTransferConsumedAmount ?? 0) !== 0
      || (old.internalTransferSettled === true && current.internalTransferSettled !== true)
      || (Boolean(old.internalTransferAllocations?.length)
        && canonical(old.internalTransferAllocations) !== canonical(current.internalTransferAllocations))
      || Object.keys(metadataForRecord(remoteMeta, "transaction", old.id)).length
      || [...new Set([...Object.keys(current), ...Object.keys(old)])].some(key => !legacyDifferences.has(key)
        && canonical(current[key as keyof Transaction]) !== canonical(old[key as keyof Transaction]))) {
      transactions.push(old); continue;
    }
    if (!await matchesProof(current)) { transactions.push(old); continue; }
    const allocations = current.internalTransferAllocations ?? [];
    if (allocations.length && (current.type !== "income" || new Set(allocations.map(item => item.transactionId)).size !== allocations.length
      || allocations.some(item => !Number.isFinite(item.amount) || item.amount <= 0)
      || allocations.reduce((sum, item) => sum + Math.round(item.amount * 1000), 0) !== Math.round(current.amount * 1000))) {
      transactions.push(old); continue;
    }
    let allocationProofs = true;
    for (const allocation of allocations) {
      const contribution = byId.get(allocation.transactionId);
      if (!contribution || contribution.type !== "expense" || contribution.internalTransfer !== current.internalTransfer
        || contribution.internalTransferSpaceId !== current.internalTransferSpaceId || allocation.amount > contribution.amount
        || !await matchesProof(contribution)) { allocationProofs = false; break; }
    }
    if (!allocationProofs) { transactions.push(old); continue; }
    const identified = { ...old };
    for (const key of referenceFields) {
      const value = current[key];
      if (value !== undefined) identified[key] = value;
    }
    // Reutiliza exclusivamente la cadena ya guardada en el teléfono; no crea
    // una restauración, UUID, movimiento, devolución o marca de borrado nuevos.
    metadata = mergeMutationMetadata(metadata, metadataForRecord(localMeta, "transaction", old.id));
    transactions.push(identified);
  }
  return { transactions, metadata };
}

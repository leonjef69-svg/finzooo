import type { Transaction } from "@/types";
import type { DatosCajas, MovimientoCaja } from "@/utils/cajas";

/** No compartir una mitad heredada dejando atrás su contraparte. */
export function privateBoxLinksMatch(data: DatosCajas, rows: Transaction[], boxId: string): boolean {
  const linked = data.movimientos.filter(row => row.cajaId === boxId && row.personalTransactionId != null);
  const personal = rows.filter(row => row.internalTransfer === "box" && row.internalTransferSpaceId === boxId && !row.internalTransferSettled);
  const byId = new Map(personal.map(row => [row.id, row]));
  return linked.length === personal.length && new Set(linked.map(row => row.personalTransactionId)).size === linked.length
    && linked.every(row => {
      const tx = byId.get(row.personalTransactionId!);
      return !!tx && tx.internalTransferLink === row.id && tx.amount === (row.personalReturnAmount ?? row.monto)
        && tx.type === (row.personalReturnAmount != null ? "income" : "expense");
    });
}

export function validatePrivateBoxPatch(before: DatosCajas, next: DatosCajas, rows: Transaction[], upserts: Transaction[], deleteIds: number[], uid: string): void {
  const old = new Map(rows.map(row => [row.id, row]));
  const source = new Map(before.movimientos.filter(row => row.personalTransactionId != null).map(row => [row.personalTransactionId!, row]));
  const target = new Map(next.movimientos.filter(row => row.personalTransactionId != null).map(row => [row.personalTransactionId!, row]));
  if (source.size !== before.movimientos.filter(row => row.personalTransactionId != null).length
    || target.size !== next.movimientos.filter(row => row.personalTransactionId != null).length) throw new Error("private-box-id-conflict");
  const changed = new Set(upserts.map(row => row.id)), removed = new Set(deleteIds);
  const financial = (row: MovimientoCaja) => JSON.stringify([row.id, row.cajaId, row.tipo, row.monto, row.personalReturnAmount ?? null]);
  for (const [id, row] of target) {
    if ((!source.has(id) || financial(source.get(id)!) !== financial(row)) && !changed.has(id)) throw new Error("private-box-invalid-patch");
  }
  for (const id of source.keys()) {
    if (!target.has(id) && !changed.has(id) && !removed.has(id)) throw new Error("private-box-invalid-patch");
  }
  const matches = (tx: Transaction, row: MovimientoCaja) => row.tipo === (row.personalReturnAmount != null ? "gasto" : "ingreso")
    && tx.internalTransfer === "box" && tx.internalTransferLink === row.id
    && tx.internalTransferSpaceId === row.cajaId && tx.type === (row.personalReturnAmount != null ? "income" : "expense")
    && tx.amount === (row.personalReturnAmount ?? row.monto);
  for (const id of deleteIds) {
    const row = source.get(id);
    if (!row || target.has(id) || (old.has(id) && !matches(old.get(id)!, row))) throw new Error("private-box-id-conflict");
  }
  for (const tx of upserts) {
    const prior = old.get(tx.id), from = source.get(tx.id), to = target.get(tx.id);
    if (prior && (!from || !matches(prior, from))) throw new Error("private-box-id-conflict");
    if (to) { if (!matches(tx, to)) throw new Error("private-box-invalid-patch"); continue; }
    const conversion = from && next.conversiones?.[from.cajaId];
    const converted = conversion?.uid === uid && conversion.targetId === tx.internalTransferSpaceId
      && conversion.links.some(link => link.personalId === tx.id && link.movementId === tx.internalTransferLink)
      && prior && tx.amount === prior.amount && tx.type === prior.type;
    const closed = from && prior && tx.internalTransferSettled === true && tx.internalTransferSpaceId === from.cajaId
      && next.cajasBorradas.includes(from.cajaId) && tx.amount === prior.amount && tx.type === prior.type;
    if (!converted && !closed) throw new Error("private-box-invalid-patch");
  }
}

/** La misma modificación se usa para preparar disco y para actualizar memoria. */
export function patchPrivateBoxPersonal(rows: Transaction[], deleted: number[], upserts: Transaction[], deleteIds: number[], now = Date.now()) {
  const remove = new Set(deleteIds), changes = new Map(upserts.map(row => [row.id, row]));
  if (changes.size !== upserts.length || upserts.some(row => remove.has(row.id) || !Number.isSafeInteger(row.id) || row.id <= 0
    || row.internalTransfer !== "box" || !row.internalTransferLink || !row.internalTransferSpaceId
    || !Number.isFinite(row.amount) || row.amount <= 0 || !Number.isSafeInteger(Math.round(row.amount * 1000)))) throw new Error("private-box-invalid-patch");
  const known = new Map(rows.map(row => [row.id, row]));
  if (deleteIds.some(id => !Number.isSafeInteger(id) || id <= 0 || (known.has(id) && known.get(id)!.internalTransfer !== "box"))
    || upserts.some(row => known.has(row.id) && known.get(row.id)!.internalTransfer !== "box")
    || upserts.some(row => !known.has(row.id) && deleted.includes(row.id))) throw new Error("private-box-id-conflict");
  const merge = (old: Transaction | undefined, next: Transaction): Transaction => ({ ...old, ...next,
    ...(old?.internalTransferSettled && !next.internalTransferSettled ? { internalTransferSettled: old.internalTransferSettled, internalTransferConsumedAmount: old.internalTransferConsumedAmount } : {}),
    updatedAt: Math.max(now, (old?.updatedAt ?? 0) + 1, next.updatedAt ?? 0) });
  return {
    transactions: [...upserts.filter(row => !known.has(row.id)).map(row => merge(undefined, row)),
      ...rows.filter(row => !remove.has(row.id)).map(row => changes.has(row.id) ? merge(row, changes.get(row.id)!) : row)],
    deletedIds: [...new Set([...deleted.filter(id => !changes.has(id)), ...deleteIds])],
  };
}

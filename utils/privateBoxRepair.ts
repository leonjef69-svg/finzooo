import type { Transaction } from "@/types";
import { CAJAS_VACIAS, fusionarCajas, siguienteVersionCaja, type DatosCajas, type MovimientoCaja } from "@/utils/cajas";
import { linkedTransferLedger } from "@/utils/linkedTransfers";

export type PrivateBoxRepairChoice = { movementId: string; from: "personal" | "box" };
export type PrivateBoxConflict = {
  movementId?: string; personalId?: number; boxId?: string;
  reason: "identity" | "deleted" | "settled" | "values" | "missing";
  /** Solo una pareja inequívoca puede ofrecer elegir monto/fecha. */
  selectable?: boolean;
};
export type PrivateBoxRepairPlan = { data: DatosCajas; upserts: Transaction[]; conflicts: PrivateBoxConflict[] };
const clean = (value: unknown): string => JSON.stringify(value, (key, item) => key === "updatedAt" ? undefined
  : item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);
const allocationsEqual = (a: Transaction["internalTransferAllocations"], b: Transaction["internalTransferAllocations"]): boolean => {
  const order = (items: NonNullable<Transaction["internalTransferAllocations"]>) => [...items].sort((x, y) => x.transactionId - y.transactionId);
  return JSON.stringify(order(a || [])) === JSON.stringify(order(b || []));
};
const direction = (row: MovimientoCaja) => row.personalReturnAmount != null ? "income" as const : row.tipo === "ingreso" ? "expense" as const : null;
const amount = (row: MovimientoCaja) => row.personalReturnAmount ?? row.monto;

/** Lee ambas mitades. Ni la ausencia ni una coincidencia de monto/fecha prueban un borrado o un vínculo. */
export function planPrivateBoxRepair(data: DatosCajas, rows: Transaction[], deleted: number[], uid: string): PrivateBoxRepairPlan {
  const conflicts: PrivateBoxConflict[] = [], upserts = new Map<number, Transaction>();
  const deletedPersonal = new Set(deleted), deletedMovements = new Set(data.movimientosBorrados);
  const seen = new Set<number>(), reused = new Set<number>();
  for (const row of rows) { if (seen.has(row.id)) reused.add(row.id); seen.add(row.id); }
  for (const move of data.movimientos) {
    if (move.personalTransactionId == null) continue;
    if (seen.has(-move.personalTransactionId)) reused.add(move.personalTransactionId);
    seen.add(-move.personalTransactionId);
  }
  const pending = new Set(data.cajas.filter(box => box.sharingPending).map(box => box.id));
  const boxes = new Map(data.cajas.map(box => [box.id, box]));
  const personal = rows.filter(tx => tx.internalTransfer === "box"), used = new Set<number>();
  const rowsById = new Map(rows.map(tx => [tx.id, tx]));
  const byMovement = new Map<string, Transaction[]>(), weak = new Map<string, Set<string | undefined>>();
  const weakKey = (type: string | null, value: number, date: string) => JSON.stringify([type, value, date]);
  const withReturns = new Set(data.movimientos.filter(move => move.personalReturnAmount != null).map(move => move.cajaId));
  for (const tx of personal) {
    if (tx.internalTransferLink) {
      const linked = byMovement.get(tx.internalTransferLink) || [];
      linked.push(tx); byMovement.set(tx.internalTransferLink, linked);
    } else if (!tx.internalTransferSettled) {
      const key = weakKey(tx.type, tx.amount, tx.date), spaces = weak.get(key) || new Set<string | undefined>();
      spaces.add(tx.internalTransferSpaceId || undefined); weak.set(key, spaces);
    }
  }
  const conflictBoxes = new Set<string>(), conflictPersonal = new Set<number>();
  const changed = new Map<string, MovimientoCaja>();
  const conflict = (move: MovimientoCaja, reason: PrivateBoxConflict["reason"], tx?: Transaction, selectable = false) => {
    conflicts.push({ movementId: move.id, personalId: tx?.id ?? move.personalTransactionId, boxId: move.cajaId, reason, selectable });
    conflictBoxes.add(move.cajaId);
    if (tx?.id != null || move.personalTransactionId != null) conflictPersonal.add(tx?.id ?? move.personalTransactionId!);
  };
  for (const move of data.movimientos) {
    if (!boxes.has(move.cajaId) || pending.has(move.cajaId)) continue;
    const byLink = byMovement.get(move.id) || [];
    const tx = move.personalTransactionId == null ? byLink[0] : rowsById.get(move.personalTransactionId);
    if (move.personalTransactionId == null && byLink.length === 0) {
      // No enlazar un ingreso externo por coincidir con una transferencia del mismo día.
      const spaces = weak.get(weakKey(direction(move), amount(move), move.fecha));
      if (spaces?.has(undefined) || spaces?.has(move.cajaId)) conflict(move, "identity");
      continue;
    }
    if (byLink.length > 1 || (tx && (reused.has(tx.id) || used.has(tx.id)))
      || (move.personalTransactionId != null && reused.has(move.personalTransactionId))
      || byLink.some(row => row.id !== (tx?.id ?? move.personalTransactionId))) { conflict(move, "identity", tx); continue; }
    const type = direction(move);
    if (!type || (tx && (tx.internalTransfer !== "box" || tx.type !== type
      || (tx.internalTransferLink && tx.internalTransferLink !== move.id)
      || (tx.internalTransferSpaceId && tx.internalTransferSpaceId !== move.cajaId)))) { conflict(move, "identity", tx); continue; }
    if (tx?.internalTransferSettled) { conflict(move, "settled", tx); continue; }
    if (deletedPersonal.has(tx?.id ?? move.personalTransactionId!) || deletedMovements.has(move.id)) { conflict(move, "deleted", tx); continue; }
    if (tx && (tx.amount !== amount(move) || tx.date !== move.fecha)) {
      conflict(move, "values", tx, tx.internalTransferLink === move.id && tx.internalTransferSpaceId === move.cajaId
        && !withReturns.has(move.cajaId)); continue;
    }
    const id = tx?.id ?? move.personalTransactionId!;
    if (!Number.isSafeInteger(id) || id <= 0) { conflict(move, "identity", tx); continue; }
    used.add(id);
    if (move.personalTransactionId == null) changed.set(move.id, { ...move, personalTransactionId: id, updatedAt: siguienteVersionCaja(move) });
    const name = boxes.get(move.cajaId)!.nombre;
    const next: Transaction = { ...(tx || { id, type, amount: amount(move), date: move.fecha, category: "otros", method: "transfer", description: name, notes: "", origin: "manual" as const }),
      internalTransfer: "box", internalTransferLink: move.id, internalTransferSpaceId: move.cajaId,
      internalTransferSpaceName: name };
    if (!tx || clean(tx) !== clean(next)) upserts.set(id, next);
  }
  const nextData = changed.size ? { ...data, movimientos: data.movimientos.map(move => changed.get(move.id) || move) } : data;
  const movesByBox = new Map<string, MovimientoCaja[]>();
  for (const move of nextData.movimientos) {
    const group = movesByBox.get(move.cajaId) || [];
    group.push(move); movesByBox.set(move.cajaId, group);
  }
  for (const box of data.cajas) {
    if (pending.has(box.id)) continue;
    const moves = movesByBox.get(box.id) || [];
    const ledger = linkedTransferLedger(moves);
    for (const move of moves.filter(move => move.personalReturnAmount != null)) {
      const tx = upserts.get(move.personalTransactionId!) || rowsById.get(move.personalTransactionId!);
      if (!tx || conflictBoxes.has(box.id)) continue;
      const allocations = ledger.allocationsByReturnId.get(move.id) || [];
      if (move.personalReturnAmount !== move.monto
        || Math.abs(allocations.reduce((total, item) => total + item.amount, 0) - move.personalReturnAmount!) > 0.00001
        || (tx.internalTransferAllocations?.length && !allocationsEqual(tx.internalTransferAllocations, allocations))) { conflict(move, "identity", tx); continue; }
      if (!allocationsEqual(tx.internalTransferAllocations, allocations)) upserts.set(tx.id, { ...tx, internalTransferAllocations: allocations });
    }
  }
  for (const tx of personal) {
    if (pending.has(tx.internalTransferSpaceId || "")) continue;
    const conversion = data.conversiones?.[tx.internalTransferSpaceId || ""];
    if (conversion && conversion.uid === uid && conversion.links.some(link => link.personalId === tx.id && link.movementId === tx.internalTransferLink)) {
      if (reused.has(tx.id) || deletedPersonal.has(tx.id)) conflicts.push({ personalId: tx.id, boxId: conversion.sourceId, reason: "identity" });
      else upserts.set(tx.id, { ...tx, internalTransferSpaceId: conversion.targetId, internalTransferSpaceName: conversion.name });
      continue;
    }
    if (tx.internalTransferSettled) continue;
    if (used.has(tx.id) || conflictPersonal.has(tx.id)) continue;
    // Cajas compartidas no pertenecen al archivo privado. Los demás enlaces
    // incompletos quedan para revisión: nunca devolverlos por ausencia.
    if (tx.internalTransferSpaceId?.startsWith("caja-") || !tx.internalTransferSpaceId) {
      conflicts.push({ personalId: tx.id, boxId: tx.internalTransferSpaceId, reason: "missing" });
    }
  }
  // Una revisión no modifica indirectamente otros registros dudosos.
  return conflicts.length ? { data, upserts: [], conflicts } : { data: nextData, upserts: [...upserts.values()], conflicts };
}

/** Elección explícita, limitada a monto/fecha de una pareja con IDs exactos. */
export function resolvePrivateBoxConflict(data: DatosCajas, rows: Transaction[], deleted: number[], uid: string, choice: PrivateBoxRepairChoice): PrivateBoxRepairPlan {
  const issue = planPrivateBoxRepair(data, rows, deleted, uid).conflicts.find(item => item.movementId === choice.movementId && item.reason === "values" && item.selectable);
  if (!issue || !["personal", "box"].includes(choice.from)) throw new Error("private-box-repair-conflict");
  const move = data.movimientos.find(item => item.id === choice.movementId)!, tx = rows.find(item => item.id === issue.personalId)!;
  // Devoluciones y aportes con devolución posterior necesitan resolver el
  // reparto completo; no cambiar a ciegas un ingreso ya recuperado.
  if (move.personalReturnAmount != null || data.movimientos.some(item => item.cajaId === move.cajaId && item.personalReturnAmount != null)) throw new Error("private-box-repair-conflict");
  const nextMove = choice.from === "personal" ? { ...move, monto: tx.amount, fecha: tx.date, updatedAt: siguienteVersionCaja(move) } : move;
  const nextTx = choice.from === "box" ? { ...tx, amount: move.monto, date: move.fecha } : tx;
  const day = new Date(`${nextTx.date}T00:00:00Z`);
  if (!Number.isFinite(nextTx.amount) || nextTx.amount <= 0 || !Number.isSafeInteger(Math.round(nextTx.amount * 1000))
    || !/^\d{4}-\d{2}-\d{2}$/.test(nextTx.date) || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== nextTx.date) throw new Error("private-box-repair-conflict");
  const nextData = nextMove === move ? data : { ...data, movimientos: data.movimientos.map(item => item.id === move.id ? nextMove : item) };
  // Un registro elegido no puede hacer negativo el saldo de Caja.
  fusionarCajas(nextData, CAJAS_VACIAS);
  const repaired = planPrivateBoxRepair(nextData, rows.map(item => item.id === tx.id ? nextTx : item), deleted, uid);
  return repaired.conflicts.length ? { data: nextData, upserts: [nextTx], conflicts: repaired.conflicts }
    : { ...repaired, upserts: [nextTx, ...repaired.upserts.filter(item => item.id !== tx.id)] };
}

/** Recalcula desde la fuente viva dentro del guardado, no confía en el plan de pantalla. */
export function validatePrivateBoxRepair(before: DatosCajas, next: DatosCajas, rows: Transaction[], deleted: number[], upserts: Transaction[], deleteIds: number[], uid: string, repair: true | PrivateBoxRepairChoice): void {
  const plan = repair === true ? planPrivateBoxRepair(before, rows, deleted, uid) : resolvePrivateBoxConflict(before, rows, deleted, uid, repair);
  if ((repair === true && plan.conflicts.length) || deleteIds.length || clean(plan.data) !== clean(next)
    || clean(plan.upserts) !== clean(upserts)) throw new Error("private-box-repair-conflict");
}

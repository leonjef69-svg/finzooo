export type LinkedSpaceMovement = {
  id: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  creadoEn?: number;
  creadoPor?: string;
  personalTransactionId?: number;
  personalOwnerUid?: string;
  personalReturnAmount?: number;
};

export type TransferAllocation = { transactionId: number; amount: number };
export type TransferStatus = "pending" | "partial" | "returned" | "consumed";
export type TransferGroupSummary = {
  key: string;
  sent: number;
  returned: number;
  pending: number;
  consumed?: number;
  count: number;
  status: TransferStatus;
  spaceName?: string;
};
export type CompactTransferRow<T> = { key: string; item: T; transferGroup?: TransferGroupSummary };

export type SpaceMovementDeletionPlan<T> =
  | { ok: true; items: T[] }
  | { ok: false; reason: "empty" | "contribution-used" | "negative-balance" };

export type PersonalLinkedTransfer = {
  id: number;
  type?: "expense" | "income";
  amount?: number;
  internalTransfer?: "family" | "box";
  internalTransferLink?: string;
  internalTransferSpaceId?: string;
  internalTransferSpaceName?: string;
  internalTransferAllocations?: TransferAllocation[];
  internalTransferSettled?: boolean;
  internalTransferConsumedAmount?: number;
};

/** La mitad que vive en Personal de una transferencia a un espacio. */
export type PersonalTransferMovement = PersonalLinkedTransfer & {
  type: "expense" | "income";
  amount: number;
};

/** Datos mínimos de un aporte familiar antiguo, previo al vínculo doble. */
export type LegacyFamilyContribution = LinkedSpaceMovement & {
  descripcion: string;
  method?: string;
  creadoPor: string;
};

const CENT = 0.005;
const money = (value: number) => Math.round(value * 100) / 100;

export function isLinkedSpaceTransfer(item: LinkedSpaceMovement): boolean {
  return item.personalTransactionId != null || (item.personalReturnAmount || 0) > 0;
}

export function isLinkedSpaceReturn(item: LinkedSpaceMovement): boolean {
  return item.tipo === "gasto" && item.personalTransactionId != null && (item.personalReturnAmount || 0) > 0;
}

/**
 * Une aportes y devoluciones sin exigir campos nuevos en Firestore. Las
 * devoluciones se aplican en orden a los aportes más antiguos de esa persona.
 * Así los datos anteriores obtienen el mismo estado que los nuevos.
 */
export function linkedTransferLedger(items: LinkedSpaceMovement[], ownerUid?: string): {
  allocationsByReturnId: Map<string, TransferAllocation[]>;
  progressByTransactionId: Map<number, { returned: number; remaining: number; status: TransferStatus }>;
} {
  const ordered = [...items]
    .filter(item => !ownerUid || item.personalOwnerUid === ownerUid)
    .sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0) || a.id.localeCompare(b.id));
  const contributions = new Map<number, { amount: number; returned: number; ownerUid?: string }>();
  const order: number[] = [];
  const allocationsByReturnId = new Map<string, TransferAllocation[]>();

  for (const item of ordered) {
    if (item.tipo === "ingreso" && item.personalTransactionId != null) {
      if (!contributions.has(item.personalTransactionId)) order.push(item.personalTransactionId);
      contributions.set(item.personalTransactionId, { amount: money(item.monto), returned: 0, ownerUid: item.personalOwnerUid });
      continue;
    }
    if (!isLinkedSpaceReturn(item)) continue;
    let available = money(item.personalReturnAmount || item.monto);
    const allocations: TransferAllocation[] = [];
    for (const transactionId of order) {
      if (available <= CENT) break;
      const contribution = contributions.get(transactionId);
      if (!contribution) continue;
      // A return only settles contributions from the same person. Otherwise,
      // one member's return could change another member's transfer status.
      if (contribution.ownerUid !== item.personalOwnerUid) continue;
      const remaining = money(Math.max(0, contribution.amount - contribution.returned));
      const applied = money(Math.min(remaining, available));
      if (applied <= CENT) continue;
      contribution.returned = money(contribution.returned + applied);
      available = money(available - applied);
      allocations.push({ transactionId, amount: applied });
    }
    allocationsByReturnId.set(item.id, allocations);
  }

  const progressByTransactionId = new Map<number, { returned: number; remaining: number; status: TransferStatus }>();
  for (const [transactionId, contribution] of contributions) {
    const returned = money(Math.min(contribution.amount, contribution.returned));
    const remaining = money(Math.max(0, contribution.amount - returned));
    progressByTransactionId.set(transactionId, {
      returned,
      remaining,
      status: remaining <= CENT ? "returned" : returned > CENT ? "partial" : "pending",
    });
  }
  return { allocationsByReturnId, progressByTransactionId };
}

/** Distribución que debe guardar la próxima devolución en Personal. */
export function allocatePersonalReturn(items: LinkedSpaceMovement[], amount: number, ownerUid?: string): TransferAllocation[] {
  const ledger = linkedTransferLedger(items, ownerUid);
  const orderedContributions = [...items]
    .filter(item => (!ownerUid || item.personalOwnerUid === ownerUid) && item.tipo === "ingreso" && item.personalTransactionId != null)
    .sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0) || a.id.localeCompare(b.id));
  let available = money(amount);
  const result: TransferAllocation[] = [];
  for (const item of orderedContributions) {
    if (available <= CENT) break;
    const progress = ledger.progressByTransactionId.get(item.personalTransactionId!);
    const remaining = progress?.remaining ?? money(item.monto);
    const applied = money(Math.min(remaining, available));
    if (applied <= CENT) continue;
    result.push({ transactionId: item.personalTransactionId!, amount: applied });
    available = money(available - applied);
  }
  return result;
}

export function personalTransferStatuses(items: PersonalLinkedTransfer[]): Map<number, TransferStatus> {
  const returnedById = new Map<number, number>();
  for (const item of items) {
    if (item.type !== "income" || !item.internalTransfer || !Array.isArray(item.internalTransferAllocations)) continue;
    for (const allocation of item.internalTransferAllocations) {
      if (!Number.isFinite(allocation.transactionId) || !Number.isFinite(allocation.amount) || allocation.amount <= 0) continue;
      returnedById.set(allocation.transactionId, money((returnedById.get(allocation.transactionId) || 0) + allocation.amount));
    }
  }
  const result = new Map<number, TransferStatus>();
  for (const item of items) {
    if (item.type !== "expense" || !item.internalTransfer || !Number.isFinite(item.amount) || (item.amount || 0) <= 0) continue;
    const returned = returnedById.get(item.id) || 0;
    result.set(item.id, item.internalTransferSettled
      ? (item.internalTransferConsumedAmount ?? Math.max(0, (item.amount || 0) - returned)) > CENT ? "consumed" : "returned"
      : returned >= (item.amount || 0) - CENT ? "returned" : returned > CENT ? "partial" : "pending");
  }
  return result;
}

/**
 * La lista normal enseña una sola tarjeta por destino. Los movimientos reales
 * no se modifican: el filtro Transferencias puede seguir mostrándolos uno a uno.
 */
export function compactPersonalTransferRows<T extends PersonalTransferMovement>(items: T[]): CompactTransferRow<T>[] {
  const summaries = new Map<string, TransferGroupSummary>();
  const settledByKey = new Map<string, number>();
  const consumedByKey = new Map<string, number>();
  for (const item of items) {
    if (!item.internalTransfer || !Number.isFinite(item.amount) || item.amount <= 0) continue;
    const identity = item.internalTransferSpaceId || item.internalTransferSpaceName || "legacy";
    const key = `${item.internalTransfer}:${identity}`;
    const current = summaries.get(key) || { key, sent: 0, returned: 0, pending: 0, count: 0, status: "pending" as const, spaceName: item.internalTransferSpaceName };
    if (item.type === "expense") current.sent = money(current.sent + item.amount);
    else current.returned = money(current.returned + item.amount);
    if (item.type === "expense" && item.internalTransferSettled) {
      settledByKey.set(key, money((settledByKey.get(key) || 0) + item.amount));
      const consumed = item.internalTransferConsumedAmount ?? item.amount;
      consumedByKey.set(key, money((consumedByKey.get(key) || 0) + Math.min(item.amount, Math.max(0, consumed))));
    }
    current.count += 1;
    current.spaceName ||= item.internalTransferSpaceName;
    summaries.set(key, current);
  }
  for (const summary of summaries.values()) {
    const settledSent = settledByKey.get(summary.key) || 0;
    // En un destino cerrado, lo que no volvió fue consumido. Nunca se suma
    // ese importe a Personal ni se presenta como devolución.
    summary.consumed = consumedByKey.get(summary.key) || 0;
    summary.pending = money(Math.max(0, summary.sent - summary.returned - settledSent));
    summary.status = summary.pending <= CENT ? summary.consumed > CENT ? "consumed" : "returned" : summary.returned > CENT ? "partial" : "pending";
  }
  const emitted = new Set<string>();
  return items.flatMap(item => {
    if (!item.internalTransfer) return [{ key: `movement:${item.id}`, item }];
    const identity = item.internalTransferSpaceId || item.internalTransferSpaceName || "legacy";
    const key = `${item.internalTransfer}:${identity}`;
    if (emitted.has(key)) return [];
    emitted.add(key);
    return [{ key: `transfer:${key}`, item, transferGroup: summaries.get(key) }];
  });
}

/** Una Familia o Caja abierta resume todos sus pares Personal ↔ espacio. */
export function compactLinkedTransferRows<T extends LinkedSpaceMovement>(items: T[]): CompactTransferRow<T>[] {
  const linked = items.filter(isLinkedSpaceTransfer);
  if (!linked.length) return items.map(item => ({ key: `movement:${item.id}`, item }));
  const sent = money(linked.filter(item => !isLinkedSpaceReturn(item)).reduce((sum, item) => sum + item.monto, 0));
  const returned = money(linked.filter(isLinkedSpaceReturn).reduce((sum, item) => sum + (item.personalReturnAmount || item.monto), 0));
  const pending = money(Math.max(0, sent - returned));
  const summary: TransferGroupSummary = {
    key: "space",
    sent,
    returned,
    pending,
    count: linked.length,
    status: pending <= CENT ? "returned" : returned > CENT ? "partial" : "pending",
  };
  let emitted = false;
  return items.flatMap(item => {
    if (!isLinkedSpaceTransfer(item)) return [{ key: `movement:${item.id}`, item }];
    if (emitted) return [];
    emitted = true;
    return [{ key: "transfer:space", item, transferGroup: summary }];
  });
}

export function balanceOfSpace(items: LinkedSpaceMovement[]): number {
  return items.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0);
}

export function netFromPersonal(items: LinkedSpaceMovement[], ownerUid?: string): number {
  return Math.max(0, items.reduce((sum, item) => {
    const responsable = item.personalOwnerUid || item.creadoPor;
    if (ownerUid && responsable !== ownerUid) return sum;
    if (item.tipo === "ingreso" && item.personalTransactionId != null) return sum + item.monto;
    return sum - (item.personalReturnAmount || 0);
  }, 0));
}

export function returnableToPersonal(items: LinkedSpaceMovement[], ownerUid?: string): number {
  return Math.max(0, Math.min(balanceOfSpace(items), netFromPersonal(items, ownerUid)));
}

/** Una devolución inválida no puede convertir dinero ajeno en aporte liquidado. */
function invalidPersonalReturns(items: LinkedSpaceMovement[]): boolean {
  if (items.some(item => !Number.isFinite(item.monto) || item.monto <= 0)) return true;
  const contributions = items.filter(item => item.tipo === "ingreso" && item.personalTransactionId != null);
  const returns = items.filter(item => item.personalReturnAmount != null);
  if (returns.some(item => item.tipo !== "gasto" || !Number.isFinite(item.personalReturnAmount)
    || item.personalReturnAmount! <= 0 || Math.abs(item.personalReturnAmount! - item.monto) > CENT)) return true;
  const unknownOwner = [...contributions, ...returns].some(item => !(item.personalOwnerUid || item.creadoPor));
  const totals = new Map<string, number>();
  for (const item of contributions) {
    const owner = unknownOwner ? "legacy" : item.personalOwnerUid || item.creadoPor!;
    totals.set(owner, (totals.get(owner) || 0) + item.monto);
  }
  for (const item of returns) {
    const owner = unknownOwner ? "legacy" : item.personalOwnerUid || item.creadoPor!;
    totals.set(owner, (totals.get(owner) || 0) - item.personalReturnAmount!);
  }
  return [...totals.values()].some(total => total < -CENT);
}

/** Lo gastado es consumido; solo el saldo recuperable sigue pendiente. */
export function hasUnreturnedPersonalContributions(items: LinkedSpaceMovement[]): boolean {
  const available = balanceOfSpace(items);
  if (invalidPersonalReturns(items) || available < -CENT) return true;
  if (available <= CENT) return false;
  // Los registros antiguos ya guardaban quién creó el movimiento. Se usa ese
  // dato como responsable cuando falta `personalOwnerUid`. Si una devolución
  // antigua tampoco conserva creador, solo queda el neto agregado como señal
  // fiable: no se puede asignar con seguridad a una persona concreta.
  const contribuciones = items.filter(item => item.tipo === "ingreso" && item.personalTransactionId != null);
  const devoluciones = items.filter(item => (item.personalReturnAmount || 0) > CENT);
  if (
    contribuciones.some(item => !(item.personalOwnerUid || item.creadoPor)) ||
    devoluciones.some(item => !(item.personalOwnerUid || item.creadoPor))
  ) {
    return returnableToPersonal(items) > CENT;
  }
  const contributors = new Set(
    contribuciones.map(item => item.personalOwnerUid || item.creadoPor!),
  );
  return [...contributors].some(uid => returnableToPersonal(items, uid) > CENT);
}

export function hasUnreturnedPersonalContribution(items: LinkedSpaceMovement[], ownerUid: string): boolean {
  return invalidPersonalReturns(items) || balanceOfSpace(items) < -CENT || returnableToPersonal(items, ownerUid) > CENT;
}

export function canCloseLinkedSpace(items: LinkedSpaceMovement[]): boolean {
  return Math.abs(balanceOfSpace(items)) <= CENT && !hasUnreturnedPersonalContributions(items);
}

/** Conserva ambas mitades históricas al cerrar; no genera ningún ingreso. */
export function settlePersonalTransfers<T extends PersonalLinkedTransfer>(items: T[], kind: "family" | "box", spaceId: string): T[] {
  const linked = items.filter(item => item.internalTransfer === kind && item.internalTransferSpaceId === spaceId);
  const contributions = linked.filter(item => item.type === "expense");
  const amounts = new Map(contributions.map(item => [item.id, item.amount || 0]));
  const credited = new Map<number, number>();
  let unallocated = 0;
  for (const item of linked.filter(item => item.type === "income")) {
    let remaining = Math.max(0, item.amount || 0);
    for (const allocation of item.internalTransferAllocations || []) {
      if (!Number.isFinite(allocation.amount) || allocation.amount <= 0 || !amounts.has(allocation.transactionId)) continue;
      const available = Math.max(0, amounts.get(allocation.transactionId)! - (credited.get(allocation.transactionId) || 0));
      const applied = Math.min(remaining, allocation.amount, available);
      credited.set(allocation.transactionId, money((credited.get(allocation.transactionId) || 0) + applied));
      remaining = money(remaining - applied);
    }
    unallocated = money(unallocated + remaining);
  }
  // Compatibilidad con devoluciones antiguas que aún no guardaron distribución.
  for (const item of [...contributions].sort((a, b) => a.id - b.id)) {
    const applied = Math.min(unallocated, Math.max(0, (item.amount || 0) - (credited.get(item.id) || 0)));
    credited.set(item.id, money((credited.get(item.id) || 0) + applied));
    unallocated = money(unallocated - applied);
  }
  return linked.filter(item => !item.internalTransferSettled).map(item => ({ ...item, internalTransferSettled: true,
    ...(item.type === "expense" ? { internalTransferConsumedAmount: money(Math.max(0, (item.amount || 0) - (credited.get(item.id) || 0))) } : {}),
  }));
}

export function canSpendFromSpace(items: LinkedSpaceMovement[], amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= balanceOfSpace(items) + CENT;
}

/** Un aporte solo puede deshacerse entero si ese dinero sigue dentro. */
export function canUndoContribution(items: LinkedSpaceMovement[], contribution: LinkedSpaceMovement, ownerUid?: string): boolean {
  if (contribution.tipo !== "ingreso" || contribution.personalTransactionId == null) return true;
  return contribution.monto <= returnableToPersonal(items, ownerUid) + CENT;
}

/**
 * Build one safe deletion plan for both Familia and Caja. When the selected
 * rows contain a complete aporte/devolución pair, remove the selected returns
 * from the preflight balance first, then delete returns before contributions.
 */
export function planSpaceMovementDeletion<T extends LinkedSpaceMovement>(
  movements: readonly T[],
  selectedIds: readonly string[],
): SpaceMovementDeletionPlan<T> {
  const ids = new Set(selectedIds);
  const selected = movements.filter(item => ids.has(item.id));
  if (!selected.length) return { ok: false, reason: "empty" };

  const selectedReturnIds = new Set(selected.filter(isLinkedSpaceReturn).map(item => item.id));
  const afterSelectedReturns = movements.filter(item => !selectedReturnIds.has(item.id));
  const contributionUsed = selected.some(item =>
    item.tipo === "ingreso"
      && item.personalTransactionId != null
      && !canUndoContribution(afterSelectedReturns, item, item.personalOwnerUid),
  );
  if (contributionUsed) return { ok: false, reason: "contribution-used" };

  const remainingBalance = balanceOfSpace([...movements])
    - selected.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0);
  if (remainingBalance < -CENT) return { ok: false, reason: "negative-balance" };

  const items = [...selected].sort((a, b) => Number(isLinkedSpaceReturn(b)) - Number(isLinkedSpaceReturn(a)));
  return { ok: true, items };
}

export function movementIdsForCompactRow<T extends LinkedSpaceMovement>(
  row: CompactTransferRow<T>,
  visibleItems: readonly T[],
): string[] {
  return row.transferGroup
    ? visibleItems.filter(isLinkedSpaceTransfer).map(item => item.id)
    : [row.item.id];
}

export function countSelectedCompactRows<T extends LinkedSpaceMovement>(
  rows: readonly CompactTransferRow<T>[],
  visibleItems: readonly T[],
  selectedIds: readonly string[],
): number {
  const selected = new Set(selectedIds);
  return rows.filter(row => {
    const ids = movementIdsForCompactRow(row, visibleItems);
    return ids.length > 0 && ids.every(id => selected.has(id));
  }).length;
}

/** Monto mínimo al editar: nunca invade la parte ya utilizada. */
export function minimumContributionAmount(items: LinkedSpaceMovement[], contribution: LinkedSpaceMovement, ownerUid?: string): number {
  const reducible = Math.min(contribution.monto, returnableToPersonal(items, ownerUid));
  return Math.max(0, contribution.monto - reducible);
}

export function totalAcrossPersonalAndSpace(personal: number, items: LinkedSpaceMovement[]): number {
  return personal + balanceOfSpace(items);
}

/**
 * Dinero de Personal que sigue dentro de un tipo de espacio.
 *
 * Una salida enlazada es un aporte hecho desde Personal; una entrada enlazada
 * es una devolución. No se miran ingresos externos porque nunca generan una
 * mitad enlazada en Personal. Se redondea a centavos al final para que una
 * suma como 0.1 + 0.2 no deje una tarjeta visible por un residuo decimal.
 */
export function netTransferredFromPersonal(
  movements: PersonalTransferMovement[],
  kind: "family" | "box",
): number {
  const netBySpace = new Map<string, number>();
  for (const item of movements) {
    if (item.internalTransfer !== kind || !Number.isFinite(item.amount) || item.amount <= 0) continue;
    // Los registros antiguos sin espacio siguen conciliándose entre sí, pero
    // una devolución excedente de un espacio nunca oculta saldo de otro.
    const spaceId = item.internalTransferSpaceId || `legacy:${kind}`;
    const next = (netBySpace.get(spaceId) || 0) + (item.type === "expense" ? item.amount : -item.amount);
    netBySpace.set(spaceId, next);
  }
  const net = [...netBySpace.values()].reduce((sum, amount) => sum + Math.max(0, amount), 0);
  return Math.round(net * 100) / 100;
}

/**
 * Los primeros espacios Familia guardaban el origen solo como texto. Solo se
 * migra el texto exacto que Fino generaba, hecho por la propia cuenta y con
 * método transferencia; así un ingreso externo de un banco nunca se convierte
 * por error en una salida de Personal.
 */
export function isTrustedLegacyFamilyContribution(item: LegacyFamilyContribution, uid: string): boolean {
  const labels = new Set([
    "Monto inicial desde Personal",
    "Desde Personal",
    "Initial amount from Personal",
    "From Personal",
    "Valor inicial de Pessoal",
    "De Pessoal",
  ]);
  return item.tipo === "ingreso"
    && item.method === "transfer"
    && item.creadoPor === uid
    && item.personalTransactionId == null
    && item.personalOwnerUid == null
    && labels.has(item.descripcion.trim());
}

/**
 * Localiza la mitad de Personal cuyo movimiento de destino ya no existe.
 *
 * `counterpartLoaded` evita borrar nada mientras Familia/Caja todavía está
 * cargando. Cuando ya terminó la lectura, una transferencia sin vínculo o con
 * un vínculo inexistente es huérfana y puede reconciliarse de forma segura.
 */
export function orphanedPersonalTransferIds(
  transactions: PersonalLinkedTransfer[],
  kind: "family" | "box",
  validMovementIds: Iterable<string>,
  counterpartLoaded: boolean,
): number[] {
  if (!counterpartLoaded) return [];
  const valid = new Set(validMovementIds);
  return transactions
    .filter(item => item.internalTransfer === kind && (!item.internalTransferLink || !valid.has(item.internalTransferLink)))
    .map(item => item.id);
}
